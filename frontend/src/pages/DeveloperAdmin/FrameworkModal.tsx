import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface FrameworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: any;
    reqConfig: any;
}

export default function FrameworkModal({ isOpen, onClose, initialData, reqConfig }: FrameworkModalProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        framework_id: '',
        name: '',
        type: 'mandatory',
        region: 'Global',
        version: '1.0.0',
        description: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                framework_id: initialData.framework_id || '',
                name: initialData.name || '',
                type: initialData.type || 'mandatory',
                region: initialData.region || 'Global',
                version: initialData.version || '1.0.0',
                description: initialData.description || ''
            });
        } else {
            setFormData({
                framework_id: '',
                name: '',
                type: 'mandatory',
                region: 'Global',
                version: '1.0.0',
                description: ''
            });
        }
    }, [initialData, isOpen]);

    const mutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (initialData?.id) {
                return await api.put(`/developer-admin/frameworks/${initialData.id}`, data, reqConfig);
            } else {
                return await api.post('/developer-admin/frameworks', data, reqConfig);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_frameworks'] });
            onClose();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-container" style={{ maxWidth: '500px', width: '90%' }}>
                <div className="modal-header">
                    <div className="modal-title-group">
                        <div className="modal-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" opacity="0.4" />
                                <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="currentColor" stroke="currentColor" strokeWidth="1" />
                                <path d="M12 12L12 21" opacity="0.6" />
                                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                            </svg>
                        </div>
                        <h2 className="modal-title">{initialData ? 'Edit Framework' : 'New Framework'}</h2>
                    </div>
                    <button onClick={onClose} className="modal-close-btn">✕</button>
                </div>

                <div className="modal-body overflow-y-auto">
                    <form id="framework-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Framework ID (Code)</label>
                            <input required type="text" value={formData.framework_id} onChange={e => setFormData({ ...formData, framework_id: e.target.value })} className="data-entry-input" placeholder="e.g. GRI, SASB, ADX" />
                        </div>
                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Display Name</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="data-entry-input" placeholder="e.g. Global Reporting Initiative" />
                        </div>
                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Framework Type</label>
                            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="data-entry-input">
                                <option>mandatory</option>
                                <option>voluntary</option>
                                <option>conditional</option>
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Compliance Region</label>
                                <input type="text" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} className="data-entry-input" placeholder="e.g. Dubai, Global, EU" />
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Version Identifier</label>
                                <input type="text" value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} className="data-entry-input" placeholder="e.g. 2024.1" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Contextual Description</label>
                            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="data-entry-input" style={{ height: 80, resize: 'none' }} placeholder="Optional notes about this framework..." />
                        </div>
                    </form>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button type="submit" form="framework-form" disabled={mutation.isPending} className="btn btn-primary" style={{ background: '#f43f5e' }}>
                        {mutation.isPending ? 'Syncing...' : 'Save Framework'}
                    </button>
                </div>
            </div>
        </div>
    );
}
