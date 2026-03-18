import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info' | 'danger';
    confirmLabel?: string;
    secondaryConfirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean; // Legacy prop, mapped to type='danger'
    onConfirm: () => void;
    onSecondaryConfirm?: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    type = 'info',
    confirmLabel = 'Confirm',
    secondaryConfirmLabel,
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onSecondaryConfirm,
    onCancel,
}: ConfirmModalProps) {
    if (!isOpen) return null;

    // Map danger prop to type
    const modalType = danger ? 'danger' : type;

    const getIcon = () => {
        switch (modalType) {
            case 'success':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                );
            case 'error':
            case 'danger':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                );
            default: // info
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                );
        }
    };

    const getTypeStyles = () => {
        switch (modalType) {
            case 'success':
                return { bg: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', btn: 'btn-success' };
            case 'error':
            case 'danger':
                return { bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171', btn: 'btn-danger' };
            case 'warning':
                return { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', btn: 'btn-amber' };
            default:
                return { bg: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', btn: 'btn-primary' };
        }
    };

    const styles = getTypeStyles();

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal modal-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '12px',
                            background: styles.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: styles.color,
                            flexShrink: 0,
                        }}>
                            {getIcon()}
                        </div>
                        <span className="modal-title" style={{ fontSize: 18, fontWeight: 800 }}>{title}</span>
                    </div>
                    <button className="modal-close" onClick={onCancel}>✕</button>
                </div>
                <div className="modal-body">
                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6, marginTop: 8 }}>{message}</p>
                </div>
                <div className="modal-footer" style={{ marginTop: 24 }}>
                    <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {onSecondaryConfirm && secondaryConfirmLabel && (
                            <button
                                className="btn btn-secondary"
                                onClick={onSecondaryConfirm}
                            >
                                {secondaryConfirmLabel}
                            </button>
                        )}
                        <button
                            className={`btn ${styles.btn}`}
                            style={modalType === 'success' ? { background: '#22c55e', color: 'white' } : {}}
                            onClick={onConfirm}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
