import axios from 'axios';

// Use environment variable for API URL in production, fallback to relative path
const apiBaseURL = import.meta.env.VITE_API_URL || '/api';
console.log('🔧 API Base URL:', apiBaseURL);
export const api = axios.create({ baseURL: apiBaseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});


