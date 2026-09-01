import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import type { ChatMessage, ChartSpec, AIDashboardItem, ViewDirectives, QuotaInfo } from '../types/aiChat';

type ChatContext = 'dashboard' | 'reports';

interface ChatState {
    conversations: Record<ChatContext, ChatMessage[]>;
    isLoading: boolean;
    dashboardItems: AIDashboardItem[];

    // The Dashboard page's main chart card renders this instead of its normal computed
    // chart whenever it's set — asking a question replaces what the main chart shows,
    // rather than the chat producing its own separate mini-chart (per product decision).
    dashboardChartOverride: ChartSpec | null;
    dashboardAnswerText: string | null;
    dashboardSourceQuestion: string | null;
    // The id of the pinned dashboard item that corresponds to the answer currently shown
    // (null if not pinned). Tracking the specific id — not just a boolean — means removing
    // an unrelated pinned item never affects this, but removing *this* one correctly makes
    // the answer pinnable again.
    dashboardOverridePinnedItemId: number | null;

    // A pending proposal from the AI to change the Dashboard's view filters — set
    // whenever an answer implies one, cleared on Apply or Dismiss. Never applied
    // automatically: Dashboard.tsx owns actually applying it (it holds the 8 filter
    // setters + the site store), this just holds the proposal in transit.
    pendingDirectives: ViewDirectives | null;
    dismissPendingDirectives: () => void;

    quota: QuotaInfo | null;
    fetchQuota: () => Promise<void>;

    sendMessage: (context: ChatContext, text: string) => Promise<void>;
    resetConversation: (context: ChatContext) => void;
    // Deletes a user message at `userIndex` together with its paired assistant reply
    // (the following message, if one exists) — see implementation for rationale.
    deleteTurn: (context: ChatContext, userIndex: number) => void;
    clearDashboardOverride: () => void;
    // Brings a past answer's chart back as the main chart override — lets the chat log
    // act as real, usable history instead of the chart being lost once superseded.
    restoreChartFromMessage: (chart: ChartSpec, sourceQuestion: string, answerText: string) => void;

    fetchDashboardItems: () => Promise<void>;
    pinChart: (chart: ChartSpec, title: string, sourceQuestion: string) => Promise<number>;
    pinCurrentDashboardAnswer: () => Promise<void>;
    removeDashboardItem: (id: number) => Promise<void>;
}

// Cap how much history round-trips to the backend and gets persisted locally.
const MAX_HISTORY = 10;

