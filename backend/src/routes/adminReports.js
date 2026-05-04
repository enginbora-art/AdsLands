const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../db');
const { platformAdmin } = require('../middleware/auth');
const { PLAN_LABELS }   = require('../config/plans');

const PLAN_STATUS_LABELS = {
  active: 'Aktif',
  cancelling: 'İptal Süreci',
  cancelled: 'İptal',
  trial: 'Deneme',
  inactive: 'Pasif',
};

const FEATURE_LABELS = {
  channel_analysis: 'Kanal Analizi',
  ai_report: 'AI Rapor',
  kpi_analysis: 'KPI Analizi',
};

function applyHeaderStyle(row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FF0B1219' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00BFA6' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF00BFA6' } },
      left: { style: 'thin', color: { argb: 'FF00BFA6' } },
      bottom: { style: 'thin', color: { argb: 'FF00BFA6' } },
      right: { style: 'thin', color: { argb: 'FF00BFA6' } },
    };
  });
  row.height = 22;
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

// GET /api/admin/reports/export?month=YYYY-MM
router.get('/export', platformAdmin, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-').map(Number);
    if (!year || !mon) return res.status(400).json({ error: 'Geçersiz ay formatı. YYYY-MM bekleniyor.' });

    // --- Sheet 1 data: tüm şirketler + abonelik ---
    const { rows: companies } = await pool.query(`
      SELECT c.id, c.name, c.type, c.created_at, c.trial_ends_at,
             (SELECT u.email FROM users u
              WHERE u.company_id = c.id AND u.is_company_admin = true AND u.is_active = true
              ORDER BY u.created_at LIMIT 1) AS admin_email,
             s.plan, s.status AS sub_status, s.interval AS sub_interval,
             s.amount AS monthly_amount,
             s.current_period_start, s.current_period_end,
             CASE
               WHEN s.id IS NOT NULL AND s.status = 'active' AND NOT s.cancel_at_period_end THEN 'active'
               WHEN s.id IS NOT NULL AND s.status = 'active' AND s.cancel_at_period_end THEN 'cancelling'
               WHEN s.id IS NOT NULL AND s.status = 'cancelled' THEN 'cancelled'
               WHEN c.trial_ends_at IS NOT NULL AND c.trial_ends_at > NOW() THEN 'trial'
               ELSE 'inactive'
             END AS plan_status,
             CASE
               WHEN s.id IS NOT NULL AND s.current_period_start IS NOT NULL
                 THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - s.current_period_start)) / 2592000)::int
               WHEN c.trial_ends_at IS NOT NULL AND c.trial_ends_at > NOW() THEN 0
               ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 2592000)::int
             END AS months_active
      FROM companies c
      LEFT JOIN LATERAL (
        SELECT * FROM subscriptions WHERE company_id = c.id ORDER BY created_at DESC LIMIT 1
      ) s ON true
      WHERE c.type != 'admin'
      ORDER BY c.created_at DESC
    `);

    // --- Sheet 2 data: ödeme işlemleri ---
    const { rows: payments } = await pool.query(`
      SELECT pt.id, c.name AS company_name, c.type AS company_type,
             pt.created_at AS payment_date, pt.amount, pt.plan, pt.interval,
             pt.sipay_invoice_id, pt.order_id
      FROM payment_transactions pt
      JOIN companies c ON c.id = pt.company_id
      WHERE EXTRACT(YEAR  FROM pt.created_at) = $1
        AND EXTRACT(MONTH FROM pt.created_at) = $2
        AND pt.status = 'success'
      ORDER BY pt.created_at DESC
    `, [year, mon]);

    // --- Sheet 3 data: AI kullanımı ---
    const { rows: aiUsage } = await pool.query(`
      SELECT c.name AS company_name, c.type AS company_type,
             al.feature,
             COUNT(al.id)::int                  AS requests,
             COALESCE(SUM(al.cost_usd), 0)::float AS cost_usd,
             COALESCE(SUM(al.cost_try), 0)::float AS cost_try
      FROM ai_usage_logs al
      JOIN companies c ON c.id = al.company_id
      WHERE EXTRACT(YEAR  FROM al.created_at) = $1
        AND EXTRACT(MONTH FROM al.created_at) = $2
      GROUP BY c.name, c.type, al.feature
      ORDER BY cost_try DESC
    `, [year, mon]);

    // --- Workbook ---
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AdsLands';
    workbook.created = new Date();

    // ── Sheet 1: Müşteri Özeti ──────────────────────────────────────────────
    const ws1 = workbook.addWorksheet('Müşteri Özeti');
    ws1.columns = [
      { header: 'Şirket Adı',        key: 'name',         width: 32 },
      { header: 'Tip',               key: 'type',         width: 12 },
      { header: 'Plan',              key: 'plan',         width: 16 },
      { header: 'Abone. Başlangıcı', key: 'period_start', width: 20 },
      { header: 'Abone. Bitişi',     key: 'period_end',   width: 18 },
      { header: 'Aylık Tutar (TL)',  key: 'amount',       width: 18 },
      { header: 'Durum',             key: 'status',       width: 14 },
      { header: 'Admin E-posta',     key: 'email',        width: 32 },
      { header: 'Kayıt Tarihi',      key: 'created',      width: 14 },
      { header: 'Kaç Aydır Aktif',   key: 'months',       width: 16 },
    ];
    applyHeaderStyle(ws1.getRow(1));

    companies.forEach(c => {
      const row = ws1.addRow({
        name:         c.name,
        type:         c.type === 'agency' ? 'Ajans' : 'Marka',
        plan:         c.plan ? (PLAN_LABELS[c.plan] || c.plan) : '—',
        period_start: fmtDate(c.current_period_start),
        period_end:   fmtDate(c.current_period_end),
        amount:       c.monthly_amount ? Number(c.monthly_amount) : 0,
        status:       PLAN_STATUS_LABELS[c.plan_status] || c.plan_status || 'Pasif',
        email:        c.admin_email || '—',
        created:      fmtDate(c.created_at),
        months:       c.months_active || 0,
      });
      row.height = 18;
    });
    ws1.getColumn('amount').numFmt = '#,##0.00 ₺';

    // ── Sheet 2: Gelir Analizi ──────────────────────────────────────────────
    const ws2 = workbook.addWorksheet('Gelir Analizi');
    ws2.columns = [
      { header: 'Şirket Adı',   key: 'name',     width: 32 },
      { header: 'Tip',          key: 'type',     width: 12 },
      { header: 'Ödeme Tarihi', key: 'date',     width: 18 },
      { header: 'Tutar (TL)',   key: 'amount',   width: 16 },
      { header: 'Plan',         key: 'plan',     width: 14 },
      { header: 'Dönem',        key: 'interval', width: 12 },
      { header: 'Fatura No',    key: 'invoice',  width: 28 },
    ];
    applyHeaderStyle(ws2.getRow(1));

    payments.forEach(p => {
      const row = ws2.addRow({
        name:     p.company_name,
        type:     p.company_type === 'agency' ? 'Ajans' : 'Marka',
        date:     fmtDate(p.payment_date),
        amount:   Number(p.amount),
        plan:     p.plan ? (PLAN_LABELS[p.plan] || p.plan) : '—',
        interval: p.interval === 'monthly' ? 'Aylık' : p.interval === 'yearly' ? 'Yıllık' : (p.interval || '—'),
        invoice:  p.sipay_invoice_id || p.order_id || '—',
      });
      row.height = 18;
    });
    ws2.getColumn('amount').numFmt = '#,##0.00 ₺';

    if (payments.length > 0) {
      const total        = payments.reduce((s, p) => s + Number(p.amount), 0);
      const agencyTotal  = payments.filter(p => p.company_type === 'agency').reduce((s, p) => s + Number(p.amount), 0);
      const brandTotal   = payments.filter(p => p.company_type === 'brand').reduce((s, p) => s + Number(p.amount), 0);

      ws2.addRow({});
      const r1 = ws2.addRow({ name: 'TOPLAM GELİR', amount: total });
      r1.font = { bold: true };
      const r2 = ws2.addRow({ name: 'Ajans Geliri', amount: agencyTotal });
      r2.font = { italic: true };
      const r3 = ws2.addRow({ name: 'Marka Geliri', amount: brandTotal });
      r3.font = { italic: true };
    }

    // ── Sheet 3: AI Kullanım Özeti ──────────────────────────────────────────
    const ws3 = workbook.addWorksheet('AI Kullanım Özeti');
    ws3.columns = [
      { header: 'Şirket Adı',    key: 'company',   width: 32 },
      { header: 'Özellik',       key: 'feature',   width: 20 },
      { header: 'İstek Sayısı',  key: 'requests',  width: 14 },
      { header: 'Maliyet (USD)', key: 'cost_usd',  width: 18 },
      { header: 'Maliyet (TRY)', key: 'cost_try',  width: 18 },
    ];
    applyHeaderStyle(ws3.getRow(1));

    aiUsage.forEach(r => {
      const row = ws3.addRow({
        company:  r.company_name,
        feature:  FEATURE_LABELS[r.feature] || r.feature,
        requests: r.requests,
        cost_usd: Number(r.cost_usd),
        cost_try: Number(r.cost_try),
      });
      row.height = 18;
    });
    ws3.getColumn('cost_usd').numFmt = '$#,##0.0000';
    ws3.getColumn('cost_try').numFmt = '#,##0.00 ₺';

    // ── Send ───────────────────────────────────────────────────────────────
    const filename = `AdsLands_Rapor_${year}_${String(mon).padStart(2, '0')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('admin export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Rapor oluşturulamadı.' });
    }
  }
});

module.exports = router;
