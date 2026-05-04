import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (data) => api.post('/auth/login', data).then(r => r.data);
export const register = (data) => api.post('/auth/register', data).then(r => r.data);
export const getSetup = (token) => api.get(`/auth/setup/${token}`).then(r => r.data);
export const completeSetup = (data) => api.post('/auth/setup', data).then(r => r.data);
export const getInvitation = (token) => api.get(`/auth/invite/${token}`).then(r => r.data);
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email }).then(r => r.data);
export const resetPassword = (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }).then(r => r.data);
export const changePassword = (currentPassword, newPassword) => api.patch('/users/me/password', { currentPassword, newPassword }).then(r => r.data);

// ── Platform Admin ────────────────────────────────────────────────────────────
export const adminGetCompanies = () => api.get('/admin/companies').then(r => r.data);
export const adminCreateCompany = (data) => api.post('/admin/companies', data).then(r => r.data);
export const adminUpdateCompany = (id, data) => api.patch(`/admin/companies/${id}`, data).then(r => r.data);
export const adminGetCompany = (id) => api.get(`/admin/companies/${id}`).then(r => r.data);
export const adminToggleUser = (id) => api.patch(`/admin/users/${id}/toggle`).then(r => r.data);
export const adminGetAiUsage      = (month) => api.get(`/admin/ai-usage${month ? `?month=${month}` : ''}`).then(r => r.data);
export const adminExportReport    = async (month) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/reports/export?month=${month}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export başarısız.');
  return res.blob();
};
export const adminGetAiQueue      = ()      => api.get('/admin/ai-queue').then(r => r.data);
export const adminClearAiQueue    = ()      => api.post('/admin/ai-queue/clear').then(r => r.data);
export const adminSetAiConcurrency = (n)   => api.post('/admin/ai-queue/concurrency', { concurrency: n }).then(r => r.data);
export const adminGetPlanPrices    = ()    => api.get('/admin/plan-prices').then(r => r.data);
export const adminUpdatePlanPrice  = (key, data) => api.put(`/admin/plan-prices/${key}`, data).then(r => r.data);
export const adminGetAppSettings   = ()    => api.get('/admin/app-settings').then(r => r.data);
export const adminUpdateAppSetting = (key, value) => api.put(`/admin/app-settings/${key}`, { value }).then(r => r.data);
export const adminGetBenchmarks    = ()    => api.get('/admin/benchmarks').then(r => r.data);
export const adminUpdateBenchmark  = (id, value)  => api.put(`/admin/benchmarks/${id}`, { value }).then(r => r.data);
export const getAiUsageToday      = ()      => api.get('/ai/usage-today').then(r => r.data);
export const getAiQueueStatus     = ()      => api.get('/ai/queue-status').then(r => r.data);

// ── Şirket Yönetimi ───────────────────────────────────────────────────────────
export const getCompanyUsers = () => api.get('/company/users').then(r => r.data);
export const inviteCompanyUser = (data) => api.post('/company/users/invite', data).then(r => r.data);
export const toggleCompanyUser = (id) => api.patch(`/company/users/${id}/toggle`).then(r => r.data);
export const assignUserRole = (userId, roleId) => api.patch(`/company/users/${userId}/role`, { role_id: roleId }).then(r => r.data);

export const getCompanyRoles = () => api.get('/company/roles').then(r => r.data);
export const createRole = (data) => api.post('/company/roles', data).then(r => r.data);
export const updateRole = (id, data) => api.put(`/company/roles/${id}`, data).then(r => r.data);
export const deleteRole = (id) => api.delete(`/company/roles/${id}`).then(r => r.data);
export const getPermissions = () => api.get('/company/permissions').then(r => r.data);

// ── Davetler & Bağlantılar ────────────────────────────────────────────────────
export const getInvitations = () => api.get('/invitations').then(r => r.data);
export const getSentInvitations = () => api.get('/invitations/sent').then(r => r.data);
export const getConnectableCompanies = () => api.get('/invitations/companies').then(r => r.data);
export const getConnections = () => api.get('/invitations/connections').then(r => r.data);
export const sendInvitation = (data) => api.post('/invitations/send', data).then(r => r.data);
export const acceptInvitation = (id) => api.post(`/invitations/${id}/accept`).then(r => r.data);
export const rejectInvitation = (id) => api.post(`/invitations/${id}/reject`).then(r => r.data);

