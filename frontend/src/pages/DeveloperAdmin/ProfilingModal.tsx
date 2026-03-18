import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface ProfilingModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: any;
    reqConfig: any;
}

export default function ProfilingModal({ isOpen, onClose, initialData, reqConfig }: ProfilingModalProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        framework_id: null as number | null,
        question_text: '',
        question_order: 1,
        input_type: 'boolean',
        is_required: true,
        frameworks: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                framework_id: initialData.framework_id || null,
                question_text: initialData.question_text || '',
                question_order: initialData.question_order || 1,
                input_type: initialData.input_type || 'boolean',
                is_required: initialData.is_required !== undefined ? initialData.is_required : true,
                frameworks: initialData.frameworks || ''
            });
        } else {
            setFormData({
                framework_id: null,
                question_text: '',
                question_order: 1,
                input_type: 'boolean',
                is_required: true,
                frameworks: ''
            });
        }
    }, [initialData, isOpen]);

    const mutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (initialData?.id) {
                return await api.put(`/developer-admin/profiling-questions/${initialData.id}`, data, reqConfig);
            } else {
                return await api.post('/developer-admin/profiling-questions', data, reqConfig);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_profiling'] });
            onClose();
        }
    });

    const { data: dbFrameworks, isLoading: loadingFrameworks } = useQuery({
        queryKey: ['availableFrameworks'],
        queryFn: async () => {
            const res = await api.get('/developer-admin/frameworks', reqConfig);
            return res.data;
        },
    });

    const handleFrameworkToggle = (frameworkId: string) => {
        let currentFws = formData.frameworks ? formData.frameworks.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (currentFws.includes(frameworkId)) {
            currentFws = currentFws.filter(f => f !== frameworkId);
        } else {
            currentFws.push(frameworkId);
        }
        setFormData({ ...formData, frameworks: currentFws.join(',') });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-container" style={{ maxWidth: '600px', width: '90%' }}>
                <div className="modal-header">
                    <div className="modal-title-group">
                        <div className="modal-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M22 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h9" /></svg>
                        </div>
                        <h2 className="modal-title">{initialData ? 'Edit Profiling Logic' : 'New Profiling Logic'}</h2>
                    </div>
                    <button onClick={onClose} className="modal-close-btn">✕</button>
                </div>

                <div className="modal-body overflow-y-auto">
                    <form id="profiling-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Order ID</label>
                                <input required type="number" value={formData.question_order} onChange={e => setFormData({ ...formData, question_order: parseInt(e.target.value) || 1 })} className="data-entry-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Question Text</label>
                                <input required type="text" value={formData.question_text} onChange={e => setFormData({ ...formData, question_text: e.target.value })} className="data-entry-input" placeholder="e.g. Do you have physical office space?" />
                            </div>
                        </div>                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Response Type</label>
                                <select value={formData.input_type} onChange={e => setFormData({ ...formData, input_type: e.target.value })} className="data-entry-input">
                                    <option value="boolean">Yes / No</option>
                                    <option value="text">Free Text</option>
                                    <option value="number">Numeric</option>
                                    <option value="select">Dropdown</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Completion Requirement</label>
                                <select value={formData.is_required ? 'true' : 'false'} onChange={e => setFormData({ ...formData, is_required: e.target.value === 'true' })} className="data-entry-input">
                                    <option value="true">Mandatory</option>
                                    <option value="false">Optional</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Target Framework ID (Optional, DB ID)</label>
                            <input type="number" value={formData.framework_id || ''} onChange={e => setFormData({ ...formData, framework_id: parseInt(e.target.value) || null })} className="data-entry-input" style={{ maxWidth: 200 }} placeholder="e.g. 1" />
                        </div>

                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Triggers Industry Frameworks</label>
                            {loadingFrameworks ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading frameworks...</div>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                                    {dbFrameworks?.map((fw: any) => {
                                        const currentFws = formData.frameworks ? formData.frameworks.split(',').map(s => s.trim()) : [];
                                        const isChecked = currentFws.includes(fw.framework_id);
                                        return (
                                            <button
                                                key={fw.id}
                                                type="button"
                                                onClick={() => handleFrameworkToggle(fw.framework_id)}
                                                className={`status-chip ${isChecked ? 'active' : ''}`}
                                                style={isChecked ? { borderColor: '#f43f5e', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)' } : {}}
                                            >
                                                <span className="dot" style={{ background: isChecked ? '#f43f5e' : 'var(--text-muted)' }} />
                                                <span className="font-bold">{fw.framework_id}</span>
                                                <span style={{ opacity: 0.6, fontSize: 10, marginLeft: 4 }}>({fw.type})</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button type="submit" form="profiling-form" disabled={mutation.isPending} className="btn btn-primary" style={{ background: '#f43f5e' }}>
                        {mutation.isPending ? 'Syncing...' : 'Save Logic'}
                    </button>
                </div>
            </div>
        </div>
    );
}
