import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface ElementModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: any;
    reqConfig: any;
}

export default function ElementModal({ isOpen, onClose, initialData, reqConfig }: ElementModalProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        element_code: '',
        name: '',
        category: 'Environmental',
        description: '',
        unit: '',
        collection_frequency: 'Monthly',
        condition_logic: '',
        frameworks: '',
        is_metered: false,
        meter_type: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                element_code: initialData.element_code || '',
                name: initialData.name || '',
                category: initialData.category || 'Environmental',
                description: initialData.description || '',
                unit: initialData.unit || '',
                collection_frequency: initialData.collection_frequency || 'Monthly',
                condition_logic: initialData.condition_logic || '',
                frameworks: initialData.frameworks || '',
                is_metered: initialData.is_metered || false,
                meter_type: initialData.meter_type || ''
            });
        } else {
            setFormData({
                element_code: '',
                name: '',
                category: 'Environmental',
                description: '',
                unit: '',
                collection_frequency: 'Monthly',
                condition_logic: '',
                frameworks: '',
                is_metered: false,
                meter_type: ''
            });
        }
    }, [initialData, isOpen]);

    const mutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (initialData?.id) {
                return await api.put(`/developer-admin/data-elements/${initialData.id}`, data, reqConfig);
            } else {
                return await api.post('/developer-admin/data-elements', data, reqConfig);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_elements'] });
            onClose();
        }
    });

    const { data: dbFrameworks, isLoading: loadingFrameworks } = useQuery({
        queryKey: ['frameworks_list', isOpen],
        queryFn: async () => {
            if (!isOpen) return [];
            return (await api.get('/developer-admin/frameworks', reqConfig)).data;
        },
        enabled: isOpen,
        staleTime: 5 * 60 * 1000
    });

    const { data: dbMeterTypes } = useQuery({
        queryKey: ['meter_types_list', isOpen],
        queryFn: async () => {
            if (!isOpen) return [];
            return (await api.get('/developer-admin/meter-types', reqConfig)).data;
        },
        enabled: isOpen,
        staleTime: 5 * 60 * 1000
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

    const handleMeterTypeToggle = (mtName: string) => {
        const currentList = formData.meter_type ? formData.meter_type.split(',').map(m => m.trim()) : [];
        if (currentList.includes(mtName)) {
            setFormData({ ...formData, meter_type: currentList.filter(m => m !== mtName).join(', ') });
        } else {
            setFormData({ ...formData, meter_type: [...currentList, mtName].join(', ') });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-container" style={{ maxWidth: '700px', width: '90%' }}>
                <div className="modal-header">
                    <div className="modal-title-group">
                        <div className="modal-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
                        </div>
                        <h2 className="modal-title">{initialData ? 'Edit Data Element' : 'New Data Element'}</h2>
                    </div>
                    <button onClick={onClose} className="modal-close-btn">✕</button>
                </div>

                <div className="modal-body overflow-y-auto">
                    <form id="element-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Element Code</label>
                                <input required type="text" value={formData.element_code} onChange={e => setFormData({ ...formData, element_code: e.target.value })} className="data-entry-input" placeholder="e.g. EC-01" />
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Name</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="data-entry-input" placeholder="e.g. Grid Electricity" />
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Category</label>
                                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="data-entry-input">
                                    <option>Environmental</option>
                                    <option>Social</option>
                                    <option>Governance</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Collection Frequency</label>
                                <select value={formData.collection_frequency} onChange={e => setFormData({ ...formData, collection_frequency: e.target.value })} className="data-entry-input">
                                    <option>Monthly</option>
                                    <option>Quarterly</option>
                                    <option>Annually</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Unit</label>
                                <input type="text" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="data-entry-input" placeholder="e.g. kWh" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Description</label>
                            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="data-entry-input" style={{ height: 80, resize: 'none' }} placeholder="Detailed explanation..." />
                        </div>

                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Condition Logic (Triggers this element if context matches)</label>
                            <input type="text" value={formData.condition_logic} onChange={e => setFormData({ ...formData, condition_logic: e.target.value })} className="data-entry-input" style={{ fontFamily: 'monospace' }} placeholder="e.g. contains('swimming pool')" />
                        </div>

                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Apply to Industry Frameworks</label>
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
                                                {fw.framework_id}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: formData.is_metered ? 16 : 0 }}>
                                <div
                                    onClick={() => setFormData({ ...formData, is_metered: !formData.is_metered })}
                                    style={{
                                        width: 40, height: 20, borderRadius: 20, background: formData.is_metered ? '#f43f5e' : 'var(--bg-elevated)',
                                        position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: 14, height: 14, borderRadius: '50%', background: 'white',
                                        position: 'absolute', top: 3, left: formData.is_metered ? 23 : 3,
                                        transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>Requires Meter Breakdown</span>
                            </div>

                            {formData.is_metered && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                                    {dbMeterTypes?.map((mt: any) => {
                                        const isSelected = (formData.meter_type || '').split(',').map(m => m.trim()).includes(mt.name);
                                        return (
                                            <button
                                                key={mt.id}
                                                type="button"
                                                onClick={() => handleMeterTypeToggle(mt.name)}
                                                className={`status-chip ${isSelected ? 'active' : ''}`}
                                                style={{ fontSize: 11, padding: '4px 10px' }}
                                            >
                                                {mt.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button type="submit" form="element-form" disabled={mutation.isPending} className="btn btn-primary" style={{ background: '#f43f5e' }}>
                        {mutation.isPending ? 'Syncing...' : 'Save Element'}
                    </button>
                </div>
            </div>
        </div>
    );
}