// ── Bildirimler ───────────────────────────────────────────────────────────────
export const getNotifications = () => api.get('/notifications').then(r => r.data);
export const getUnreadCount = () => api.get('/notifications/unread-count').then(r => r.data);
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`).then(r => r.data);
export const markAllRead = () => api.post('/notifications/read-all').then(r => r.data);

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getBrandDashboard = () => api.get('/dashboard/brand').then(r => r.data);
export const getAgencyDashboard = () => api.get('/dashboard/agency').then(r => r.data);
export const getAgencyBrandDetail = (brandId) => api.get(`/dashboard/agency/brand/${brandId}`).then(r => r.data);
export const getDashboardAnomalies = () => api.get('/dashboard/anomalies').then(r => r.data);
export const resolveAnomaly = (id) => api.patch(`/dashboard/anomalies/${id}/resolve`).then(r => r.data);
export const getAnomalySettings = () => api.get('/dashboard/anomaly-settings').then(r => r.data);
export const saveAnomalySettings = (data) => api.post('/dashboard/anomaly-settings', data).then(r => r.data);

export const benchmarkAnalyze = (metrics, sector) =>
  fetch(`${import.meta.env.VITE_API_URL}/benchmark/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ metrics, sector }),
  });

// ── Entegrasyonlar ────────────────────────────────────────────────────────────
export const getIntegrations = (brandId) =>
  api.get(`/integrations${brandId ? `?brand_id=${brandId}` : ''}`).then(r => r.data);

export const connectIntegration = async (platform, brandId) => {
  const b = brandId ? `&brand_id=${brandId}` : '';
  if (platform === 'google_analytics' || platform === 'google_ads') {
    const { authUrl } = await api.get(`/integrations/google/connect?platform=${platform}${b}`).then(r => r.data);
    window.location.href = authUrl;
  } else if (platform === 'linkedin') {
    const { authUrl } = await api.get(`/integrations/linkedin/connect${brandId ? `?brand_id=${brandId}` : ''}`).then(r => r.data);
    window.location.href = authUrl;
  } else {
    window.location.href = `${import.meta.env.VITE_API_URL}/integrations/${platform}/connect${brandId ? `?brand_id=${brandId}` : ''}`;
  }
};
export const disconnectIntegration = (id) => api.delete(`/integrations/${id}`).then(r => r.data);
export const disconnectGoogleIntegration = (platform, brandId) =>
  api.delete(`/integrations/google?platform=${platform}${brandId ? `&brand_id=${brandId}` : ''}`).then(r => r.data);
export const getIntegrationMetrics = (id) => api.get(`/integrations/${id}/metrics`).then(r => r.data);
export const logVerify = (integration_id, action) =>
  api.post('/integrations/log-verify', { integration_id, action }).then(r => r.data);
export const getGoogleData = (platform) =>
  api.get(`/integrations/google/data?platform=${platform}`).then(r => r.data);
export const connectAppsflyer = (data) => api.post('/integrations/appsflyer/connect', data).then(r => r.data);
export const connectAdjust    = (data) => api.post('/integrations/adjust/connect', data).then(r => r.data);
export const connectAdform    = (data) => api.post('/integrations/adform/connect', data).then(r => r.data);

// ── AI Raporları ──────────────────────────────────────────────────────────────
export const getReports    = (brandId) =>
  api.get(`/reports${brandId ? `?brand_id=${brandId}` : ''}`).then(r => r.data);
export const saveReport    = (data) => api.post('/reports', data).then(r => r.data);
export const deleteReport  = (id) => api.delete(`/reports/${id}`).then(r => r.data);
export const buildReport   = (data) => api.post('/reports/build', data).then(r => r.data);

// ── Kanallar ──────────────────────────────────────────────────────────────────
export const getChannelData = (days, platform, brandId) =>
  api.get(`/channels?days=${days}&platform=${platform || 'all'}${brandId ? `&brand_id=${brandId}` : ''}`).then(r => r.data);

// ── MCC ───────────────────────────────────────────────────────────────────────
export const getMccAuthUrl = () => api.get('/mcc/connect').then(r => r.data);
export const getMccAccounts = (session) => api.get(`/mcc/accounts?session=${session}`).then(r => r.data);
export const importMccAccounts = (data) => api.post('/mcc/import', data).then(r => r.data);

// ── Meta Business Manager ─────────────────────────────────────────────────────
export const getMetaBmAuthUrl = () => api.get('/metabm/connect').then(r => r.data);
export const getMetaBmAccounts = (session) => api.get(`/metabm/accounts?session=${session}`).then(r => r.data);
export const importMetaBmAccounts = (data) => api.post('/metabm/import', data).then(r => r.data);

// ── Bütçe ─────────────────────────────────────────────────────────────────────
export const getBudgetPlan = (month, year, brandId) =>
  api.get(`/budgets?month=${month}&year=${year}${brandId ? `&brand_id=${brandId}` : ''}`).then(r => r.data);
export const saveBudgetPlan = (data) => api.post('/budgets', data).then(r => r.data);
export const getBudgetLogs = (limit = 10) => api.get(`/budgets/logs?limit=${limit}`).then(r => r.data);
export const getBudgetBrands = () => api.get('/budgets/brands').then(r => r.data);

// ── Activity Logs ─────────────────────────────────────────────────────────────
export const getLogs      = (params = {}) => api.get('/logs', { params }).then(r => r.data);
export const getLogsUsers = ()            => api.get('/logs/users').then(r => r.data);

