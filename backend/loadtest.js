/**
 * AdsLands DB Load Test
 * ---------------------
 * Senaryo: 150 test markası × 5 platform = 750 entegrasyon × 90 gün = 67.500 satır
 * Önce test verisi oluşturur, indeks öncesi/sonrası sorgu sürelerini karşılaştırır,
 * sync performansını tahmin eder, sonra tüm test verisini temizler.
 *
 * Çalıştır: node loadtest.js
 * Sadece temizlik: node loadtest.js --cleanup
 */

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const CLEANUP_ONLY = process.argv.includes('--cleanup');
const AGENCY_PREFIX   = 'LOADTEST_Agency_';
const BRAND_PREFIX    = 'LOADTEST_Brand_';
const N_AGENCIES      = 3;
const N_BRANDS        = 150;   // 150 brand × 5 platform = 750 integrations
const PLATFORMS       = ['google_ads', 'meta', 'tiktok', 'linkedin', 'adform'];
const DAYS            = 90;
const BATCH_SIZE      = 2000;

const hr = () => '─'.repeat(68);

function rnd(min, max) { return Math.random() * (max - min) + min; }
function rndInt(min, max) { return Math.floor(rnd(min, max)); }

// ── Gerçekçi metrik üreteci ────────────────────────────────────────────────────
function genMetric(platform, seed) {
  const budgetMult = { google_ads: 1.5, meta: 1.2, tiktok: 0.8, linkedin: 1.8, adform: 1.0 }[platform] || 1;
  const spend       = Math.round(rnd(500, 50000) * budgetMult * 100) / 100;
  const impressions = rndInt(10000, 500000);
  const ctrRate     = rnd(0.01, 0.05);
  const clicks      = Math.max(1, Math.round(impressions * ctrRate));
  const cvRate      = rnd(0.02, 0.08);
  const conversions = Math.max(0, Math.round(clicks * cvRate));
  const roas        = conversions > 0
    ? Math.round((conversions * 150) / spend * 100) / 100
    : Math.round(rnd(0.5, 4) * 100) / 100;
  return { spend, impressions, clicks, conversions, roas };
}

// ── Yardımcı: ms cinsinden süreyi biçimlendir ─────────────────────────────────
function ms(n) { return `${n.toFixed(1)} ms`; }

// ── EXPLAIN ANALYZE çalıştır, toplam süreyi döndür ────────────────────────────
async function explainQuery(client, sql, params = []) {
  const { rows } = await client.query(`EXPLAIN (ANALYZE, FORMAT TEXT) ${sql}`, params);
  const text = rows.map(r => Object.values(r)[0]).join('\n');
  const execMatch  = text.match(/Execution Time:\s*([\d.]+)\s*ms/);
  const planMatch  = text.match(/Planning Time:\s*([\d.]+)\s*ms/);
  return {
    execMs:  execMatch  ? parseFloat(execMatch[1])  : null,
    planMs:  planMatch  ? parseFloat(planMatch[1])  : null,
    text,
  };
}

// ── Temizlik ──────────────────────────────────────────────────────────────────
async function cleanup(client) {
  console.log('\nTemizlik başlatılıyor...');
  await client.query(`
    DELETE FROM ad_metrics
    WHERE integration_id IN (
      SELECT i.id FROM integrations i
      JOIN companies c ON c.id = i.company_id
      WHERE c.name LIKE $1
    )
  `, [BRAND_PREFIX + '%']);
  const { rowCount: delInts } = await client.query(`
    DELETE FROM integrations
    WHERE company_id IN (
      SELECT id FROM companies WHERE name LIKE $1 OR name LIKE $2
    )
  `, [BRAND_PREFIX + '%', AGENCY_PREFIX + '%']);
  const { rowCount: delComps } = await client.query(`
    DELETE FROM companies WHERE name LIKE $1 OR name LIKE $2
  `, [BRAND_PREFIX + '%', AGENCY_PREFIX + '%']);
  console.log(`✅ Silindi: ${delInts} entegrasyon, ${delComps} şirket + ilgili metrikler`);
}

