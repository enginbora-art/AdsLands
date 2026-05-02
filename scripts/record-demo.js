// AdsLands Demo Video Recorder
// Kullanım: DEMO_EMAIL=xxx DEMO_PASSWORD=xxx node scripts/record-demo.js
//
// Navigasyon: App, URL'yi pushState ile günceller.
// Sayfa ID → URL: dashboard→/dashboard, channels→/channels,
//   benchmark→/benchmark, budget→/budget, anomalies→/anomalies, report→/ai-reports

const { chromium } = require('playwright');

const BASE_URL = 'https://adslands.com';

const EMAIL    = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Hata: DEMO_EMAIL ve DEMO_PASSWORD environment variable\'ları gereklidir.');
  console.error('Kullanım: DEMO_EMAIL=xxx DEMO_PASSWORD=xxx node scripts/record-demo.js');
  process.exit(1);
}

async function nav(page, path, waitMs = 1500) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForSelector('.fade-in', { timeout: 10000 });
  await page.waitForTimeout(waitMs);
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
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Dashboard yüklenene kadar bekle
  await page.waitForSelector('.fade-in', { timeout: 20000 });
  await page.waitForTimeout(2500);

  // ── Sahne 1: Dashboard (12 sn) ────────────────────────────────────────────
  console.log('→ Sahne 1: Dashboard');
  await nav(page, '/dashboard', 500);
  await page.waitForTimeout(12000);

  // ── Sahne 2: Kanal Analizi (13 sn) ───────────────────────────────────────
  console.log('→ Sahne 2: Kanal Analizi');
  await nav(page, '/channels', 1500);
  await page.waitForTimeout(13000);

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
  await nav(page, '/channels', 2000);

  // AI Analiz Et butonunu bul ve tıkla
  const aiBtn = page.locator('button', { hasText: 'AI Analiz Et' }).first();
  await aiBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {
    console.warn('  ⚠ AI Analiz Et butonu bulunamadı, adım atlanıyor.');
  });
  const aiVisible = await aiBtn.isVisible().catch(() => false);
  if (aiVisible) {
    await aiBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await aiBtn.click();
    console.log('  AI analizi başlatıldı, streaming bekleniyor...');
  }
  await page.waitForTimeout(12000);

  // ── Sahne 6: AI Raporlar (13 sn) ─────────────────────────────────────────
  console.log('→ Sahne 6: AI Raporlar');
  await nav(page, '/ai-reports', 2000);

  const reportBtn = page.locator('button', { hasText: 'Rapor Oluştur' }).first();
  await reportBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {
    console.warn('  ⚠ Rapor Oluştur butonu bulunamadı, adım atlanıyor.');
  });
  const reportVisible = await reportBtn.isVisible().catch(() => false);
  if (reportVisible) {
    await reportBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await reportBtn.click();
    console.log('  Rapor oluşturuluyor...');
  }
  await page.waitForTimeout(10000);

  // ── Bitir ─────────────────────────────────────────────────────────────────
  await context.close();
  await browser.close();
  console.log('\n✓ Kayıt tamamlandı. Video: demo-videos/ klasöründe .webm formatında.');
}

record().catch(err => {
  console.error('Kayıt hatası:', err.message);
  process.exit(1);
});
