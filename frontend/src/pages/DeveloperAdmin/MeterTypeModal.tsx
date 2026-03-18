import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

interface MeterTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: any;
    reqConfig: any;
}

export default function MeterTypeModal({ isOpen, onClose, initialData, reqConfig }: MeterTypeModalProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        name: '',
        unit: '',
        category: 'General',
        description: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                unit: initialData.unit || '',
                category: initialData.category || 'General',
                description: initialData.description || ''
            });
        } else {
            setFormData({
                name: '',
                unit: '',
                category: 'General',
                description: ''
            });
        }
    }, [initialData, isOpen]);

    const mutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (initialData?.id) {
                return await api.put(`/developer-admin/meter-types/${initialData.id}`, data, reqConfig);
            } else {
                return await api.post('/developer-admin/meter-types', data, reqConfig);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_meter_types'] });
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
            <div className="modal-container" style={{ maxWidth: '450px', width: '90%' }}>
                <div className="modal-header">
                    <div className="modal-title-group">
                        <div className="modal-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M7 15h1M11 15h1M15 15h1M19 15h1M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
                        </div>
                        <h2 className="modal-title">{initialData ? 'Edit Meter Type' : 'New Meter Type'}</h2>
                    </div>
                    <button onClick={onClose} className="modal-close-btn">✕</button>
                </div>

                <div className="modal-body">
                    <form id="metertype-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Type Identifier (Name)</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="data-entry-input" placeholder="e.g. Energy, Solar, Water" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Measurement Unit</label>
                                <input required type="text" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="data-entry-input" placeholder="e.g. kWh, m3, kg" />
                            </div>
                            <div className="form-group">
                                <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Classification</label>
                                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="data-entry-input">
                                    <option>General</option>
                                    <option>Energy</option>
                                    <option>Water</option>
                                    <option>Waste</option>
                                    <option>Carbon</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label text-xs uppercase letter-wide" style={{ color: 'var(--text-muted)' }}>Detailed Description</label>
                            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="data-entry-input" style={{ height: 100, resize: 'none' }} placeholder="Define the scope of this meter type..." />
                        </div>
                    </form>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button type="submit" form="metertype-form" disabled={mutation.isPending} className="btn btn-primary" style={{ background: '#f43f5e' }}>
                        {mutation.isPending ? 'Syncing...' : 'Save Meter Type'}
                    </button>
                </div>
            </div>
        </div>
    );
}
