import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useTranslation } from '../../i18n';
import { BarChart3, Undo2 } from 'lucide-react';

interface ChatPanelProps {
    context: 'dashboard' | 'reports';
}

export default function ChatPanel({ context }: ChatPanelProps) {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const messages = useChatStore((s) => s.conversations[context]);
    const isLoading = useChatStore((s) => s.isLoading);
    const sendMessage = useChatStore((s) => s.sendMessage);
    const restoreChartFromMessage = useChatStore((s) => s.restoreChartFromMessage);
    const deleteTurn = useChatStore((s) => s.deleteTurn);
    const quota = useChatStore((s) => s.quota);
    const fetchQuota = useChatStore((s) => s.fetchQuota);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, isLoading]);

    useEffect(() => {
        fetchQuota().catch(() => { /* quota banner just stays hidden if this fails */ });
    }, [fetchQuota]);

    const atCap = !!quota && quota.used >= quota.limit;

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading || atCap) return;
        setInput('');
        await sendMessage(context, text);
        fetchQuota().catch(() => {});
    };

    return (
        <div className="chat-panel" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column',
            height: 280,
        }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                {t('aiChat.title', 'Ask your data')}
                {context === 'dashboard' && (
                    <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {t('aiChat.dashboardHint', '— answers update the chart above')}
                    </span>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {t('aiChat.placeholder', 'Try: "What month had the highest Electricity Consumption in 2026?"')}
                    </div>
                )}
                {messages.map((msg, idx) => {
                    const canRestore = context === 'dashboard' && msg.role === 'assistant' && !!msg.chart;
                    return (
                        <div key={idx} style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%',
                            display: 'flex', alignItems: 'center', gap: 4,
                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                        }}>
                            <div
                                onClick={canRestore ? () => restoreChartFromMessage(msg.chart!, msg.sourceQuestion || '', msg.content) : undefined}
                                style={{
                                    background: msg.role === 'user'
                                        ? 'var(--accent-green)'
                                        : msg.isFallback ? 'rgba(251, 191, 36, 0.1)' : 'var(--bg-elevated)',
                                    border: msg.isFallback ? '1px solid rgba(251, 191, 36, 0.3)' : 'none',
                                    color: msg.role === 'user' ? '#04140d' : 'var(--text-primary)',
                                    borderRadius: 12, padding: '8px 12px', fontSize: 13.5, lineHeight: 1.4,
                                    cursor: canRestore ? 'pointer' : 'default',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}
                                title={canRestore ? t('aiChat.restoreHint', 'Click to show this chart again') : undefined}
                            >
                                {canRestore && <BarChart3 size={13} style={{ flexShrink: 0, opacity: 0.7 }} />}
                                <span>{msg.content}</span>
                            </div>
                            {msg.role === 'user' && (
                                <button
                                    onClick={() => deleteTurn(context, idx)}
                                    aria-label={t('aiChat.undoTurn', 'Undo this question and its answer')}
                                    title={t('aiChat.undoTurn', 'Undo this question and its answer')}
                                    style={{
                                        background: 'none', border: 'none', color: 'var(--text-muted)',
                                        cursor: 'pointer', display: 'flex', padding: 2, flexShrink: 0, opacity: 0.6,
                                    }}
                                >
                                    <Undo2 size={13} style={{ transform: 'scaleX(-1)' }} />
                                </button>
                            )}
                        </div>
                    );
                })}
                {isLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('aiChat.thinking', 'Thinking...')}</div>}
                <div ref={messagesEndRef} />
            </div>

            {atCap && (
                <div style={{
                    padding: '8px 16px', fontSize: 12.5, color: '#fbbf24',
                    background: 'rgba(251,191,36,0.08)', borderTop: '1px solid rgba(251,191,36,0.2)',
                }}>
                    {t('aiChat.quotaReached', "You've reached today's question limit — try again tomorrow.")}
                </div>
            )}
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder={t('aiChat.inputPlaceholder', 'Ask a question about your data...')}
                    disabled={isLoading || atCap}
                />
                <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={isLoading || atCap || !input.trim()}>
                    {t('aiChat.send', 'Ask')}
                </button>
            </div>
        </div>
    );
}