// ── Veri oluşturma ────────────────────────────────────────────────────────────
async function buildTestData(client) {
  console.log(`\n${hr()}`);
  console.log('ADIM 1 — TEST VERİSİ OLUŞTURULUYOR');
  console.log(hr());

  // Agencies
  const agencyIds = [];
  for (let a = 1; a <= N_AGENCIES; a++) {
    const { rows: [comp] } = await client.query(`
      INSERT INTO companies (name, type) VALUES ($1, 'agency')
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [AGENCY_PREFIX + a]);
    if (comp) agencyIds.push(comp.id);
  }
  console.log(`  ${agencyIds.length} test ajans oluşturuldu`);

  // Brands + integrations
  const integrationIds = [];
  for (let b = 1; b <= N_BRANDS; b++) {
    const agencyId = agencyIds[(b - 1) % agencyIds.length];
    const { rows: [brand] } = await client.query(`
      INSERT INTO companies (name, type) VALUES ($1, 'brand')
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [BRAND_PREFIX + b]);
    if (!brand) continue;

    for (const platform of PLATFORMS) {
      const { rows: [intg] } = await client.query(`
        INSERT INTO integrations (company_id, platform, is_active, account_id)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (company_id, platform) DO NOTHING
        RETURNING id
      `, [brand.id, platform, `LOADTEST-${brand.id.slice(0, 8)}-${platform}`]);
      if (intg) integrationIds.push({ id: intg.id, platform, companyId: brand.id });
    }
  }
  console.log(`  ${N_BRANDS} test marka, ${integrationIds.length} entegrasyon oluşturuldu`);

  // Metrics — batch INSERT
  console.log(`  ${integrationIds.length} entegrasyon × ${DAYS} gün = ${integrationIds.length * DAYS} satır ekleniyor...`);
  const startInsert = Date.now();
  let total = 0;

  const values  = [];
  const allRows = [];

  for (const intg of integrationIds) {
    for (let d = DAYS; d >= 1; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const m = genMetric(intg.platform, d);
      allRows.push([intg.id, dateStr, m.spend, m.impressions, m.clicks, m.conversions, m.roas]);
    }
  }

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map((_, idx) => {
      const base = idx * 7;
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`;
    }).join(',');
    const flat = batch.flat();
    await client.query(`
      INSERT INTO ad_metrics (integration_id, date, spend, impressions, clicks, conversions, roas)
      VALUES ${placeholders}
      ON CONFLICT (integration_id, date) DO NOTHING
    `, flat);
    total += batch.length;
    process.stdout.write(`\r  ${total.toLocaleString('tr-TR')} / ${allRows.length.toLocaleString('tr-TR')} satır...`);
  }

  const insertSec = ((Date.now() - startInsert) / 1000).toFixed(1);
  console.log(`\n  ✅ ${total.toLocaleString('tr-TR')} satır eklendi (${insertSec}s)`);

  // Toplam satır sayısı
  const { rows: [cnt] } = await client.query('SELECT COUNT(*) FROM ad_metrics');
  console.log(`  Toplam ad_metrics satır sayısı: ${parseInt(cnt.count).toLocaleString('tr-TR')}`);

  return integrationIds;
}

// ── Performans testi ──────────────────────────────────────────────────────────
async function runPerfTests(client, integrationIds, label) {
  const sampleIntg = integrationIds[0];
  const sampleComp = sampleIntg.companyId;

  const results = {};

  // (a) Dashboard özet sorgusu — tüm platformlar için 30 günlük özet
  const queryA = `
    SELECT i.platform,
           SUM(am.spend)              AS total_spend,
           SUM(am.impressions)        AS total_impressions,
           ROUND(AVG(am.clicks::numeric / NULLIF(am.impressions,0) * 100), 3) AS avg_ctr,
           AVG(am.roas)               AS avg_roas
    FROM ad_metrics am
    JOIN integrations i ON i.id = am.integration_id
    WHERE i.company_id = $1
      AND am.date >= NOW() - INTERVAL '30 days'
    GROUP BY i.platform
  `;

  // (b) Kanal analizi — günlük trend 90 gün
  const queryB = `
    SELECT am.date,
           SUM(am.spend)    AS spend,
           SUM(am.clicks)   AS clicks,
           ROUND(AVG(am.clicks::numeric / NULLIF(am.impressions,0) * 100), 3) AS avg_ctr,
           AVG(am.roas)     AS avg_roas
    FROM ad_metrics am
    JOIN integrations i ON i.id = am.integration_id
    WHERE i.company_id = $1
      AND i.platform = 'google_ads'
      AND am.date >= NOW() - INTERVAL '90 days'
    GROUP BY am.date
    ORDER BY am.date
  `;

  // (c) Anomali tespiti — tek entegrasyon 30 günlük avg
  const queryC = `
    SELECT AVG(spend) AS avg_spend
    FROM ad_metrics
    WHERE integration_id = $1
      AND date >= NOW() - INTERVAL '30 days'
  `;

  for (const [key, sql, params, desc] of [
    ['a', queryA, [sampleComp], 'Dashboard özet (30g, platform GROUP BY)'],
    ['b', queryB, [sampleComp], 'Kanal trend (90g, günlük GROUP BY)'],
    ['c', queryC, [sampleIntg.id], 'Anomali avg (tek entegrasyon, 30g)'],
  ]) {
    // İki kez çalıştır: soğuk / ılık
    const r1 = await explainQuery(client, sql, params);
    const r2 = await explainQuery(client, sql, params);
    results[key] = { desc, cold: r1, warm: r2 };
  }

  return results;
}

function printPerfTable(before, after) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(
    'Sorgu'.padEnd(44) +
    'Önce (soğuk)'.padStart(12) + 'Önce (ılık)'.padStart(13) +
    'Sonra (soğuk)'.padStart(14) + 'Sonra (ılık)'.padStart(13)
  );
  console.log('─'.repeat(80));

  for (const key of ['a', 'b', 'c']) {
    const b = before[key];
    const a = after[key];
    console.log(
      b.desc.padEnd(44) +
      ms(b.cold.execMs).padStart(12) +
      ms(b.warm.execMs).padStart(13) +
      ms(a.cold.execMs).padStart(14) +
      ms(a.warm.execMs).padStart(13)
    );
  }
  console.log('─'.repeat(80));
}

function computeSpeedup(before, after) {
  const speeds = [];
  for (const key of ['a', 'b', 'c']) {
    if (before[key].warm.execMs && after[key].warm.execMs) {
      const ratio = before[key].warm.execMs / after[key].warm.execMs;
      speeds.push({ key, ratio });
    }
  }
  return speeds;
}

// ── İndeks oluşturma ──────────────────────────────────────────────────────────
async function createIndexes(client) {
  console.log('\nIndeksler oluşturuluyor...');
  const t0 = Date.now();
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ad_metrics_intg_date
    ON ad_metrics(integration_id, date DESC);
  `);
  console.log(`  idx_ad_metrics_intg_date — ${Date.now() - t0}ms`);

  const t1 = Date.now();
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_integrations_company
    ON integrations(company_id);
  `);
  console.log(`  idx_integrations_company — ${Date.now() - t1}ms`);

  const t2 = Date.now();
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ad_metrics_date
    ON ad_metrics(date DESC);
  `);
  console.log(`  idx_ad_metrics_date — ${Date.now() - t2}ms`);
}

