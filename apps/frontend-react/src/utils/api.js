import axios from 'axios';

// API 서버 기본 URL
const API_BASE_URL = 'http://127.0.0.1:4040';

// axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 요청 유틸리티 함수
export const api = {
  // 서버 상태 확인
  getStatus: async () => {
    return await apiClient.get('/api/status');
  },
  
  // GET 요청
  get: async (endpoint) => {
    return await apiClient.get(endpoint);
  },
  
  // POST 요청
  post: async (endpoint, data) => {
    return await apiClient.post(endpoint, data);
  },
  
  // PUT 요청
  put: async (endpoint, data) => {
    return await apiClient.put(endpoint, data);
  },
  
  // DELETE 요청
  delete: async (endpoint) => {
    return await apiClient.delete(endpoint);
  }
};

export default api; 