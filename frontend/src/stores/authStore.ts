import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_URL } from '../config';
import type { User, LoginCredentials } from '../types/user.ts';

interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
    fetchUser: () => Promise<void>;
    magicLinkLogin: (token: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (credentials) => {
                set({ isLoading: true, error: null });
                try {
                    const formData = new FormData();
                    formData.append('username', credentials.email);
                    formData.append('password', credentials.password);

                    // We use the raw axios instance here to avoid the interceptor loop
                    // since we are just obtaining the token
                    const response = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error('Invalid credentials');
                    }

                    const data = await response.json();
                    set({ accessToken: data.access_token, isAuthenticated: true });
                    await get().fetchUser();
                } catch (error: unknown) {
                    const errMessage = error instanceof Error ? error.message : 'Login failed';
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
                // Optional: Call backend logout endpoint to blacklist token
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
                } catch {
                    set({ user: null, accessToken: null, isAuthenticated: false });
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