// ── Şirket Listeleri ──────────────────────────────────────────────────────────
export const listBrands = () => api.get('/brands').then(r => r.data);
export const listAgencies = () => api.get('/agencies').then(r => r.data);

// ── Eski uyumluluk (Agency.jsx, Settings.jsx) ─────────────────────────────────
export const inviteBrand = (data) => sendInvitation({ receiver_email: data.email, company_name: data.company_name });
export const getSettings = (brandId) =>
  api.get(`/company/settings${brandId ? `?brand_id=${brandId}` : ''}`).then(r => r.data);
export const updateSettings = (data) => api.put('/company/settings', data).then(r => r.data);
export const updateCompanySector = (id, sector) => api.patch(`/companies/${id}`, { sector }).then(r => r.data);
export const updateProfile = (data) => api.patch('/users/me', data).then(r => r.data);
export const getNotificationPrefs = () => api.get('/users/me/notification-prefs').then(r => r.data);
export const saveNotificationPrefs = (prefs) => api.patch('/users/me/notification-prefs', prefs).then(r => r.data);

// ── Ödeme & Abonelik ──────────────────────────────────────────────────────────
export const initiatePayment    = (data) => api.post('/payments/initiate', data).then(r => r.data);
export const getSubscription    = () => api.get('/payments/subscription').then(r => r.data);
export const cancelSubscription = () => api.post('/payments/cancel').then(r => r.data);
export const getPaymentHistory  = (month, page = 1, limit = 5) => {
  const params = new URLSearchParams({ page, limit });
  if (month) params.set('month', month);
  return api.get(`/payments/history?${params}`).then(r => r.data);
};
export const downloadInvoice    = (transactionId) => {
  const token = localStorage.getItem('token');
  return `${import.meta.env.VITE_API_URL}/payments/invoice/${transactionId}?token=${token}`;
};

// ── TV Medya Planı ────────────────────────────────────────────────────────────
export const getTvCampaigns    = (brandId) => api.get(`/tv/campaigns${brandId ? `?brandId=${brandId}` : ''}`).then(r => r.data);
export const createTvCampaign  = (data) => api.post('/tv/campaigns', data).then(r => r.data);
export const getTvPlans        = (brandId) => api.get(`/tv/plans${brandId ? `?brandId=${brandId}` : ''}`).then(r => r.data);
export const createTvPlan      = (data) => api.post('/tv/plans', data).then(r => r.data);
export const updateTvPlan      = (id, data) => api.patch(`/tv/plans/${id}`, data).then(r => r.data);
export const deleteTvPlan      = (id) => api.delete(`/tv/plans/${id}`).then(r => r.data);
export const getTvPlanItems    = (planId) => api.get(`/tv/plans/${planId}/items`).then(r => r.data);
export const addTvPlanItem     = (planId, data) => api.post(`/tv/plans/${planId}/items`, data).then(r => r.data);
export const updateTvPlanItem  = (planId, itemId, data) => api.patch(`/tv/plans/${planId}/items/${itemId}`, data).then(r => r.data);
export const deleteTvPlanItem  = (planId, itemId) => api.delete(`/tv/plans/${planId}/items/${itemId}`).then(r => r.data);
export const getTvPlanSummary    = (planId) => api.get(`/tv/plans/${planId}/summary`).then(r => r.data);
export const getTvAiSuggestions  = (planId) => api.post(`/tv/plans/${planId}/ai-suggest`).then(r => r.data);
export const applyTvAiSuggestion = (planId, action) => api.post(`/tv/plans/${planId}/ai-apply`, action).then(r => r.data);

// ── Metrik Güncellemesi ───────────────────────────────────────────────────────
export const getLastUpdated = () => api.get('/metrics/last-updated').then(r => r.data);
export const refreshMetrics = () => api.post('/metrics/refresh').then(r => r.data);

// ── Kampanyalar ───────────────────────────────────────────────────────────────
export const getCampaigns          = (params = {}) => {
  const q = new URLSearchParams();
  if (params.brand_id) q.set('brand_id', params.brand_id);
  if (params.status)   q.set('status', params.status);
  return api.get(`/campaigns${q.toString() ? `?${q}` : ''}`).then(r => r.data);
};
export const createCampaign        = (data) => api.post('/campaigns', data).then(r => r.data);
export const getCampaign           = (id) => api.get(`/campaigns/${id}`).then(r => r.data);
export const updateCampaign        = (id, data) => api.put(`/campaigns/${id}`, data).then(r => r.data);
export const deleteCampaign        = (id) => api.delete(`/campaigns/${id}`).then(r => r.data);
export const addCampaignChannel    = (id, data) => api.post(`/campaigns/${id}/channels`, data).then(r => r.data);
export const removeCampaignChannel = (id, channelId) => api.delete(`/campaigns/${id}/channels/${channelId}`).then(r => r.data);
export const getPlatformCampaigns  = (id, platform, search) =>
  api.get(`/campaigns/${id}/platform-campaigns?platform=${platform}${search ? `&search=${encodeURIComponent(search)}` : ''}`).then(r => r.data);
