import axios from 'axios';
import { useAuthStore } from '../stores/authStore.ts';
import { API_URL } from '../config';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add the auth token
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle token expiry / 401s
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Detect if this is an administrative context
        const isDeveloperSecretUsed = error.config?.headers?.['X-Developer-Secret'];
        const isDeveloperUrl = error.config?.url?.includes('/developer-admin');
        const isCurrentlyInAdminPanel = window.location.pathname.includes('/developer-admin');

        // Do NOT redirect or logout if we are in the developer terminal
        if (error.response?.status === 401 && !isDeveloperSecretUsed && !isDeveloperUrl && !isCurrentlyInAdminPanel) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);
