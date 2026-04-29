'use strict';

const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Color palette — hex without #
const C = {
  bg:     '0F1117',
  bgMed:  '161B26',
  bgCard: '1A1F2E',
  white:  'FFFFFF',
  text2:  'D1D5DB',
  text3:  '9CA3AF',
  teal:   '1D9E75',
  blue:   '3B82F6',
  purple: '8B5CF6',
  yellow: 'F59E0B',
  red:    'EF4444',
  green:  '10B981',
  border: '2D3748',
  dark:   '0A0D13',
};

const W = 13.33; // slide width inches (WIDE)
const H = 7.5;   // slide height inches
const F = 'Arial';

const TMP_DIR = '/tmp/adslands-reports';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// --- helpers ------------------------------------------------------------------

function titleBlock(s, text, lineWidth = 2.5) {
  s.addText(text, {
    x: 0.5, y: 0.28, w: W - 1, h: 0.6,
    fontSize: 22, color: C.white, bold: true, fontFace: F,
  });
  s.addShape('rect', {
    x: 0.5, y: 0.95, w: lineWidth, h: 0.04,
    fill: { color: C.teal }, line: { type: 'none' },
  });
}

// --- Slide 1: Cover -----------------------------------------------------------

function slide1Cover(pres, { brandName, period, agencyName, reportType }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Top teal stripe
  s.addShape('rect', { x: 0, y: 0, w: W, h: 0.08, fill: { color: C.teal }, line: { type: 'none' } });

  // Logo
  s.addText('● AdsLands', {
    x: 0.5, y: 0.25, w: 3.5, h: 0.55,
    fontSize: 17, color: C.teal, bold: true, fontFace: F,
  });

  // Decorative vertical line
  s.addShape('rect', {
    x: W / 2 - 0.02, y: 1.4, w: 0.04, h: 3.8,
    fill: { color: C.teal, transparency: 70 }, line: { type: 'none' },
  });

  // Brand name
  s.addText(brandName || 'Marka', {
    x: 0.5, y: 2.2, w: W - 1, h: 1.3,
    fontSize: 42, color: C.white, bold: true, fontFace: F, align: 'center',
  });

  // Subtitle
  s.addText(`Performans Raporu  ·  ${period}`, {
    x: 0.5, y: 3.65, w: W - 1, h: 0.55,
    fontSize: 16, color: C.teal, fontFace: F, align: 'center',
  });

  // Badge
  const badgeText = reportType === 'agency' ? '⚙  Ajans Teknik Raporu' : '📋  Marka Sunum Raporu';
  s.addShape('rect', {
    x: W / 2 - 1.9, y: 4.5, w: 3.8, h: 0.45,
    fill: { color: '0D221A' }, line: { color: C.teal, pt: 1 },
  });
  s.addText(badgeText, {
    x: W / 2 - 1.9, y: 4.5, w: 3.8, h: 0.45,
    fontSize: 11, color: C.teal, fontFace: F, align: 'center', valign: 'middle',
  });

  // Bottom stripe
  s.addShape('rect', {
    x: 0, y: H - 0.06, w: W, h: 0.06,
    fill: { color: C.teal, transparency: 40 }, line: { type: 'none' },
  });

  // Footer texts
  s.addText(new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }), {
    x: 0.5, y: H - 0.65, w: 4, h: 0.4, fontSize: 11, color: C.text3, fontFace: F,
  });
  if (agencyName) {
    s.addText(agencyName, {
      x: W - 4.5, y: H - 0.65, w: 4, h: 0.4,
      fontSize: 11, color: C.text3, fontFace: F, align: 'right',
    });
  }
}

// --- Slide 2: Executive Summary -----------------------------------------------

