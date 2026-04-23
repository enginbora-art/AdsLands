import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getMetrics = () => api.get('/metrics').then(r => r.data);
export const getWeeklySpend = () => api.get('/weekly-spend').then(r => r.data);
export const getRoas = () => api.get('/roas').then(r => r.data);
export const getSparklines = () => api.get('/sparklines').then(r => r.data);
export const getAnomalies = () => api.get('/anomalies').then(r => r.data);
export const getChannels = () => api.get('/channels').then(r => r.data);
export const getAiReport = () => api.get('/ai-report').then(r => r.data);
export const getTvBroadcast = () => api.get('/tv-broadcast').then(r => r.data);
export const getBudget = () => api.get('/budget').then(r => r.data);
export const getBudgetPlan = (month, year) => api.get(`/budgets?month=${month}&year=${year}`).then(r => r.data);
export const saveBudgetPlan = (data) => api.post('/budgets', data).then(r => r.data);
export const getBenchmark = () => api.get('/benchmark').then(r => r.data);
export const getReports = () => api.get('/reports').then(r => r.data);
export const getAgency = () => api.get('/agency').then(r => r.data);
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data);

export const register = (data) => api.post('/auth/register', data).then(r => r.data);
export const login = (data) => api.post('/auth/login', data).then(r => r.data);
export const sendInvitation = (receiver_email) => api.post('/invitations/send', { receiver_email }).then(r => r.data);
export const getInvitation = (token) => api.get(`/invitations/${token}`).then(r => r.data);
export const acceptInvitation = (data) => api.post('/invitations/accept', data).then(r => r.data);

// Entegrasyonlar
export const getIntegrations = () => api.get('/integrations').then(r => r.data);
export const connectIntegration = async (platform) => {
  if (platform === 'google_analytics' || platform === 'google_ads') {
    const { authUrl } = await api.get(`/integrations/google/connect?platform=${platform}`).then(r => r.data);
    window.location.href = authUrl;
  } else {
    window.location.href = `${import.meta.env.VITE_API_URL}/integrations/${platform}/connect`;
  }
};
export const disconnectIntegration = (id) => api.delete(`/integrations/${id}`).then(r => r.data);
export const disconnectGoogleIntegration = (platform) =>
  api.delete(`/integrations/google?platform=${platform}`).then(r => r.data);
export const getIntegrationMetrics = (id) => api.get(`/integrations/${id}/metrics`).then(r => r.data);
export const getGoogleData = (platform) =>
  api.get(`/integrations/google/data?platform=${platform}`).then(r => r.data);

// Dashboard
export const getBrandDashboard = () => api.get('/dashboard/brand').then(r => r.data);
export const getAgencyDashboard = () => api.get('/dashboard/agency').then(r => r.data);
export const getDashboardAnomalies = () => api.get('/dashboard/anomalies').then(r => r.data);

// Şifre kurulumu
export const getSetup = (token) => api.get(`/auth/setup/${token}`).then(r => r.data);
export const completeSetup = (data) => api.post('/auth/setup', data).then(r => r.data);

// Admin
export const adminGetBrands = () => api.get('/admin/brands').then(r => r.data);
export const adminCreateBrand = (data) => api.post('/admin/brands', data).then(r => r.data);
export const adminGetAgencies = () => api.get('/admin/agencies').then(r => r.data);
export const adminCreateAgency = (data) => api.post('/admin/agencies', data).then(r => r.data);
export const adminToggleActive = (id) => api.patch(`/admin/users/${id}/toggle-active`).then(r => r.data);

// Kullanıcı listeleri
export const listBrands = () => api.get('/brands').then(r => r.data);
export const listAgencies = () => api.get('/agencies').then(r => r.data);