// A directives object with every field null/undefined means the question didn't
// imply any view change — treat it as "no proposal" rather than showing an empty card.
function _hasAnyDirective(directives: ViewDirectives | null): boolean {
    if (!directives) return false;
    return Object.values(directives).some((v) => v !== null && v !== undefined);
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            conversations: { dashboard: [], reports: [] },
            isLoading: false,
            dashboardItems: [],
            dashboardChartOverride: null,
            dashboardAnswerText: null,
            dashboardSourceQuestion: null,
            dashboardOverridePinnedItemId: null,
            pendingDirectives: null,
            quota: null,

            dismissPendingDirectives: () => set({ pendingDirectives: null }),

            fetchQuota: async () => {
                const res = await api.get('/ai-chat/quota');
                set({ quota: { used: res.data.used_today, limit: res.data.limit } });
            },

            sendMessage: async (context, text) => {
                const userMsg: ChatMessage = { role: 'user', content: text };
                set((state) => ({
                    isLoading: true,
                    conversations: {
                        ...state.conversations,
                        [context]: [...state.conversations[context], userMsg].slice(-MAX_HISTORY),
                    },
                }));

                try {
                    const res = await api.post('/ai-chat/query', { message: text, context });
                    const charts: ChartSpec[] = res.data.charts || [];
                    const directives: ViewDirectives | null = res.data.view_directives || null;
                    const assistantMsg: ChatMessage = {
                        role: 'assistant',
                        content: res.data.answer_text,
                        chart: charts[0] || null,
                        sourceQuestion: text,
                        isFallback: !!res.data.is_fallback,
                    };
                    set((state) => ({
                        conversations: {
                            ...state.conversations,
                            [context]: [...state.conversations[context], assistantMsg].slice(-MAX_HISTORY),
                        },
                        quota: res.data.quota || state.quota,
                        // Only the Dashboard page has a main chart / filters to take over;
                        // Reports answers stay purely conversational for now.
                        ...(context === 'dashboard' ? {
                            dashboardChartOverride: charts[0] || null,
                            dashboardAnswerText: res.data.answer_text,
                            dashboardSourceQuestion: text,
                            dashboardOverridePinnedItemId: null,
                            pendingDirectives: _hasAnyDirective(directives) ? directives : null,
                        } : {}),
                    }));
                } catch (err: any) {
                    // The 429 quota response nests its message as {detail: {detail, resets_at}}
                    // rather than a plain string — unwrap either shape.
                    const raw = err.response?.data?.detail;
                    const detail = (raw && typeof raw === 'object' ? raw.detail : raw)
                        || "Sorry, I couldn't process that question.";
                    const errorMsg: ChatMessage = { role: 'assistant', content: detail };
                    set((state) => ({
                        conversations: {
                            ...state.conversations,
                            [context]: [...state.conversations[context], errorMsg].slice(-MAX_HISTORY),
                        },
                    }));
                } finally {
                    set({ isLoading: false });
                }
            },

            resetConversation: (context) => {
                set((state) => ({ conversations: { ...state.conversations, [context]: [] } }));
            },

            // Deletes a user question together with its paired assistant reply (the next
            // message, if one exists yet — it might not, if the answer is still loading
            // or failed to arrive). A lone AI answer with no question isn't meaningful on
            // its own, so there's no way to delete just the reply — only the whole turn.
            deleteTurn: (context, userIndex) => {
                set((state) => {
                    const convo = state.conversations[context];
                    const reply = convo[userIndex + 1];
                    const hasReply = reply?.role === 'assistant';
                    const updated = convo.filter((_, i) => i !== userIndex && !(hasReply && i === userIndex + 1));

                    const clearingOverride = context === 'dashboard'
                        && hasReply
                        && !!reply.chart
                        && reply.chart === state.dashboardChartOverride;

                    return {
                        conversations: { ...state.conversations, [context]: updated },
                        ...(clearingOverride ? {
                            dashboardChartOverride: null,
                            dashboardAnswerText: null,
                            dashboardSourceQuestion: null,
                            dashboardOverridePinnedItemId: null,
                        } : {}),
                    };
                });
            },

            clearDashboardOverride: () => {
                set({
                    dashboardChartOverride: null, dashboardAnswerText: null,
                    dashboardSourceQuestion: null, dashboardOverridePinnedItemId: null,
                });
            },

            restoreChartFromMessage: (chart, sourceQuestion, answerText) => {
                // We don't track whether this specific past answer was already pinned
                // (only the single "current" one is tracked), so restoring it always
                // shows "Pin to Dashboard" again — re-pinning the same answer twice this
                // way would create a duplicate. Acceptable trade-off for now; flag if
                // this needs per-message pin tracking later.
                set({
                    dashboardChartOverride: chart,
                    dashboardAnswerText: answerText,
                    dashboardSourceQuestion: sourceQuestion,
                    dashboardOverridePinnedItemId: null,
                });
            },

            fetchDashboardItems: async () => {
                const res = await api.get('/ai-chat/dashboard-items');
                set({ dashboardItems: res.data });
            },

            pinChart: async (chart, title, sourceQuestion) => {
                const res = await api.post('/ai-chat/dashboard-items', { chart, title, source_question: sourceQuestion });
                await get().fetchDashboardItems();
                return res.data.id as number;
            },

            pinCurrentDashboardAnswer: async () => {
                const { dashboardChartOverride, dashboardSourceQuestion, dashboardOverridePinnedItemId } = get();
                if (!dashboardChartOverride || dashboardOverridePinnedItemId != null) return;
                const id = await get().pinChart(dashboardChartOverride, dashboardChartOverride.title, dashboardSourceQuestion || '');
                set({ dashboardOverridePinnedItemId: id });
            },

            removeDashboardItem: async (id) => {
                await api.delete(`/ai-chat/dashboard-items/${id}`);
                set((state) => ({
                    dashboardItems: state.dashboardItems.filter((i) => i.id !== id),
                    // If the item being removed is the one backing the currently-shown
                    // answer, make that answer pinnable again — otherwise leave it alone.
                    dashboardOverridePinnedItemId: state.dashboardOverridePinnedItemId === id
                        ? null
                        : state.dashboardOverridePinnedItemId,
                }));
            },
        }),
        {
            name: 'chat-storage',
            partialize: (state) => ({ conversations: state.conversations }),
        }
    )
);
