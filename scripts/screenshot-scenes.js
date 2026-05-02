// AdsLands Sayfa Screenshot Scripti
//
// Kullanım:
//   DEMO_EMAIL=demo-brand@adslands.com DEMO_PASSWORD=Demo2026! node scripts/screenshot-scenes.js
//
// Çıktı: video/screenshots/*.png (1440x900, PNG)

const path = require('path');
const { chromium } = require(path.join(__dirname, '../node_modules/playwright'));
const fs = require('fs');

const BASE_URL  = 'https://adslands.com';
const OUT_DIR   = path.join(__dirname, '../video/screenshots');
const EMAIL     = process.env.DEMO_EMAIL;
const PASSWORD  = process.env.DEMO_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Hata: DEMO_EMAIL ve DEMO_PASSWORD gereklidir.');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const SCENES = [
  { name: 'dashboard',     url: '/dashboard' },
  { name: 'kanal-analizi', url: '/channels' },
  { name: 'benchmark',     url: '/benchmark' },
  { name: 'butce',         url: '/budget' },
  { name: 'anomali',       url: '/anomalies' },
  { name: 'ai-analiz',     url: '/channels',   aiTrigger: true },
  { name: 'ai-rapor',      url: '/ai-reports' },
];

async function waitForPageReady(page, extraMs = 0) {
  // .fade-in veya .content veya .topbar — hangisi önce gelirse
  await page.waitForFunction(() =>
    document.querySelector('.fade-in') ||
    document.querySelector('.content') ||
    document.querySelector('.topbar'),
  { timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  if (extraMs > 0) await page.waitForTimeout(extraMs);
}

async function shoot(page, name, extraMs = 0) {
  await page.waitForTimeout(extraMs);
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({
    path: filePath,
    type: 'png',
    fullPage: false,
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });
  const size = (fs.statSync(filePath).size / 1024).toFixed(0);
  console.log(`  ✓ ${name}.png  (${size} KB)`);
}

async function run() {
  const browser = await chromium.launch({
    headless: false,   // headless:true SPA render'ı geciktirebilir
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,          // 2× → yüksek kalite (2880×1800 kaynak)
  });
  const page = await context.newPage();

  // ── Giriş ─────────────────────────────────────────────────────────────────
  console.log('→ Giriş yapılıyor...');
  await page.goto(BASE_URL);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.waitForTimeout(200);
  await page.fill('input[type="password"]', PASSWORD);
  await page.waitForTimeout(200);
  await page.click('button[type="submit"]');
  // Başarılı login → .main veya .fade-in DOM'a girer
  await page.waitForFunction(() =>
    document.querySelector('.fade-in') || document.querySelector('.main'),
  { timeout: 25000 });
  await page.waitForTimeout(1800);
  console.log('  ✓ Giriş başarılı.\n');

  // ── Her sahne ─────────────────────────────────────────────────────────────
  for (const scene of SCENES) {
    console.log(`→ ${scene.name}`);

    await page.goto(`${BASE_URL}${scene.url}`);
    await waitForPageReady(page, 1800);

    if (scene.aiTrigger) {
      // Sayfayı aşağı scroll et — AI butonu sayfa altında
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await page.waitForTimeout(700);

      const btn = page.getByRole('button', { name: /AI Analiz Et/ });
      const found = await btn.waitFor({ state: 'attached', timeout: 8000 }).then(() => true).catch(() => false);

      if (found && await btn.isVisible().catch(() => false)) {
        await btn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await btn.click();
        console.log('  AI analizi başlatıldı, 3 sn bekleniyor...');
        await page.waitForTimeout(3000);
        // Sayfa yukarısına geri dönerek streaming metnini de frame'e al
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForTimeout(300);
      } else {
        console.warn('  ⚠ AI Analiz Et butonu bulunamadı, normal screenshot alınıyor.');
      }
    }

    // Scroll başa (tüm sahneler için)
    if (!scene.aiTrigger) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(200);
    }

    await shoot(page, scene.name);
  }

  await browser.close();

  // ── Özet ─────────────────────────────────────────────────────────────────
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n✅ ${files.length} screenshot alındı → video/screenshots/`);
  files.forEach(f => {
    const kb = (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0);
    console.log(`   ${f.padEnd(30)} ${kb} KB`);
  });
}

run().catch(err => {
  console.error('Hata:', err.message);
  process.exit(1);
});