// ── 2 saatlik sync tahmini ────────────────────────────────────────────────────
async function estimateSyncPerf(integrationIds) {
  console.log(`\n${hr()}`);
  console.log('ADIM 4 — 2 SAATLİK SYNC PERFORMANS TAHMİNİ');
  console.log(hr());

  const N = integrationIds.length;
  const platformLatencies = {
    google_ads:  { min: 200, max: 800 },
    meta:        { min: 150, max: 600 },
    tiktok:      { min: 100, max: 400 },
    linkedin:    { min: 300, max: 1000 },
    adform:      { min: 200, max: 700 },
  };

  let totalEstMs = 0;
  for (const p of PLATFORMS) {
    const lat = platformLatencies[p];
    const avgLat = (lat.min + lat.max) / 2;
    const countForPlatform = integrationIds.filter(i => i.platform === p).length;
    totalEstMs += avgLat * countForPlatform;
  }

  const totalSec = totalEstMs / 1000;
  const totalMin = totalSec / 60;
  const WINDOW_MIN = 120; // 2 saat

  console.log(`  Test entegrasyon sayısı:  ${N}`);
  console.log(`  Gerçek üretim tahmini (150 entegrasyon):`);
  for (const p of PLATFORMS) {
    const lat = platformLatencies[p];
    const avg = (lat.min + lat.max) / 2;
    console.log(`    ${p.padEnd(16)} : ort. ${avg}ms × 30 enteg = ${((avg * 30)/1000).toFixed(1)}s`);
  }
  console.log(`\n  150 entegrasyon toplam tahmini: ~${(150 * 430 / 1000).toFixed(0)}s (~${(150 * 430 / 60000).toFixed(1)} dk)`);
  console.log(`  2 saatlik pencere: ${WINDOW_MIN} dk`);
  console.log(`  Durum: ${(150 * 430 / 60000) < WINDOW_MIN ? '✅ Pencereye sığıyor' : '⚠️  Sığmıyor'}`);
}