function slide2Executive(pres, { metrics, summaryBullets }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  titleBlock(s, 'Yönetici Özeti', 2.8);

  const boxes = [
    { label: 'ROAS',            value: metrics.roas,  color: C.teal   },
    { label: 'Toplam Harcama',  value: metrics.spend, color: C.blue   },
    { label: 'Dönüşüm',        value: metrics.conv,  color: C.purple },
    { label: 'Ortalama CPA',    value: metrics.cpa,   color: C.yellow },
  ];

  boxes.forEach((b, i) => {
    const x = 0.3 + i * 3.2;
    s.addShape('rect', {
      x, y: 1.15, w: 3.05, h: 1.9,
      fill: { color: C.dark }, line: { color: b.color, pt: 2 },
    });
    s.addText(b.label, {
      x, y: 1.3, w: 3.05, h: 0.4,
      fontSize: 10, color: b.color, fontFace: F, align: 'center', bold: true,
    });
    s.addText(b.value, {
      x, y: 1.72, w: 3.05, h: 0.85,
      fontSize: 24, color: C.white, fontFace: F, align: 'center', bold: true,
    });
  });

  s.addText('Öne Çıkan Bulgular', {
    x: 0.5, y: 3.22, w: 10, h: 0.4,
    fontSize: 12, color: C.text3, fontFace: F, bold: true,
  });

  (summaryBullets || ['Veri analiz ediliyor...']).slice(0, 3).forEach((bullet, i) => {
    const y = 3.78 + i * 0.72;
    s.addShape('rect', {
      x: 0.5, y: y + 0.12, w: 0.12, h: 0.12,
      fill: { color: C.teal }, line: { type: 'none' },
    });
    s.addText(bullet, {
      x: 0.78, y, w: 12.1, h: 0.55,
      fontSize: 13, color: C.text2, fontFace: F,
    });
  });
}

// --- Slide 3: Channel Performance Table ---------------------------------------

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};

