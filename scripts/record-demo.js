// AdsLands Demo Video Recorder
//
// Kullanım (brand hesabıyla — tüm sahneler çalışır):
//   DEMO_EMAIL=demo-brand@adslands.com DEMO_PASSWORD=Demo2026! node scripts/record-demo.js
//
// Ajans hesabı channels/benchmark/budget için brand seçimi gerektirir,
// doğrudan URL navigasyonu çalışmaz.
//
// Navigasyon: pushState tabanlı SPA.
// Sayfa URL'leri: /dashboard /channels /benchmark /budget /anomalies /ai-reports

const { chromium } = require('playwright');

const BASE_URL = 'https://adslands.com';

const EMAIL    = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Hata: DEMO_EMAIL ve DEMO_PASSWORD gereklidir.');
  console.error('Kullanım: DEMO_EMAIL=demo-brand@adslands.com DEMO_PASSWORD=Demo2026! node scripts/record-demo.js');
  process.exit(1);
}

// Sayfaya git, .fade-in yüklenene kadar bekle, ek bekleme süresi ekle
async function nav(page, path, waitMs = 1500) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForSelector('.fade-in', { timeout: 12000 });
  await page.waitForTimeout(waitMs);
}

// Butonu bul: scroll ile görünür yap, bekle, tıkla
async function clickButton(page, textPattern, label) {
  // Önce DOM'da var mı bekle (viewport dışında olabilir)
  const btn = page.getByRole('button', { name: textPattern });
  const found = await btn.waitFor({ state: 'attached', timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (!found) {
    console.warn(`  ⚠ "${label}" butonu bulunamadı, adım atlanıyor.`);
    return false;
  }

  // Sayfayı aşağı kaydır — buton genelde alt bölümlerde
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const visible = await btn.isVisible().catch(() => false);
  if (!visible) {
    console.warn(`  ⚠ "${label}" butonu görünür değil, adım atlanıyor.`);
    return false;
  }

  await btn.click();
  console.log(`  ✓ "${label}" tıklandı.`);
  return true;
}

async function record() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: 'demo-videos/',
      size: { width: 1440, height: 900 },
    },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // ── Giriş ─────────────────────────────────────────────────────────────────
  console.log('→ Giriş yapılıyor...');
  await page.goto(BASE_URL);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.waitForTimeout(300);
  await page.fill('input[type="password"]', PASSWORD);
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.fade-in', { timeout: 20000 });
  await page.waitForTimeout(2500);
  console.log('  ✓ Giriş başarılı.');

  // ── Sahne 1: Dashboard (12 sn) ────────────────────────────────────────────
  console.log('→ Sahne 1: Dashboard');
  await nav(page, '/dashboard', 800);
  await page.waitForTimeout(12000);

  // ── Sahne 2: Kanal Analizi (13 sn) ───────────────────────────────────────
  console.log('→ Sahne 2: Kanal Analizi');
  await nav(page, '/channels', 2000);
  // Sayfanın grafik bölümlerini göster — yavaşça aşağı scroll
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(8000);

  // ── Sahne 3: Benchmark (12 sn) ────────────────────────────────────────────
  console.log('→ Sahne 3: Benchmark');
  await nav(page, '/benchmark', 1500);
  await page.waitForTimeout(12000);

  // ── Sahne 4: Bütçe + Anomali (13 sn) ─────────────────────────────────────
  console.log('→ Sahne 4: Bütçe Planlama');
  await nav(page, '/budget', 1500);
  await page.waitForTimeout(7000);

  console.log('→ Sahne 4b: Anomaliler');
  await nav(page, '/anomalies', 1500);
  await page.waitForTimeout(6000);

  // ── Sahne 5: AI Kanal Analizi (14 sn) ────────────────────────────────────
  console.log('→ Sahne 5: AI Kanal Analizi');
  await nav(page, '/channels', 2500);
  // Metrik kartlarının yüklenmesini bekle
  await page.waitForTimeout(1000);

  const aiClicked = await clickButton(page, /AI Analiz Et/, 'AI Analiz Et');
  if (aiClicked) {
    console.log('  Streaming bekleniyor (12 sn)...');
  }
  await page.waitForTimeout(12000);

  // ── Sahne 6: AI Raporlar (13 sn) ─────────────────────────────────────────
  console.log('→ Sahne 6: AI Raporlar');
  await nav(page, '/ai-reports', 2000);

  await clickButton(page, /Rapor Oluştur/, 'Rapor Oluştur');
  await page.waitForTimeout(10000);

  // ── Bitir ─────────────────────────────────────────────────────────────────
  await context.close();
  await browser.close();

  const { readdirSync, statSync } = require('fs');
  const files = readdirSync('demo-videos/').map(f => {
    const s = statSync(`demo-videos/${f}`);
    return { name: f, size: (s.size / 1024 / 1024).toFixed(1) + ' MB' };
  });
  console.log('\n✓ Kayıt tamamlandı.');
  files.forEach(f => console.log(`  demo-videos/${f.name}  (${f.size})`));
}

record().catch(err => {
  console.error('Kayıt hatası:', err.message);
  process.exit(1);
});
