import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_URL } from '../config';
import type { User, LoginCredentials } from '../types/user.ts';
import { useSiteStore } from './siteStore.ts';
import type { Site } from '../types/site';

async function hydrateSitesFor(user: User, token: string): Promise<void> {
    const siteStore = useSiteStore.getState();
    try {
        if (!user.profile?.company_id) {
            siteStore.setSites([]);
            siteStore.setCurrentSiteId(null);
            siteStore.setHydrated(true);
            return;
        }
        const res = await fetch(`${API_URL}/sites/`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            siteStore.setSites([]);
            siteStore.setHydrated(true);
            return;
        }
        const sites: Site[] = await res.json();
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
        siteStore.setHydrated(true);
    }
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    requestLoginLink: (email: string) => Promise<void>;
    logout: () => void;
    fetchUser: () => Promise<void>;
    magicLinkLogin: (token: string) => Promise<void>;
    demoLogin: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            requestLoginLink: async (email: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_URL}/auth/request-login-link`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
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
                        body: JSON.stringify({ email }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Demo login failed');
                    }

                    const data = await response.json();
                    set({ accessToken: data.access_token, isAuthenticated: true });
                    await get().fetchUser();
                } catch (error: unknown) {
                    const errMessage = error instanceof Error ? error.message : 'Demo login failed';
                    set({ error: errMessage, isAuthenticated: false, accessToken: null, user: null });
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
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Magic link verification failed');
                    }

                    const data = await response.json();
                    set({ accessToken: data.access_token, isAuthenticated: true });
                } catch (error: unknown) {
                    const errMessage = error instanceof Error ? error.message : 'Login failed';
                    set({ error: errMessage, isAuthenticated: false, accessToken: null, user: null });
                    throw error;
                } finally {
                    set({ isLoading: false });
                }
            },

            logout: () => {
                set({ user: null, accessToken: null, isAuthenticated: false });
                useSiteStore.getState().reset();
            },

            fetchUser: async () => {
                try {
                    const token = get().accessToken;
                    if (!token) throw new Error("No token");
                    const response = await fetch(`${API_URL}/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (!response.ok) throw new Error("Failed to fetch user");
                    const data = await response.json();
                    set({ user: data as User });
                    // Load the sites this user can see and pick a current site
                    await hydrateSitesFor(data as User, token);
                } catch {
                    set({ user: null, accessToken: null, isAuthenticated: false });
                    useSiteStore.getState().reset();
                }
            },
        }),
        {
            name: 'auth-storage',
            // only persist the token, we can refetch the user on load
            partialize: (state) => ({ accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
        }
    )
);
