import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_URL } from '../config';
import type { User } from '../types/user.ts';
import { useSiteStore } from './siteStore.ts';
import type { Site } from '../types/site';


/**
 * Helper: read a cookie value by name from document.cookie.
 * Used to grab the csrf_token cookie (which is JS-readable).
 */
function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}


interface AuthState {
    user: User | null;
    csrfToken: string | null;       // In-memory only, NOT persisted
    isAuthenticated: boolean;
    isLoading: boolean;
    isTrialExpired: boolean;
    error: string | null;
    requestLoginLink: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchUser: () => Promise<void>;
    magicLinkLogin: (token: string) => Promise<void>;
    demoLogin: (email: string) => Promise<void>;
    resetPassword: (token: string, password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            csrfToken: null,
            isAuthenticated: false,
            isLoading: false,
            isTrialExpired: false,
            error: null,

            requestLoginLink: async (email: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_URL}/auth/request-login-link`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({ email }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Failed to request login link');
                    }
                } catch (error: unknown) {
                    const errMessage = error instanceof Error ? error.message : 'Failed to send magic link';
                    set({ error: errMessage });
                    throw error;
                } finally {
                    set({ isLoading: false });
                }
            },

            demoLogin: async (email: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_URL}/auth/demo-login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({ email }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Demo login failed');
                    }

                    const data = await response.json();
                    // Store the CSRF token in memory (from JSON body)
                    // Also read it from the cookie as a fallback
                    const csrf = data.csrf_token || getCookie('csrf_token');
                    set({ csrfToken: csrf, isAuthenticated: true });
                    await get().fetchUser();
                } catch (error: unknown) {
                    const errMessage = error instanceof Error ? error.message : 'Demo login failed';
                    set({ error: errMessage, isAuthenticated: false, csrfToken: null, user: null });
                    throw error;
                } finally {
                    set({ isLoading: false });
                }
            },

            magicLinkLogin: async (token: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_URL}/auth/magic-link/${token}`, {
                        method: 'POST',
                        credentials: 'include',
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Magic link verification failed');
                    }

                    const data = await response.json();

                    // Backend signals account is awaiting developer approval
                    if (data.token_type === 'pending_approval') {
                        set({ isLoading: false });
                        // Throw a special error that MagicLinkVerify can detect
                        throw new Error('PENDING_APPROVAL');
                    }

                    const csrf = data.csrf_token || getCookie('csrf_token');
                    set({ csrfToken: csrf, isAuthenticated: true });
                } catch (error: unknown) {
                    const errMessage = error instanceof Error ? error.message : 'Login failed';
                    if (errMessage !== 'PENDING_APPROVAL') {
                        set({ error: errMessage, isAuthenticated: false, csrfToken: null, user: null });
                    }
                    throw error;
                } finally {
                    set({ isLoading: false });
                }
            },

            resetPassword: async (token: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_URL}/auth/reset-password`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({ token, password }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Password reset failed');
                    }

                    const data = await response.json();
                    const csrf = data.csrf_token || getCookie('csrf_token');
                    set({ csrfToken: csrf, isAuthenticated: true });
                    await get().fetchUser();
                } catch (error: unknown) {
                    const errMessage = error instanceof Error ? error.message : 'Password reset failed';
                    set({ error: errMessage, isAuthenticated: false, csrfToken: null, user: null });
                    throw error;
                } finally {
                    set({ isLoading: false });
                }
            },

            logout: async () => {
                try {
                    await fetch(`${API_URL}/auth/logout`, {
                        method: 'POST',
                        credentials: 'include',
                    });
                } catch {
                    // Best-effort: if the server is down, still clear local state
                }
                set({ user: null, csrfToken: null, isAuthenticated: false, isTrialExpired: false });
                useSiteStore.getState().reset();
            },

            fetchUser: async () => {
                try {
                    // On page load, try to recover CSRF token from cookie if not in memory
                    if (!get().csrfToken) {
                        const cookieCsrf = getCookie('csrf_token');
                        if (cookieCsrf) {
                            set({ csrfToken: cookieCsrf });
                        }
                    }

                    // Cookie is sent automatically via credentials: 'include'
                    const csrfToken = get().csrfToken;
                    const headers: Record<string, string> = {};
                    if (csrfToken) {
                        headers['X-CSRF-Token'] = csrfToken;
                    }

                    // Run both requests in parallel to save network latency
                    const [meRes, sitesRes] = await Promise.all([
                        fetch(`${API_URL}/auth/me`, { credentials: 'include', headers }),
                        fetch(`${API_URL}/sites/`, { credentials: 'include', headers })
                    ]);
                    
                    if (!meRes.ok) {
                        // Check for trial expiry
                        if (meRes.status === 403) {
                            const errData = await meRes.json().catch(() => ({}));
                            if (errData.detail === 'TRIAL_EXPIRED') {
                                set({ isTrialExpired: true });
                                return;
                            }
                        }
                        throw new Error("Failed to fetch user");
                    }
                    const user = (await meRes.json()) as User;
                    set({ user });
                    
                    // Process sites
                    const siteStore = useSiteStore.getState();
                    if (!sitesRes.ok || !user.profile?.company_id) {
                        siteStore.setSites([]);
                        siteStore.setCurrentSiteId(null);
                        siteStore.setHydrated(true);
                        return;
                    }
                    
                    const sites = (await sitesRes.json()) as Site[];
                    siteStore.setSites(sites);

                    // Pin to user's site if any
                    if (user.profile?.site_id != null) {
                        siteStore.setCurrentSiteId(user.profile.site_id);
                    } else {
                        // Admin: keep persisted value if still valid, else first site
                        const persisted = siteStore.currentSiteId;
                        const stillValid = persisted != null && sites.some((s) => s.id === persisted);
                        if (!stillValid) {
                            siteStore.setCurrentSiteId(sites[0]?.id ?? null);
                        }
                    }
                    siteStore.setHydrated(true);
                } catch {
                    set({ user: null, csrfToken: null, isAuthenticated: false });
                    useSiteStore.getState().reset();
                }
            },
        }),
        {
            name: 'auth-storage',
            // Only persist isAuthenticated flag — NO tokens in localStorage
            partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
        }
    )
);
