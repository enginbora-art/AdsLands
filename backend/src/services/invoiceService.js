const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const pool = require('../db');

const { PLAN_LABELS } = require('../config/plans');

const INVOICE_DIR = path.join(__dirname, '../../uploads/invoices');
const KDV_RATE    = 0.20;

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  // MAX yerine advisory lock + sayım — race condition'a karşı
  const { rows: [row] } = await pool.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)), 0) + 1 AS next
     FROM invoices
     WHERE invoice_number LIKE $1`,
    [`ADS-${year}-%`]
  );
  const seq = String(row.next).padStart(4, '0');
  return `ADS-${year}-${seq}`;
}

async function generateInvoicePdf({ invoiceNumber, companyName, planKey, amount, periodStart, periodEnd, createdAt }) {
  if (!fs.existsSync(INVOICE_DIR)) fs.mkdirSync(INVOICE_DIR, { recursive: true });

  const filePath = path.join(INVOICE_DIR, `${invoiceNumber}.pdf`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const base    = amount / (1 + KDV_RATE);
  const kdv     = amount - base;
  const fmtTRY  = (n) => `₺${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

  // Header
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#00BFA6').text('AdsLands', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#666666').text('ads.adslands.com', 50, 78);

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a1a2e')
    .text('FATURA', 400, 50, { align: 'right' });
  doc.fontSize(10).font('Helvetica').fillColor('#333333')
    .text(`No: ${invoiceNumber}`, 400, 76, { align: 'right' })
    .text(`Tarih: ${fmtDate(createdAt || new Date())}`, 400, 92, { align: 'right' });

  doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e2e8f0').lineWidth(1).stroke();

  // Alıcı
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748b').text('FATURA KESİLEN', 50, 130);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a2e').text(companyName || '—', 50, 148);

  // Hizmet tablosu
  const tableTop = 210;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b')
    .text('HİZMET TANIMI', 50, tableTop)
    .text('DÖNEM', 280, tableTop)
    .text('TUTAR', 460, tableTop, { align: 'right', width: 85 });

  doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).strokeColor('#e2e8f0').stroke();

  const desc = `AdsLands ${PLAN_LABELS[planKey] || planKey || 'Abonelik'}`;
  const periodStr = periodStart && periodEnd
    ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`
    : fmtDate(createdAt);

  doc.fontSize(11).font('Helvetica').fillColor('#1a1a2e')
    .text(desc, 50, tableTop + 26)
    .text(periodStr, 280, tableTop + 26)
    .text(fmtTRY(base), 460, tableTop + 26, { align: 'right', width: 85 });

  doc.moveTo(50, tableTop + 52).lineTo(545, tableTop + 52).strokeColor('#e2e8f0').stroke();

  // Toplamlar
  const totY = tableTop + 68;
  doc.fontSize(10).font('Helvetica').fillColor('#64748b')
    .text('Ara Toplam', 350, totY)
    .text(fmtTRY(base), 460, totY, { align: 'right', width: 85 });
  doc.text(`KDV (%${KDV_RATE * 100})`, 350, totY + 18)
    .text(fmtTRY(kdv), 460, totY + 18, { align: 'right', width: 85 });

  doc.moveTo(350, totY + 38).lineTo(545, totY + 38).strokeColor('#334155').stroke();
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a2e')
    .text('TOPLAM', 350, totY + 46)
    .text(fmtTRY(amount), 460, totY + 46, { align: 'right', width: 85 });

  // Footer notu
  doc.fontSize(9).font('Helvetica').fillColor('#94a3b8')
    .text('Bu fatura bilgi amaçlıdır.', 50, 700, { align: 'center', width: 495 });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return filePath;
}

async function createInvoice({ companyId, companyName, transactionId, planKey, amount, periodStart, periodEnd }) {
  const invoiceNumber = await nextInvoiceNumber();
  const pdfPath = await generateInvoicePdf({
    invoiceNumber, companyName, planKey, amount, periodStart, periodEnd, createdAt: new Date(),
  });

  const { rows: [inv] } = await pool.query(
    `INSERT INTO invoices (company_id, transaction_id, invoice_number, amount, currency, plan, period_start, period_end, pdf_path)
     VALUES ($1, $2, $3, $4, 'TRY', $5, $6, $7, $8)
     RETURNING *`,
    [companyId, transactionId || null, invoiceNumber, amount, planKey || null, periodStart || null, periodEnd || null, pdfPath]
  );
  return inv;
}

module.exports = { createInvoice, generateInvoicePdf };
