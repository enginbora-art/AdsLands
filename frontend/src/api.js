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

// ── Platform Admin ────────────────────────────────────────────────────────────
export const adminGetCompanies = () => api.get('/admin/companies').then(r => r.data);
export const adminCreateCompany = (data) => api.post('/admin/companies', data).then(r => r.data);
export const adminUpdateCompany = (id, data) => api.patch(`/admin/companies/${id}`, data).then(r => r.data);
export const adminGetCompany = (id) => api.get(`/admin/companies/${id}`).then(r => r.data);
export const adminToggleUser = (id) => api.patch(`/admin/users/${id}/toggle`).then(r => r.data);

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

// ── Şirket Listeleri ──────────────────────────────────────────────────────────
export const listBrands = () => api.get('/brands').then(r => r.data);
export const listAgencies = () => api.get('/agencies').then(r => r.data);

// ── Eski uyumluluk (Agency.jsx, Settings.jsx) ─────────────────────────────────
export const inviteBrand = (data) => sendInvitation({ receiver_email: data.email, company_name: data.company_name });
export const getSettings = () => api.get('/company/settings').then(r => r.data);
export const updateSettings = (data) => api.put('/company/settings', data).then(r => r.data);
export const updateProfile = (data) => api.patch('/users/me', data).then(r => r.data);
