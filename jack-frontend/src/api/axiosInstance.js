import axios from 'axios';

const axiosInstance = axios.create({
  // Yahan apne backend ka URL daalna (abhi ke liye localhost hai)
  baseURL: 'http://localhost:5000/api', 
});

// Ye interceptor har request ke sath automatically token bhej dega
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;