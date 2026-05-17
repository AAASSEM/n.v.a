import axios from 'axios';
import { useAuthStore } from '../stores/authStore.ts';
import { useSiteStore } from '../stores/siteStore.ts';
import { API_URL } from '../config';
import type { Site } from '../types/site';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Endpoints whose payload is implicitly scoped to the caller's "current site".
 * The interceptor below auto-injects `?site_id=<currentSiteId>` for these paths
 * so every page doesn't need to plumb it through manually. Absolute paths, no
 * leading baseURL.
 */
const SITE_SCOPED_PATH_PREFIXES = [
    '/meters',
    '/submissions',
    '/profiling/answers',
    '/profiling/questions',
    '/profiling/checklist',
    '/users/company',
    '/dashboard',
    '/reports',
];

function pathIsSiteScoped(url: string | undefined): boolean {
    if (!url) return false;
    // Strip any leading baseURL or query string before matching.
    const noQuery = url.split('?')[0];
    const path = noQuery.startsWith(API_URL) ? noQuery.slice(API_URL.length) : noQuery;
    return SITE_SCOPED_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

// Request interceptor: auth + auto site_id injection
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Auto-attach current site_id for site-scoped endpoints, unless the
        // caller already supplied one explicitly.
        if (pathIsSiteScoped(config.url)) {
            const siteId = useSiteStore.getState().currentSiteId;
            if (siteId != null) {
                config.params = config.params || {};
                if (config.params.site_id == null) {
                    config.params.site_id = siteId;
                }
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle token expiry / 401s
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isDeveloperSecretUsed = error.config?.headers?.['X-Developer-Secret'];
        const isDeveloperUrl = error.config?.url?.includes('/developer-admin');
        const isCurrentlyInAdminPanel = window.location.pathname.includes('/developer-admin');

        if (error.response?.status === 401 && !isDeveloperSecretUsed && !isDeveloperUrl && !isCurrentlyInAdminPanel) {
            useAuthStore.getState().logout();
            useSiteStore.getState().reset();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ---------------------------------------------------------------------------
// Site management API
// ---------------------------------------------------------------------------
export const sitesApi = {
    list: () => api.get<Site[]>('/sites/').then((r) => r.data),
    create: (payload: { name: string; location?: string | null }) =>
        api.post<Site>('/sites/', payload).then((r) => r.data),
    update: (id: number, payload: { name?: string; location?: string | null; is_active?: boolean }) =>
        api.put<Site>(`/sites/${id}`, payload).then((r) => r.data),
    deactivate: (id: number) => api.delete<{ msg: string; id: number; is_active: boolean }>(`/sites/${id}`).then((r) => r.data),
};
