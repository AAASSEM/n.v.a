import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Site } from '../types/site';

interface SiteState {
    /** The effective current site for all site-scoped API calls. */
    currentSiteId: number | null;
    /** Sites visible to the current user (one if site-pinned, all if admin). */
    sites: Site[];
    /** True once we've attempted to fetch sites after login. */
    hydrated: boolean;

    setCurrentSiteId: (id: number | null) => void;
    setSites: (sites: Site[]) => void;
    setHydrated: (v: boolean) => void;
    reset: () => void;
}

export const useSiteStore = create<SiteState>()(
    persist(
        (set) => ({
            currentSiteId: null,
            sites: [],
            hydrated: false,

            setCurrentSiteId: (id) => set({ currentSiteId: id }),
            setSites: (sites) => set({ sites }),
            setHydrated: (v) => set({ hydrated: v }),
            reset: () => set({ currentSiteId: null, sites: [], hydrated: false }),
        }),
        {
            name: 'site-storage',
            // Only persist the last-selected id so an admin returns to the same site.
            partialize: (state) => ({ currentSiteId: state.currentSiteId }),
        }
    )
);