function slide3ChannelTable(pres, { channelData }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  titleBlock(s, 'Kanal Performansı', 3.0);

  if (!channelData || channelData.length === 0) {
    s.addText('Veri bulunamadı', {
      x: 0.5, y: 2.5, w: 12, h: 1,
      fontSize: 16, color: C.text3, fontFace: F, align: 'center',
    });
    return;
  }

  const brd = { type: 'solid', pt: 0.5, color: C.border };
  const hFill = { color: C.bgMed };
  const hOpts = { bold: true, color: C.text3, fontSize: 10, fill: hFill, border: brd, align: 'center' };

  const headerRow = [
    { text: 'Platform',  options: { ...hOpts, align: 'left' } },
    { text: 'Harcama',   options: hOpts },
    { text: 'ROAS',      options: hOpts },
    { text: 'CPA',       options: hOpts },
    { text: 'Skor',      options: hOpts },
  ];

  const bestIdx = channelData.reduce((best, curr, i, arr) =>
    parseFloat(curr.avg_roas) > parseFloat(arr[best].avg_roas) ? i : best, 0);

  const dataRows = channelData.map((ch, i) => {
    const isBest = i === bestIdx;
    const rowFill = { color: i % 2 === 0 ? C.bg : C.bgCard };
    const roas = Number(ch.avg_roas).toFixed(2);
    const spend = `₺${Number(ch.total_spend).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
    const cpa = ch.total_conversions > 0
      ? `₺${Math.round(ch.total_spend / ch.total_conversions)}`
      : '—';
    const score = Math.min(100, Math.round(Number(ch.avg_roas) * 22));
    const roasColor = Number(roas) >= 3 ? C.green : Number(roas) >= 1.5 ? C.yellow : C.red;
    const scoreColor = score >= 70 ? C.green : score >= 40 ? C.yellow : C.red;

    const leftBorder = isBest
      ? [{ pt: 0.5, color: C.border }, { pt: 0.5, color: C.border }, { pt: 0.5, color: C.border }, { pt: 4, color: C.green }]
      : brd;

    return [
      { text: PLATFORM_LABELS[ch.platform] || ch.platform, options: { color: isBest ? C.green : C.text2, fontSize: 12, fill: rowFill, bold: isBest, border: leftBorder } },
      { text: spend,          options: { color: C.text2,   fontSize: 12, fill: rowFill, border: brd, align: 'center' } },
      { text: `${roas}x`,     options: { color: roasColor, fontSize: 12, fill: rowFill, bold: true, border: brd, align: 'center' } },
      { text: cpa,            options: { color: C.text2,   fontSize: 12, fill: rowFill, border: brd, align: 'center' } },
      { text: `${score}/100`, options: { color: scoreColor, fontSize: 12, fill: rowFill, bold: true, border: brd, align: 'center' } },
    ];
  });

  s.addTable([headerRow, ...dataRows], {
    x: 0.5, y: 1.15, w: 12.3,
    rowH: 0.55,
    colW: [3.1, 2.5, 2.0, 2.2, 2.5],
  });

  if (channelData[bestIdx]) {
    s.addText(`★  En iyi performans: ${PLATFORM_LABELS[channelData[bestIdx].platform] || channelData[bestIdx].platform}`, {
      x: 0.5, y: H - 0.65, w: 8, h: 0.4,
      fontSize: 11, color: C.green, fontFace: F,
    });
  }
}

// --- Slide 4: Trend Chart -----------------------------------------------------

function slide4TrendChart(pres, { dailyData }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  titleBlock(s, 'Harcama & ROAS Trendi', 3.8);

  if (!dailyData || dailyData.length === 0) {
    s.addText('Trend verisi bulunamadı', {
      x: 0.5, y: 3, w: 12, h: 1, fontSize: 16, color: C.text3, fontFace: F, align: 'center',
    });
    return;
  }

  const labels = dailyData.map(d => {
    const dt = new Date(d.date);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  });
  const spends  = dailyData.map(d => Math.round(Number(d.daily_spend) || 0));
  const roasArr = dailyData.map(d => parseFloat(Number(d.daily_roas || 0).toFixed(2)));

  // Bar chart — daily spend
  s.addChart(pres.ChartType.bar,
    [{ name: 'Günlük Harcama (₺)', labels, values: spends }],
    {
      x: 0.5, y: 1.1, w: 12.3, h: 3.0,
      chartColors: [C.teal],
      barDir: 'col',
      showLegend: false,
      showTitle: false,
      showValue: false,
      valAxisLineShow: false,
      catAxisLineShow: false,
    }
  );

  s.addText('▐  Günlük Harcama (₺)', {
    x: 0.5, y: 4.2, w: 6, h: 0.35,
    fontSize: 10, color: C.teal, fontFace: F,
  });

  // Line chart — ROAS
  s.addChart(pres.ChartType.line,
    [{ name: 'ROAS', labels, values: roasArr }],
    {
      x: 0.5, y: 4.6, w: 12.3, h: 2.5,
      chartColors: [C.purple],
      showLegend: false,
      showTitle: false,
      lineDataSymbol: 'none',
      lineSize: 2,
      valAxisLineShow: false,
      catAxisLineShow: false,
    }
  );

  s.addText('▐  ROAS Trendi', {
    x: 0.5, y: 7.15, w: 6, h: 0.3,
    fontSize: 10, color: C.purple, fontFace: F,
  });
}

// --- Slide 5: Sector Benchmark ------------------------------------------------

function slide5Benchmark(pres, { metrics }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  titleBlock(s, 'Sektör Benchmark', 2.8);

  const benchmarks = [
    { label: 'ROAS',  yourVal: parseFloat(metrics.roasNum) || 0, avg: 3.0, unit: 'x', higher: true  },
    { label: 'CPA',   yourVal: parseFloat(metrics.cpaNum)  || 0, avg: 80,  unit: '₺', higher: false },
    { label: 'CTR',   yourVal: parseFloat(metrics.ctrNum)  || 0, avg: 2.0, unit: '%', higher: true  },
  ];

  benchmarks.forEach((b, i) => {
    const y = 1.3 + i * 1.85;
    const maxVal = Math.max(b.yourVal, b.avg) * 1.35 || 1;
    const barX = 3.5, barW = 8.5, barH = 0.28;
    const yourWidth = Math.min(barW, (b.yourVal / maxVal) * barW);
    const isGood = b.higher ? b.yourVal >= b.avg : b.yourVal <= b.avg;
    const barColor = isGood ? C.teal : C.yellow;

    // Metric label
    s.addText(b.label, {
      x: 0.5, y, w: 2.8, h: 0.4, fontSize: 14, color: C.white, fontFace: F, bold: true,
    });

    // Values
    s.addText(`Sizin: ${b.yourVal.toFixed(2)}${b.unit}`, {
      x: 0.5, y: y + 0.45, w: 2.8, h: 0.3, fontSize: 11, color: C.teal, fontFace: F,
    });
    s.addText(`Sektör: ${b.avg}${b.unit}`, {
      x: 0.5, y: y + 0.78, w: 2.8, h: 0.3, fontSize: 11, color: C.text3, fontFace: F,
    });

    // Progress bar background
    s.addShape('rect', {
      x: barX, y: y + 0.48, w: barW, h: barH,
      fill: { color: C.border }, line: { type: 'none' },
    });

    // Your value bar
    s.addShape('rect', {
      x: barX, y: y + 0.48, w: Math.max(0.05, yourWidth), h: barH,
      fill: { color: barColor }, line: { type: 'none' },
    });

    // Industry average marker
    const avgX = barX + (b.avg / maxVal) * barW;
    if (avgX < barX + barW - 0.03) {
      s.addShape('rect', {
        x: avgX, y: y + 0.42, w: 0.04, h: barH + 0.12,
        fill: { color: C.text3 }, line: { type: 'none' },
      });
    }

    // Difference label
    const diffPct = Math.abs(((b.yourVal - b.avg) / (b.avg || 1)) * 100).toFixed(0);
    const diffLabel = `${isGood ? '+' : '-'}%${diffPct} ${isGood ? '✓' : '⚠'}`;
    s.addText(diffLabel, {
      x: barX + barW + 0.2, y: y + 0.42, w: 1.5, h: 0.35,
      fontSize: 12, color: isGood ? C.green : C.red, fontFace: F, bold: true,
    });
  });
}

// --- Slide 6: AI Recommendations ---------------------------------------------

function slide6Recommendations(pres, { recommendations }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  titleBlock(s, 'Aksiyon Önerileri', 2.8);

  const priorityColor = { high: C.red, medium: C.yellow, low: C.green };
  const priorityLabel = { high: 'Yüksek Öncelik', medium: 'Orta Öncelik', low: 'Düşük Öncelik' };

  const recs = (recommendations || []).slice(0, 4);
  const boxH = recs.length <= 3 ? 1.5 : 1.3;

  recs.forEach((rec, i) => {
    const y = 1.1 + i * (boxH + 0.12);
    const color = priorityColor[rec.priority] || C.teal;

    s.addShape('rect', {
      x: 0.5, y, w: 12.3, h: boxH,
      fill: { color: C.dark }, line: { color, pt: 2 },
    });

    // Priority label (top-right)
    s.addText(priorityLabel[rec.priority] || '', {
      x: 9.5, y: y + 0.08, w: 3.2, h: 0.28,
      fontSize: 9, color, fontFace: F, align: 'right',
    });

    // Number badge
    s.addShape('rect', {
      x: 0.7, y: y + (boxH / 2) - 0.25, w: 0.48, h: 0.48,
      fill: { color }, line: { type: 'none' },
    });
    s.addText(`${i + 1}`, {
      x: 0.7, y: y + (boxH / 2) - 0.25, w: 0.48, h: 0.48,
      fontSize: 14, color: C.bg, fontFace: F, bold: true, align: 'center', valign: 'middle',
    });

    // Title
    s.addText(rec.title || '', {
      x: 1.4, y: y + 0.12, w: 10.9, h: 0.4,
      fontSize: 13, color: C.white, fontFace: F, bold: true,
    });

    // Description
    s.addText(rec.description || '', {
      x: 1.4, y: y + 0.56, w: 10.9, h: boxH - 0.7,
      fontSize: 11, color: C.text2, fontFace: F,
    });
  });
}

// --- Slide 7: Conclusion ------------------------------------------------------

function slide7Conclusion(pres, { strengths, improvements, brandName }) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  titleBlock(s, 'Özet & Sonraki Adımlar', 3.2);

  // Left: Strengths
  s.addText('Güçlü Yönler', {
    x: 0.5, y: 1.1, w: 5.7, h: 0.45,
    fontSize: 14, color: C.green, fontFace: F, bold: true,
  });
  s.addShape('rect', {
    x: 0.5, y: 1.58, w: 5.7, h: 0.04,
    fill: { color: C.green }, line: { type: 'none' },
  });

  (strengths || []).slice(0, 4).forEach((str, i) => {
    const y = 1.75 + i * 0.72;
    s.addText('✓', {
      x: 0.5, y, w: 0.4, h: 0.5, fontSize: 14, color: C.green, fontFace: F, bold: true,
    });
    s.addText(str, {
      x: 1.05, y, w: 5.0, h: 0.5, fontSize: 12, color: C.text2, fontFace: F,
    });
  });

  // Divider
  s.addShape('rect', {
    x: 6.8, y: 1.1, w: 0.03, h: 5.5,
    fill: { color: C.border }, line: { type: 'none' },
  });

  // Right: Improvements
  s.addText('Gelişim Alanları', {
    x: 7.1, y: 1.1, w: 5.7, h: 0.45,
    fontSize: 14, color: C.yellow, fontFace: F, bold: true,
  });
  s.addShape('rect', {
    x: 7.1, y: 1.58, w: 5.7, h: 0.04,
    fill: { color: C.yellow }, line: { type: 'none' },
  });

  (improvements || []).slice(0, 4).forEach((imp, i) => {
    const y = 1.75 + i * 0.72;
    s.addText('⚠', {
      x: 7.1, y, w: 0.4, h: 0.5, fontSize: 13, color: C.yellow, fontFace: F,
    });
    s.addText(imp, {
      x: 7.65, y, w: 5.1, h: 0.5, fontSize: 12, color: C.text2, fontFace: F,
    });
  });

  // Footer watermark
  s.addShape('rect', {
    x: 0, y: H - 0.7, w: W, h: 0.7,
    fill: { color: '08090E' }, line: { type: 'none' },
  });
  s.addText('AdsLands AI Raporu', {
    x: 0.5, y: H - 0.52, w: 5, h: 0.38,
    fontSize: 11, color: C.teal, fontFace: F, bold: true,
  });
  if (brandName) {
    s.addText(brandName, {
      x: W / 2 - 2.5, y: H - 0.52, w: 5, h: 0.38,
      fontSize: 11, color: C.text3, fontFace: F, align: 'center',
    });
  }
  s.addText(new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }), {
    x: W - 4.5, y: H - 0.52, w: 4, h: 0.38,
    fontSize: 11, color: C.text3, fontFace: F, align: 'right',
  });
}

// --- Public API ---------------------------------------------------------------

async function generatePptx({
  brandName, agencyName, period, reportType, slides,
  metrics, summaryBullets, channelData, dailyData,
  recommendations, strengths, improvements,
}) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'AdsLands';
  pres.title = `${brandName || 'Marka'} — Performans Raporu`;

  const has = (id) => !slides || slides.length === 0 || slides.includes(id);

  if (has('cover'))           slide1Cover(pres, { brandName, period, agencyName, reportType });
  if (has('executive'))       slide2Executive(pres, { metrics, summaryBullets });
  if (has('channels'))        slide3ChannelTable(pres, { channelData });
  if (has('trends'))          slide4TrendChart(pres, { dailyData });
  if (has('benchmark'))       slide5Benchmark(pres, { metrics });
  if (has('recommendations')) slide6Recommendations(pres, { recommendations });
  if (has('conclusion'))      slide7Conclusion(pres, { strengths, improvements, brandName });

  const fileId = uuidv4();
  const filePath = `${TMP_DIR}/report-${fileId}.pptx`;

  await pres.writeFile({ fileName: filePath });

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    try { fs.unlinkSync(filePath); } catch {}
  }, 3600 * 1000);

  return { fileId, filePath };
}

function getFilePath(fileId) {
  if (!/^[0-9a-f-]{36}$/.test(fileId)) return null;
  const filePath = `${TMP_DIR}/report-${fileId}.pptx`;
  return fs.existsSync(filePath) ? filePath : null;
}

module.exports = { generatePptx, getFilePath };
