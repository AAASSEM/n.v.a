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
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
            <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2C6.5 2 2 6.5 2 12c0 3 1.3 5.7 3.5 7.5" opacity="0.6" />
    <path d="M12 6a6 6 0 0 0-6 6c0 3.3 2.7 6 6 6 2.3 0 4.3-1.3 5.3-3.3" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    <path d="M18.5 11c0-2-1.5-3.5-3.5-3.5S11.5 9 11.5 11s1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5Z" fill="currentColor" stroke="none" />
</svg>
                        </div>
                        <span className="modal-title">{initialData ? 'Edit Framework' : 'New Framework'}</span>
                    </div>
                    <button onClick={onClose} className="modal-close">✕</button>
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
