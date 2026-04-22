import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

export const getMetrics = () => api.get('/metrics').then(r => r.data);
export const getWeeklySpend = () => api.get('/weekly-spend').then(r => r.data);
export const getRoas = () => api.get('/roas').then(r => r.data);
export const getSparklines = () => api.get('/sparklines').then(r => r.data);
export const getAnomalies = () => api.get('/anomalies').then(r => r.data);
export const getChannels = () => api.get('/channels').then(r => r.data);
export const getAiReport = () => api.get('/ai-report').then(r => r.data);
export const getTvBroadcast = () => api.get('/tv-broadcast').then(r => r.data);
export const getBudget = () => api.get('/budget').then(r => r.data);
export const getBenchmark = () => api.get('/benchmark').then(r => r.data);
export const getReports = () => api.get('/reports').then(r => r.data);
export const getAgency = () => api.get('/agency').then(r => r.data);
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data);
