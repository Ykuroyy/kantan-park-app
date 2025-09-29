import axios from 'axios';

// API設定 - 同じサーバーからのレスポンスなので相対パス使用
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;