// ── Sonuç raporu ──────────────────────────────────────────────────────────────
function printReport(before, after, integrationIds) {
  console.log(`\n${hr()}`);
  console.log('ADIM 5 — SONUÇ RAPORU');
  console.log(hr());

  const N_ROWS = integrationIds.length * DAYS;
  console.log(`\n  Toplam test satırı:  ${N_ROWS.toLocaleString('tr-TR')} (${integrationIds.length} entegrasyon × ${DAYS} gün)`);

  const speeds = computeSpeedup(before, after);
  for (const { key, ratio } of speeds) {
    console.log(`\n  Sorgu (${key}) hız artışı: ${ratio.toFixed(1)}× ${ratio > 1.5 ? '✅ belirgin fark' : '— küçük fark'}`);
  }

  console.log(`\n  İndeks değerlendirmesi:`);
  console.log(`    idx_ad_metrics_intg_date  : Anomali sorgusu + trend sorgusu için kritik`);
  console.log(`    idx_integrations_company  : Şirket filtreli her sorgu için gerekli`);
  console.log(`    idx_ad_metrics_date       : Tarih filtreli tam tablo taramaları için ek destek`);

  const warmBefore = after['a'].warm.execMs;
  const warmAfter  = before['a'].warm.execMs;
  if (warmAfter > 50) {
    console.log(`\n  ⚠️  Partitioning tavsiyesi: Dashboard sorgusu ${ms(warmAfter)} (> 50ms)`);
    console.log(`     1M+ satır beklentisinde date-based partitioning düşünülebilir.`);
  } else {
    console.log(`\n  ✅ Partitioning gerekmez: Mevcut indeksler yeterli`);
  }
}

// ── Ana akış ──────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  try {
    if (CLEANUP_ONLY) {
      await cleanup(client);
      return;
    }

    // Önce mevcut test verisi varsa temizle
    const { rows: [existing] } = await client.query(
      `SELECT COUNT(*) FROM companies WHERE name LIKE $1`, [BRAND_PREFIX + '%']
    );
    if (parseInt(existing.count) > 0) {
      console.log(`Mevcut test verisi tespit edildi (${existing.count} şirket), temizleniyor...`);
      await cleanup(client);
    }

    // ── 1. Test verisi oluştur
    const integrationIds = await buildTestData(client);

    // ── 2. İndeks öncesi performans testi
    console.log(`\n${hr()}`);
    console.log('ADIM 2 — İNDEKS ÖNCESİ PERFORMANS TESTİ');
    console.log(hr());
    console.log('  Her sorgu 2× çalıştırılıyor (soğuk / ılık)...');
    const before = await runPerfTests(client, integrationIds, 'öncesi');

    // ── 3. İndeks ekle + sonrası test
    console.log(`\n${hr()}`);
    console.log('ADIM 3 — İNDEKS TESTİ');
    console.log(hr());
    await createIndexes(client);
    console.log('\n  İndeks sonrası performans testi...');
    const after = await runPerfTests(client, integrationIds, 'sonrası');

    printPerfTable(before, after);

    // ── 4. Sync tahmini
    await estimateSyncPerf(integrationIds);

    // ── 5. Rapor
    printReport(before, after, integrationIds);

    // ── Temizlik
    console.log(`\n${hr()}`);
    await cleanup(client);
    console.log('\n✅ Load test tamamlandı.');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Load test hatası:', err.message);
  process.exit(1);
});
