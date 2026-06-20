import React, { useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useAuthStore } from '../../stores/authStore';
import { useSiteStore } from '../../stores/siteStore';
import { canPerformAction } from '../../config/rbac';
import AccessDenied from '../../components/ui/AccessDenied';
import { useTranslation } from '../../i18n';

export default function ReportsView() {
    const { t, lang, n } = useTranslation();
    const { user } = useAuthStore();
    const currentSiteId = useSiteStore(s => s.currentSiteId);
    const currentYear = new Date().getFullYear();
    const [selectedPeriod, setSelectedPeriod] = useState(String(currentYear));
    const [showMissingModal, setShowMissingModal] = useState(false);
    const [missingData, setMissingData] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState<'PDF' | 'XLSX'>('PDF');
    const [selectedFramework, setSelectedFramework] = useState<string>('ESG');
    const [selectedSubPeriod, setSelectedSubPeriod] = useState<string>('Full Year');

    const canCreate = canPerformAction(user?.profile?.role, 'reports', 'create');
    const canDelete = canPerformAction(user?.profile?.role, 'reports', 'delete');

    const { data: companyData } = useQuery({
        queryKey: ['company_me'],
        queryFn: async () => (await api.get('/companies/me')).data,
    });
    
    const activeFrameworks = React.useMemo(() => {
        let fws = companyData?.active_frameworks?.length ? companyData.active_frameworks : ['ESG'];
        if (currentSiteId) {
            const site = useSiteStore.getState().sites.find(s => s.id === currentSiteId);
            if (site && site.location && site.location.toLowerCase() !== 'dubai') {
                fws = fws.filter((fw: string) => fw !== 'DST');
            }
        }
        return fws;
    }, [companyData, currentSiteId]);

    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        type?: 'success' | 'error' | 'warning' | 'info' | 'danger';
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', message: '' });

    // 1. Fetch completion status
    const { data: completionStatus, isLoading: loadingStatus, refetch } = useQuery({
        queryKey: ['report_completion', selectedPeriod, currentSiteId, selectedFramework, selectedSubPeriod],
        queryFn: async () => (await api.get(`/reports/check-completion/${selectedPeriod}?framework=${selectedFramework}&period=${selectedSubPeriod}`)).data,
    });

    // 2. Fetch report history
    const { data: reportsList, isLoading: loadingReports, refetch: refetchReports, error } = useQuery({
        queryKey: ['reports_list', currentSiteId],
        queryFn: async () => (await api.get('/reports/')).data,
    });

    const isForbidden = (error as any)?.response?.status === 403;

    // 3. Generate mutation
    const generateMutation = useMutation({
        mutationFn: async (allowIncomplete: boolean = false) => {
            const res = await api.post(`/reports/generate/${selectedPeriod}?allow_incomplete=${allowIncomplete}&format=${selectedFormat}&framework=${selectedFramework}&period=${selectedSubPeriod}`);
            return res.data;
        },
        onSuccess: (data) => {
            setAlertModal({
                isOpen: true,
                title: t('reports.successTitle'),
                message: t('reports.successMsg').replace('{{name}}', data.name),
                confirmLabel: t('reports.great'),
                type: 'success'
            });
            setIsGenerating(false);
            refetch();
            refetchReports();
        },
        onError: (err: any) => {
            setAlertModal({
                isOpen: true,
                title: t('reports.failTitle'),
                message: err.response?.data?.detail?.msg || t('reports.failMsg'),
                confirmLabel: t('reports.tryAgain'),
                type: 'error'
            });
            setIsGenerating(false);
        }
    });

    // 4. Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/reports/${id}`);
        },
        onSuccess: () => {
            refetchReports();
        }
    });

    const handleDownload = async (url: string, name: string, format: string) => {
        try {
            const cleanUrl = url.replace('/api/v1', '');
            // Fetch the file through our authenticated API instance
            const response = await api.get(cleanUrl, { responseType: 'blob' });
            
            // response.data is already a Blob because of responseType: 'blob'
            let blob = response.data;
            if (!blob || blob.size === 0) {
                throw new Error('Downloaded file is empty');
            }

            // Ensure correct MIME type for the blob based on the format
            const mimeType = format === 'XLSX' 
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                : 'application/pdf';
            
            blob = new Blob([blob], { type: mimeType });

            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            
            const filename = `${name.replace(/\s+/g, '_')}_${selectedPeriod}.${format.toLowerCase()}`;
            link.setAttribute('download', filename);
            
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err: any) {
            console.error('Download error:', err);
            setAlertModal({
                isOpen: true,
                title: t('reports.downloadFailed'),
                message: t('reports.downloadFailedMsg'),
                confirmLabel: t('users.close'),
                type: 'error'
            });
        }
    };

    const handleGenerateClick = () => {
        if (!completionStatus) return;
        if (!completionStatus.is_complete) {
            setMissingData(completionStatus);
            setShowMissingModal(true);
        } else {
            setIsGenerating(true);
            generateMutation.mutate(false);
        }
    };

    if (isForbidden) {
        return <AccessDenied showLayout title="Access Restricted" message="Your role does not have permission to view or export company reports." />;
    }

    const displayStats = [
        { 
            label: t('reports.dataCompletion'), 
            value: loadingStatus ? '...' : `${n(completionStatus?.completion_percentage || 0)}%`, 
            color: (completionStatus?.completion_percentage || 0) > 90 ? 'green' : 'amber', 
            sub: `${n(completionStatus?.total_filled || 0)}/${n(completionStatus?.total_expected || 0)} ${t('reports.itemsFilled')}` 
        },
        { label: t('reports.generated'), value: n(reportsList?.length || 0), color: 'blue', sub: t('reports.totalDocuments') },
        { 
            label: t('reports.pendingTasks'), 
            value: loadingStatus ? '...' : n(completionStatus?.missing_count || 0), 
            color: (completionStatus?.missing_count || 0) > 0 ? 'rose' : 'gray', 
            sub: t('reports.submissionsRequired') 
        },
    ];

    const filteredReports = reportsList?.filter((r: any) => String(r.year) === selectedPeriod) || [];

    return (
        <AppLayout>
            <div className="animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{t('reports.title')}</h1>
                        <p className="page-subtitle">{t('reports.subtitle')} - {selectedFramework.toUpperCase()} ({selectedPeriod}).</p>
                    </div>
                    {canCreate && (
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div className="status-chip-group" style={{ background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10 }}>
                                {activeFrameworks.map((fw: string) => (
                                    <button 
                                        key={fw}
                                        className={`status-chip ${selectedFramework === fw ? 'active' : ''}`} 
                                        onClick={() => setSelectedFramework(fw)} 
                                        style={{ fontSize: 11, padding: '4px 12px' }}
                                    >
                                        {fw.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <div className="status-chip-group" style={{ background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10 }}>
                                <button className={`status-chip ${selectedFormat === 'PDF' ? 'active' : ''}`} onClick={() => setSelectedFormat('PDF')} style={{ fontSize: 11, padding: '4px 12px' }}>{t('reports.pdf')}</button>
                                <button className={`status-chip ${selectedFormat === 'XLSX' ? 'active' : ''}`} onClick={() => setSelectedFormat('XLSX')} style={{ fontSize: 11, padding: '4px 12px' }}>{t('reports.excel')}</button>
                            </div>
                            <button 
                                className={`btn btn-primary shadow-lg ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={handleGenerateClick}
                                disabled={isGenerating || loadingStatus}
                            >
                                {isGenerating ? <div className="spinner-sm" style={{ marginRight: 8 }} /> : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 18 15 15" />
                                    </svg>
                                )}
                                {isGenerating ? t('reports.generating') : `${t('reports.generate')} ${selectedFormat}`}
                            </button>
                        </div>
                    )}
                </div>

                <div className="stat-card-grid stat-card-grid-3" style={{ marginBottom: 24 }}>
                    {displayStats.map(s => (
                        <div key={s.label} className={`stat-card ${s.color}`}>
                            <div className="stat-card-header">
                                <span className="stat-card-label">{s.label}</span>
                                <div className="stat-card-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                    </svg>
                                </div>
                            </div>
                            <div className="stat-card-value" style={{ fontSize: 32 }}>{s.value}</div>
                            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{s.sub}</div>
                        </div>
                    ))}
                </div>

                <div className="command-bar">
                    <div className="command-bar-main" style={{ gap: 16 }}>
                        <div className="status-chip-group">
                            {[0, 1, 2, 3, 4].map(offset => {
                                const year = String(currentYear - offset);
                                return (
                                    <button key={year} className={`status-chip ${selectedPeriod === year ? 'active' : ''}`} onClick={() => setSelectedPeriod(year)}>{t('reports.fy')} {n(year)}</button>
                                );
                            })}
                        </div>
                        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
                        <div className="status-chip-group">
                            {['Full Year', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4'].map(p => (
                                <button key={p} className={`status-chip ${selectedSubPeriod === p ? 'active' : ''}`} onClick={() => setSelectedSubPeriod(p)}>{t(`reports.${p.toLowerCase().replace(' ', '')}` as any)}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="dark-table-wrap">
                    <table className="dark-table">
                        <thead>
                            <tr>
                                <th>{t('reports.docName')}</th>
                                <th>{t('reports.category')}</th>
                                <th>{t('reports.format')}</th>
                                <th>{t('reports.generatedDate')}</th>
                                <th>{t('reports.size')}</th>
                                <th style={{ textAlign: 'end' }}>{t('reports.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loadingReports && filteredReports.map((r: any) => (
                                <tr key={r.id}>
                                    <td>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                                            {lang === 'ar' ? `تقرير ${r.category} ${n(r.year)}${r.name.includes(' - ') ? ' - ' + t(`reports.${r.name.split(' - ')[1].toLowerCase().replace(' ', '')}` as any) : ''}` : r.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('reports.officialArchive')} · {t('reports.fy')} {n(r.year)}</div>
                                    </td>
                                    <td><span className="badge badge-gray">{r.category}</span></td>
                                    <td><span className={`badge ${r.format === 'PDF' ? 'badge-red' : 'badge-green'}`}>{r.format}</span></td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{n(r.date)}</td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{n(r.size)}</td>
                                    <td style={{ textAlign: 'end' }}>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(r.download_url, r.name, r.format)}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                {t('reports.download')}
                                            </button>
                                            {canDelete && (
                                                <button 
                                                    className="btn btn-ghost btn-sm" 
                                                    style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.05)' }}
                                                    onClick={() => {
                                                        setAlertModal({
                                                            isOpen: true,
                                                            title: t('reports.deleteTitle'),
                                                            message: t('reports.deleteMsg'),
                                                            confirmLabel: t('reports.deletePermanently'),
                                                            type: 'danger',
                                                            onConfirm: () => {
                                                                deleteMutation.mutate(r.id);
                                                                setAlertModal(prev => ({ ...prev, isOpen: false }));
                                                            }
                                                        });
                                                    }}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loadingReports && filteredReports.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('reports.noReports')} {n(selectedPeriod)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: 24, padding: 20, background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.2)', borderRadius: 'var(--radius-xl)', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14 }}>{t('reports.auditable')}</div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('reports.auditableDesc')}</p>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={showMissingModal}
                title={t('reports.partialWarningTitle')}
                type="warning"
                message={t('reports.partialWarningMsg').replace('{{period}}', n(selectedPeriod)).replace('{{pct}}', n(missingData?.completion_percentage || 0))}
                confirmLabel={t('reports.fixData')}
                secondaryConfirmLabel={t('reports.generatePartial')}
                cancelLabel={t('settings.cancel')}
                onConfirm={() => {
                    setShowMissingModal(false);
                    window.location.href = '/data-entry';
                }}
                onSecondaryConfirm={() => {
                    setShowMissingModal(false);
                    setIsGenerating(true);
                    generateMutation.mutate(true);
                }}
                onCancel={() => setShowMissingModal(false)}
            />

            <ConfirmModal
                isOpen={alertModal.isOpen}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
                confirmLabel={alertModal.confirmLabel}
                onConfirm={alertModal.onConfirm || (() => setAlertModal(prev => ({ ...prev, isOpen: false })))}
                onCancel={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
            />
        </AppLayout>
    );
}