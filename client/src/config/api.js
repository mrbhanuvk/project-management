import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_BASEURL,
});

api.interceptors.request.use(async (config) => {
    const token = await window.Clerk?.session?.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;