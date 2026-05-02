// AdsLands Demo Seed Scripti
//
// Kullanım:
//   node scripts/seed-demo.js           — demo verisini oluştur
//   node scripts/seed-demo.js --reset   — demo verisini sil
//
// Gereksinim: backend/.env içinde DATABASE_URL olmalı

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');
const nm      = (pkg) => path.join(BACKEND, 'node_modules', pkg);

require(nm('dotenv')).config({ path: path.join(BACKEND, '.env') });

const bcrypt      = require(nm('bcrypt'));
const { Pool }    = require(nm('pg'));
const { randomUUID } = require('crypto');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL bulunamadı. backend/.env dosyasını kontrol edin.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: (DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1'))
    ? false
    : { rejectUnauthorized: false },
});

// ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

// Gauss benzeri dağılım — uç değerlerin az olması için 3 örnek ortalaması
function randSmooth(min, max) {
  return (rand(min, max) + rand(min, max) + rand(min, max)) / 3;
}

// ── Seed ───────────────────────────────────────────────────────────────────

async function seedDemoData() {
  const client = await pool.connect();
  try {
    // Zaten var mı kontrol et
    const { rows: existing } = await client.query(
      "SELECT id FROM companies WHERE name = 'Demo Ajans'"
    );
    if (existing.length > 0) {
      console.log('⚠  Demo verisi zaten mevcut.');
      console.log('   Sıfırlamak için: node scripts/seed-demo.js --reset');
      return;
    }

    await client.query('BEGIN');

    // ── 1. Şirketler ─────────────────────────────────────────────────────
    console.log('▸ Şirketler oluşturuluyor...');

    const agencyId  = randomUUID();
    const brandId   = randomUUID();
    const trialEnd  = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    await client.query(`
      INSERT INTO companies (id, name, type, sector, trial_ends_at)
      VALUES ($1, 'Demo Ajans', 'agency', 'E-Ticaret', $2)
    `, [agencyId, trialEnd]);

    await client.query(`
      INSERT INTO companies (id, name, type, sector, trial_ends_at)
      VALUES ($1, 'Demo Marka', 'brand', 'E-Ticaret', $2)
    `, [brandId, trialEnd]);

    console.log(`  ✓ Demo Ajans  (${agencyId})`);
    console.log(`  ✓ Demo Marka  (${brandId})`);

    // ── 2. Kullanıcılar ───────────────────────────────────────────────────
    console.log('▸ Kullanıcılar oluşturuluyor...');

    const hash = await bcrypt.hash('Demo2026!', 12);

    await client.query(`
      INSERT INTO users (id, company_id, email, password_hash, full_name, is_company_admin, is_active)
      VALUES ($1, $2, 'demo-agency@adslands.com', $3, 'Demo Ajans Admin', true, true)
    `, [randomUUID(), agencyId, hash]);

    await client.query(`
      INSERT INTO users (id, company_id, email, password_hash, full_name, is_company_admin, is_active)
      VALUES ($1, $2, 'demo-brand@adslands.com', $3, 'Demo Marka Admin', true, true)
    `, [randomUUID(), brandId, hash]);

    console.log('  ✓ demo-agency@adslands.com');
    console.log('  ✓ demo-brand@adslands.com');

    // ── 3. Abonelik (Ajans için) ───────────────────────────────────────────
    console.log('▸ Abonelik oluşturuluyor...');

    await client.query(`
      INSERT INTO subscriptions
        (id, company_id, plan, interval, amount, currency, status, current_period_start, current_period_end)
      VALUES ($1, $2, 'scale', 'yearly', 9999.00, 'TRY', 'active', NOW(), $3)
    `, [randomUUID(), agencyId, trialEnd]);

    console.log('  ✓ Scale plan — aktif (1 yıl)');

    // ── 4. Ajans–Marka bağlantısı ─────────────────────────────────────────
    console.log('▸ Ajans–Marka bağlantısı oluşturuluyor...');

    await client.query(`
      INSERT INTO connections (id, agency_company_id, brand_company_id, status)
      VALUES ($1, $2, $3, 'accepted')
    `, [randomUUID(), agencyId, brandId]);

    console.log('  ✓ Demo Ajans → Demo Marka (accepted)');

    // ── 5. Entegrasyonlar ─────────────────────────────────────────────────
    console.log('▸ Entegrasyonlar oluşturuluyor...');

    const googleId = randomUUID();
    const metaId   = randomUUID();
    const tiktokId = randomUUID();

    const INTEGRATIONS = [
      { id: googleId, platform: 'google_ads', account_id: '123-456-7890' },
      { id: metaId,   platform: 'meta',       account_id: 'act_987654321' },
      { id: tiktokId, platform: 'tiktok',     account_id: 'TK555444333' },
    ];

    for (const i of INTEGRATIONS) {
      await client.query(`
        INSERT INTO integrations (id, company_id, platform, account_id, access_token, is_active)
        VALUES ($1, $2, $3, $4, 'demo-placeholder-token', true)
      `, [i.id, brandId, i.platform, i.account_id]);
      console.log(`  ✓ ${i.platform} (${i.account_id})`);
    }

    // ── 6. Ad Metrics (90 gün × 3 platform) ──────────────────────────────
    console.log('▸ Ad metrics oluşturuluyor (270 satır)...');

    // Harcama spike günleri (kaç gün önce)
    const ANOMALY_OFFSETS = new Set([5, 20, 45, 70]);

    // Platform bazlı konfigürasyon
    const PLATFORMS = {
      google_ads: {
        id: googleId,
        spend:    [800, 4000],   weekendMult: 0.45,
        roas:     [3.5, 6.0],
        ctr:      [0.025, 0.045],
        cpm:      [8, 18],       // TL per 1000 impression
        cvr:      [0.020, 0.040],
      },
      meta: {
        id: metaId,
        spend:    [400, 2500],   weekendMult: 0.50,
        roas:     [2.5, 4.5],
        ctr:      [0.015, 0.030],
        cpm:      [5, 14],
        cvr:      [0.015, 0.035],
      },
      tiktok: {
        id: tiktokId,
        spend:    [150, 1500],   weekendMult: 0.55,
        roas:     [2.0, 3.5],
        ctr:      [0.010, 0.025],
        cpm:      [3, 10],
        cvr:      [0.010, 0.025],
      },
    };

    // Anomali verisi — sonraki adımda anomalies tablosuna yazılacak
    const anomalyRecords = [];

    for (const [platform, cfg] of Object.entries(PLATFORMS)) {
      for (let daysAgo = 90; daysAgo >= 1; daysAgo--) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        date.setHours(0, 0, 0, 0);
        const dateStr  = date.toISOString().split('T')[0];
        const dow      = date.getDay();
        const isWeekend  = dow === 0 || dow === 6;
        const isAnomaly  = ANOMALY_OFFSETS.has(daysAgo);

        // Taban harcama (hafif büyüme trendi + hafta sonu düşüşü)
        const trendFactor   = 1 + (90 - daysAgo) / 90 * 0.15;
        let spendBase = randSmooth(cfg.spend[0], cfg.spend[1]) * trendFactor;
        if (isWeekend) spendBase *= cfg.weekendMult;

        const spend       = isAnomaly ? spendBase * rand(2.5, 3.5) : spendBase;
        const ctr         = randSmooth(cfg.ctr[0], cfg.ctr[1]);
        const cpm         = rand(cfg.cpm[0], cfg.cpm[1]);
        const impressions = Math.max(1, Math.round((spend / cpm) * 1000));
        const clicks      = Math.max(0, Math.round(impressions * ctr));
        const conversions = Math.max(0, Math.round(clicks * rand(cfg.cvr[0], cfg.cvr[1])));
        // Anomali gününde ROAS düşer (hızlı harcama, dönüşüm gelmeden)
        const roas = isAnomaly
          ? rand(cfg.roas[0] * 0.5, cfg.roas[0] * 0.85)
          : randSmooth(cfg.roas[0], cfg.roas[1]);

        await client.query(`
          INSERT INTO ad_metrics
            (id, integration_id, date, spend, impressions, clicks, conversions, roas)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (integration_id, date) DO UPDATE SET
            spend = EXCLUDED.spend, impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks, conversions = EXCLUDED.conversions,
            roas = EXCLUDED.roas, updated_at = NOW()
        `, [randomUUID(), cfg.id, dateStr,
            spend.toFixed(2), impressions, clicks, conversions, roas.toFixed(2)]);

        if (isAnomaly) {
          anomalyRecords.push({
            integrationId: cfg.id,
            detectedAt:    new Date(date.getTime() + 9 * 3600 * 1000), // 09:00
            expected:      spendBase,
            actual:        spend,
          });
        }
      }
    }

    console.log(`  ✓ 270 metrik satırı eklendi`);
    console.log(`  ℹ Anomali günleri: ${[...ANOMALY_OFFSETS].map(d => `${d} gün önce`).join(', ')}`);

    // ── 7. Anomalies ──────────────────────────────────────────────────────
    console.log('▸ Anomali kayıtları oluşturuluyor...');

    for (const a of anomalyRecords) {
      const daysAgo = Math.round((Date.now() - a.detectedAt.getTime()) / 86400000);
      const status  = daysAgo > 10 ? 'resolved' : 'open';

      await client.query(`
        INSERT INTO anomalies
          (id, integration_id, company_id, detected_at, metric, expected_value, actual_value, status)
        VALUES ($1, $2, $3, $4, 'spend', $5, $6, $7)
      `, [randomUUID(), a.integrationId, brandId,
          a.detectedAt.toISOString(),
          a.expected.toFixed(2), a.actual.toFixed(2), status]);
    }

    console.log(`  ✓ ${anomalyRecords.length} anomali (eski: resolved, son 10 gün: open)`);

    // ── 8. Bütçe planı ────────────────────────────────────────────────────
    console.log('▸ Bütçe planı oluşturuluyor...');

    const now     = new Date();
    const month   = now.getMonth() + 1;
    const year    = now.getFullYear();
    const budgetId = randomUUID();

    await client.query(`
      INSERT INTO budgets
        (id, company_id, month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget)
      VALUES ($1, $2, $3, $4, 150000, 75000, 45000, 30000)
      ON CONFLICT (company_id, month, year) DO UPDATE SET
        total_budget = 150000, google_ads_budget = 75000,
        meta_ads_budget = 45000, tiktok_ads_budget = 30000,
        updated_at = NOW()
    `, [budgetId, brandId, month, year]);

    console.log(`  ✓ ${year}/${month} — Toplam: 150.000 TL`);

    // ── 9. Budget Channels + KPI hedefleri ───────────────────────────────
    console.log('▸ KPI hedefleri oluşturuluyor...');

    const CHANNEL_KPIS = [
      // platform      amount  roas  cpa   ctr  impression  conversion
      ['google_ads',   75000,  4.0,  150,  3.0, 4_000_000,  500],
      ['meta',         45000,  3.5,  180,  2.0, 3_000_000,  250],
      ['tiktok',       30000,  3.0,  200,  1.5, 5_000_000,  150],
    ];

    for (const [platform, amount, roas, cpa, ctr, imp, conv] of CHANNEL_KPIS) {
      await client.query(`
        INSERT INTO budget_channels
          (id, budget_id, platform, amount, kpi_roas, kpi_cpa, kpi_ctr, kpi_impression, kpi_conversion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (budget_id, platform) DO UPDATE SET
          amount = EXCLUDED.amount, kpi_roas = EXCLUDED.kpi_roas,
          kpi_cpa = EXCLUDED.kpi_cpa, kpi_ctr = EXCLUDED.kpi_ctr,
          kpi_impression = EXCLUDED.kpi_impression, kpi_conversion = EXCLUDED.kpi_conversion
      `, [randomUUID(), budgetId, platform, amount, roas, cpa, ctr, imp, conv]);

      console.log(`  ✓ ${platform}: ${amount.toLocaleString('tr-TR')} TL — ROAS ${roas}, CPA ${cpa}, CTR %${ctr}`);
    }

    // ── 10. Benchmark kontrolü ────────────────────────────────────────────
    console.log('▸ Benchmark kontrolü...');

    // Benchmark verileri DB'de değil, frontend'de hardcoded (getBenchmark fonksiyonu).
    // E-Ticaret sektörü için değerler Channels.jsx / Benchmark.jsx'te tanımlı.
    console.log('  ℹ Benchmark verileri frontend\'de hardcoded (E-Ticaret sektörü otomatik seçilir).');

    await client.query('COMMIT');

    // ── Özet ─────────────────────────────────────────────────────────────
    console.log('\n✅ Demo seed tamamlandı!');
    console.log('─────────────────────────────────────────────────────');
    console.log('  Ajans Girişi : demo-agency@adslands.com');
    console.log('  Marka Girişi : demo-brand@adslands.com');
    console.log('  Şifre        : Demo2026!');
    console.log('─────────────────────────────────────────────────────');
    console.log('  Kayıt scripti:');
    console.log('  DEMO_EMAIL=demo-agency@adslands.com DEMO_PASSWORD=Demo2026! node scripts/record-demo.js');
    console.log('─────────────────────────────────────────────────────');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Seed hatası:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Reset ──────────────────────────────────────────────────────────────────

async function resetDemoData() {
  const client = await pool.connect();
  try {
    const { rows: companies } = await client.query(
      "SELECT id FROM companies WHERE name IN ('Demo Ajans', 'Demo Marka')"
    );

    if (companies.length === 0) {
      console.log('ℹ Demo verisi bulunamadı, yapılacak bir şey yok.');
      return;
    }

    const ids = companies.map(c => c.id);
    const ph  = (arr) => arr.map((_, i) => `$${i + 1}`).join(', ');

    // Entegrasyon ID'leri — metrik ve anomali silimi için
    const { rows: intgs } = await client.query(
      `SELECT id FROM integrations WHERE company_id IN (${ph(ids)})`, ids
    );
    const intgIds = intgs.map(i => i.id);

    // Bütçe ID'leri — budget_channels silimi için
    const { rows: bgets } = await client.query(
      `SELECT id FROM budgets WHERE company_id IN (${ph(ids)})`, ids
    );
    const budgetIds = bgets.map(b => b.id);

    await client.query('BEGIN');
    console.log('🗑  Demo verisi temizleniyor...');

    if (intgIds.length) {
      await client.query(`DELETE FROM ad_metrics  WHERE integration_id IN (${ph(intgIds)})`, intgIds);
      await client.query(`DELETE FROM anomalies   WHERE integration_id IN (${ph(intgIds)})`, intgIds);
    }

    if (budgetIds.length) {
      await client.query(`DELETE FROM budget_channels WHERE budget_id IN (${ph(budgetIds)})`, budgetIds);
    }

    await client.query(`DELETE FROM budgets       WHERE company_id IN (${ph(ids)})`, ids);
    await client.query(`DELETE FROM integrations  WHERE company_id IN (${ph(ids)})`, ids);
    await client.query(`DELETE FROM subscriptions WHERE company_id IN (${ph(ids)})`, ids);
    await client.query(`DELETE FROM notifications WHERE company_id IN (${ph(ids)})`, ids);
    await client.query(`DELETE FROM users         WHERE company_id IN (${ph(ids)})`, ids);

    // connections: iki ayrı kolon, aynı parametre seti yeniden kullanılabilir
    await client.query(
      `DELETE FROM connections
       WHERE agency_company_id IN (${ph(ids)}) OR brand_company_id IN (${ph(ids)})`,
      ids
    );

    await client.query(`DELETE FROM companies WHERE id IN (${ph(ids)})`, ids);

    await client.query('COMMIT');
    console.log(`  ✓ ${ids.length} şirket ve ilgili tüm veriler silindi.`);
    console.log('  Yeniden oluşturmak için: node scripts/seed-demo.js');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Reset hatası:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Çalıştır ───────────────────────────────────────────────────────────────

const isReset = process.argv.includes('--reset');

(isReset ? resetDemoData() : seedDemoData()).catch(() => process.exit(1));
