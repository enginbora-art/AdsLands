const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const migrate = require('./db/migrate');
const { startCronJobs } = require('./cron');

const routes = require('./routes');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const adminReportsRoutes = require('./routes/adminReports');
const usersRoutes = require('./routes/users');
const companyRoutes = require('./routes/company');
const invitationRoutes = require('./routes/invitations');
const notificationRoutes = require('./routes/notifications');
const integrationRoutes = require('./routes/integrations');
const dashboardRoutes = require('./routes/dashboard');
const budgetRoutes = require('./routes/budgets');
const mccRoutes = require('./routes/mcc');
const metabmRoutes = require('./routes/metabm');
const channelsRoutes = require('./routes/channels');
const reportsRoutes    = require('./routes/reports');
const benchmarkRoutes  = require('./routes/benchmark');
const tvRoutes         = require('./routes/tv');
const paymentsRoutes   = require('./routes/payments');
const aiRoutes         = require('./routes/ai');
const metricsRoutes    = require('./routes/metrics');
const campaignRoutes   = require('./routes/campaigns');
const logsRoutes       = require('./routes/logs');

// ── Zorunlu env var kontrolü ──────────────────────────────────────────────────
const REQUIRED_ENV = ['FROM_EMAIL', 'ADMIN_EMAIL'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`[startup] Eksik zorunlu env var(lar): ${missingEnv.join(', ')}`);
  console.error('[startup] .env dosyanızı kontrol edin ve uygulamayı yeniden başlatın.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── Güvenlik başlıkları ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.adslands.com", "https://accounts.google.com"],
      fontSrc:    ["'self'", "https:"],
      objectSrc:  ["'none'"],
      // Sipay 3DS: tarayıcı form POST ile Sipay'a yönlendiriliyor (iframe değil)
      formAction: ["'self'", "https://provisioning.sipay.com.tr", "https://dummypos.sipay.com.tr", "https://app.sipay.com.tr"],
      frameAncestors: ["'self'"],
    },
  },
  frameguard:     { action: 'sameorigin' },
  hsts:           { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:        true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.disable('x-powered-by');

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://adslands.com', 'https://www.adslands.com']
  : ['https://adslands.com', 'https://www.adslands.com', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API Cache-Control (static asset'lere uygulanmaz) ─────────────────────────
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/reports', adminReportsRoutes);
app.use('/api', usersRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/mcc', mccRoutes);
app.use('/api/metabm', metabmRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/reports',   reportsRoutes);
app.use('/api/benchmark', benchmarkRoutes);
app.use('/api/tv',        tvRoutes);
app.use('/api/payments',  paymentsRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/metrics',   metricsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/logs',      logsRoutes);
app.use('/api', routes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`AdsLands API running on http://localhost:${PORT}`);
  migrate()
    .then(() => startCronJobs())
    .catch((err) => console.error('⚠️ Migration hatası:', err.message));
});
