const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const migrate = require('./db/migrate');
const { startCronJobs } = require('./cron');

const routes = require('./routes');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'https://adslands-frontend.onrender.com', 'https://adslands.com', 'https://www.adslands.com'],
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
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
app.use('/api', routes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`AdsLands API running on http://localhost:${PORT}`);
  migrate()
    .then(() => startCronJobs())
    .catch((err) => console.error('⚠️ Migration hatası:', err.message));
});
