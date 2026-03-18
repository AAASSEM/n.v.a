import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import AppLayout from '../../components/layout/AppLayout';

interface CompanyData {
    name: string;
    registration_number: string;
    trade_license_number: string;
    emirate: 'Dubai' | 'AbuDhabi' | 'Sharjah' | 'Ajman' | 'UmmAlQuwain' | 'RasAlKhaimah' | 'Fujairah';
    sector: 'Hospitality' | 'RealEstate' | 'Manufacturing' | 'Technology' | 'Other';
    has_green_key: boolean;
    active_frameworks: string[];
}

interface Question {
    id: number;
    question_text: string;
}

const ACTIVITIES = [
    { label: 'Hotel Operations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14" /><path d="M9 11h2" /><path d="M9 15h2" /><path d="M13 11h2" /><path d="M13 15h2" /></svg> },
    { label: 'Food & Beverage', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg> },
    { label: 'Spa & Wellness', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10l9 6" /><circle cx="12" cy="12" r="10" /></svg> },
    { label: 'Event Management', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { label: 'Retail Operations', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg> },
    { label: 'Recreation Facilities', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3" /><path d="M6.5 9h11L20 21H4L6.5 9Z" /></svg> },
    { label: 'Conference Rooms', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
    { label: 'Housekeeping Services', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 22V11" /><path d="M17 22V11" /><path d="M15 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /></svg> },
    { label: 'Laundry Services', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M7 12a5 5 0 0 1 5-5" /><path d="M12 17a5 5 0 0 1-5-5" /></svg> },
    { label: 'Transportation Services', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg> }
];

const EMIRATE_OPTIONS = ['Dubai', 'AbuDhabi', 'Sharjah', 'Ajman', 'UmmAlQuwain', 'RasAlKhaimah', 'Fujairah'];
const SECTOR_OPTIONS = ['Hospitality', 'RealEstate', 'Manufacturing', 'Technology', 'Other'];

const STEPS = [
    { num: 1, label: 'Business Information', sub: 'Company details' },
    { num: 2, label: 'Frameworks', sub: 'ESG frameworks' },
    { num: 3, label: 'ESG Assessment', sub: 'Sustainability assessment' },
];

export default function OnboardingWizard() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { fetchUser, user } = useAuthStore();
    const [step, setStep] = useState(1);
    const [companyId, setCompanyId] = useState<number | null>(null);
    const [answers, setAnswers] = useState<Record<number, boolean>>({});
    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

    const [companyData, setCompanyData] = useState<CompanyData>({
        name: '', registration_number: '', trade_license_number: '',
        emirate: 'Dubai', sector: 'Hospitality', has_green_key: false, active_frameworks: []
    });

    // Modal Selection State
    const [activeModal, setActiveModal] = useState<'emirate' | 'sector' | null>(null);

    const { data: myCompany } = useQuery({
        queryKey: ['myCompany'],
        queryFn: async () => {
            if (!user?.profile?.company_id) return null;
            const res = await api.get('/companies/me');
            return res.data;
        },
        enabled: !!user?.profile?.company_id,
    });

    const { data: myAnswers } = useQuery({
        queryKey: ['myAnswers'],
        queryFn: async () => {
            if (!user?.profile?.company_id) return null;
            const res = await api.get('/profiling/answers/me');
            return res.data;
        },
        enabled: !!user?.profile?.company_id,
    });

    const { data: questions, isLoading: loadingQuestions } = useQuery<Question[]>({
        queryKey: ['profilingQuestions'],
        queryFn: async () => { const res = await api.get('/profiling/questions'); return res.data; },
        enabled: step === 3 || !!user?.profile?.company_id,
    });

    const { data: dbFrameworks, isLoading: loadingFrameworks } = useQuery({
        queryKey: ['availableFrameworks'],
        queryFn: async () => { const res = await api.get('/frameworks'); return res.data; },
        enabled: step >= 1,
    });

    useEffect(() => {
        if (myCompany) {
            setCompanyId(myCompany.id);
            setCompanyData({
                name: myCompany.name || '',
                registration_number: myCompany.registration_number || '',
                trade_license_number: myCompany.trade_license_number || '',
                emirate: myCompany.emirate || 'Dubai',
                sector: myCompany.sector || 'Hospitality',
                has_green_key: myCompany.has_green_key || false,
                active_frameworks: myCompany.active_frameworks || []
            });
            setStep(3);
        }
    }, [myCompany]);

    useEffect(() => {
        if (myAnswers && Array.isArray(myAnswers)) {
            const map: Record<number, boolean> = {};
            myAnswers.forEach((ans: any) => { map[ans.question_id] = ans.answer; });
            setAnswers(prev => ({ ...prev, ...map }));
        }
    }, [myAnswers]);

    const createCompanyMutation = useMutation({
        mutationFn: async (data: CompanyData) => { const res = await api.post('/companies/', data); return res.data; },
        onSuccess: async (data) => { setCompanyId(data.id); await fetchUser(); setStep(3); },
    });

    const updateCompanyMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: CompanyData }) => {
            const res = await api.put(`/companies/${id}`, data); return res.data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['profilingQuestions'] });
            setStep(3);
        },
    });

    const submitAnswersMutation = useMutation({
        mutationFn: async (payload: { company_id: number; answers: { question_id: number; answer: boolean }[] }) => {
            const res = await api.post('/profiling/answers', payload); return res.data;
        },
        onSuccess: () => navigate('/checklist'),
    });

    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        let fws = [...companyData.active_frameworks];
        if (!fws.includes('ESG')) fws.push('ESG');
        if (companyData.emirate.toLowerCase() === 'dubai' && companyData.sector.toLowerCase() === 'hospitality') {
            if (!fws.includes('DST')) fws.push('DST');
        } else {
            fws = fws.filter(f => f !== 'DST');
        }
        setCompanyData(prev => ({ ...prev, active_frameworks: fws }));
        setStep(2);
    };

    const handleStep2Submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (companyId) { updateCompanyMutation.mutate({ id: companyId, data: companyData }); return; }
        createCompanyMutation.mutate(companyData);
    };

    const handleAnswersSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyId) return;
        submitAnswersMutation.mutate({
            company_id: companyId,
            answers: Object.entries(answers).map(([qId, ans]) => ({ question_id: parseInt(qId), answer: ans })),
        });
    };

    const totalQuestions = questions?.length || 0;
    const answeredCount = questions?.filter(q => answers[q.id] !== undefined).length || 0;
    const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    const errorMessage = createCompanyMutation.error
        ? (createCompanyMutation.error as any)?.response?.data?.detail || 'Failed to create company.'
        : submitAnswersMutation.error
            ? (submitAnswersMutation.error as any)?.response?.data?.detail || 'Failed to submit profiling.'
            : null;

    return (
        <AppLayout>
            <div className="onboarding-container animate-fade-in">
                {/* Sidebar */}
                <div className="onboarding-sidebar">
                    <div className="onboarding-sidebar-title">Onboarding Setup</div>

                    {STEPS.map(s => (
                        <div key={s.num} className={`onboarding-step-item ${step === s.num ? 'active' : ''}`}>
                            <div className={`onboarding-step-num ${step > s.num ? 'done' : step === s.num ? 'active' : 'pending'}`}>
                                {step > s.num ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : s.num}
                            </div>
                            <div className="onboarding-step-info">
                                <div className="onboarding-step-name" style={{ color: step === s.num ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                                    {s.label}
                                </div>
                                <div className="onboarding-step-sub">{s.sub}</div>
                            </div>
                        </div>
                    ))}

                    {/* Progress */}
                    {step === 3 && (
                        <div className="onboarding-progress-bar">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Progress</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)' }}>{progress}%</span>
                            </div>
                            <div className="progress-bar-track">
                                <div className="progress-bar-fill green" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="onboarding-content">
                    {/* Error */}
                    {errorMessage && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13.5,
                            marginBottom: 24,
                        }}>
                            ⚠ {errorMessage}
                        </div>
                    )}

                    {/* STEP 1: Company Info */}
                    {step === 1 && (
                        <form onSubmit={handleStep1Submit} className="animate-fade-in">
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Business Information</h2>
                            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 28 }}>Tell us about your company</p>

                            {/* Company Info Section */}
                            <div style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)',
                                overflow: 'hidden',
                                marginBottom: 20,
                            }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h6" /><path d="M3 15h6" /></svg>
                                    Company Information
                                </div>
                                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div>
                                        <label className="form-label">Company Name</label>
                                        <input required type="text" className="form-input" placeholder="e.g. Acme Corp"
                                            value={companyData.name} onChange={e => setCompanyData({ ...companyData, name: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div>
                                            <label className="form-label">Emirate</label>
                                            <div
                                                className="dropdown-trigger"
                                                style={{ width: '100%', cursor: 'pointer' }}
                                                onClick={() => setActiveModal('emirate')}
                                            >
                                                <span style={{ color: 'var(--text-muted)', marginRight: 10, display: 'flex', alignItems: 'center' }}>
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                </span>
                                                <span style={{ flex: 1 }}>{companyData.emirate}</span>
                                                <svg className="dropdown-chevron" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label">Primary Sector</label>
                                            <div
                                                className="dropdown-trigger"
                                                style={{ width: '100%', cursor: 'pointer' }}
                                                onClick={() => setActiveModal('sector')}
                                            >
                                                <span style={{ color: 'var(--text-muted)', marginRight: 10, display: 'flex', alignItems: 'center' }}>
                                                    {companyData.sector.toLowerCase() === 'hospitality' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14" /><path d="M9 11h2" /><path d="M9 15h2" /><path d="M13 11h2" /><path d="M13 15h2" /></svg> :
                                                        companyData.sector.toLowerCase() === 'realestate' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M8 10h.01" /><path d="M16 10h.01" /><path d="M8 14h.01" /><path d="M16 14h.01" /></svg> :
                                                            companyData.sector.toLowerCase() === 'manufacturing' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20V4l8 4V4l8 4V4l4 4v12H2z" /><path d="M7 20v-4" /><path d="M12 20v-4" /><path d="M17 20v-4" /></svg> :
                                                                companyData.sector.toLowerCase() === 'technology' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> :
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
                                                </span>
                                                <span style={{ flex: 1 }}>{companyData.sector}</span>
                                                <svg className="dropdown-chevron" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div>
                                            <label className="form-label">Registration Number</label>
                                            <input type="text" className="form-input"
                                                value={companyData.registration_number} onChange={e => setCompanyData({ ...companyData, registration_number: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="form-label">Trade License Number</label>
                                            <input type="text" className="form-input"
                                                value={companyData.trade_license_number} onChange={e => setCompanyData({ ...companyData, trade_license_number: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Activities Section */}
                            <div style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)',
                                overflow: 'hidden',
                                marginBottom: 24,
                            }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    Business Activities
                                </div>
                                <div style={{ padding: 20 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        {ACTIVITIES.map(act => (
                                            <div
                                                key={act.label}
                                                onClick={() => setSelectedActivities(prev =>
                                                    prev.includes(act.label) ? prev.filter(a => a !== act.label) : [...prev, act.label]
                                                )}
                                                style={{
                                                    padding: '10px 14px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: `1px solid ${selectedActivities.includes(act.label) ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                                    background: selectedActivities.includes(act.label) ? 'var(--accent-green-dim)' : 'var(--bg-card)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    transition: 'all var(--transition-fast)',
                                                }}
                                            >
                                                <div style={{
                                                    width: 16, height: 16,
                                                    borderRadius: 4,
                                                    border: `2px solid ${selectedActivities.includes(act.label) ? 'var(--accent-green)' : 'var(--border-default)'}`,
                                                    background: selectedActivities.includes(act.label) ? 'var(--accent-green)' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                    transition: 'all var(--transition-fast)',
                                                }}>
                                                    {selectedActivities.includes(act.label) && (
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a1a12" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div style={{ color: selectedActivities.includes(act.label) ? 'var(--accent-green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                                    {act.icon}
                                                </div>
                                                <span style={{ fontSize: 13, color: selectedActivities.includes(act.label) ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                                    {act.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                                        <button type="button" onClick={() => setSelectedActivities(ACTIVITIES.map(a => a.label))}
                                            style={{ fontSize: 12, color: 'var(--accent-green)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                            + Select All
                                        </button>
                                        <button type="button" onClick={() => setSelectedActivities([])}
                                            style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                            Deselect All
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn btn-primary btn-lg">
                                    Save & Continue →
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STEP 2: Frameworks */}
                    {step === 2 && (
                        <form onSubmit={handleStep2Submit} className="animate-fade-in">
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>ESG Frameworks</h2>
                            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 28 }}>Select the frameworks applicable to your organization</p>

                            {/* Mandatory */}
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 20 }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                    Mandatory Frameworks
                                </div>
                                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {loadingFrameworks ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
                                    ) : (
                                        dbFrameworks?.filter((fw: any) =>
                                            fw.type.toLowerCase() === 'mandatory' ||
                                            (fw.framework_id === 'DST' && companyData.active_frameworks.includes('DST'))
                                        ).map((fw: any) => (
                                            <div key={fw.id} style={{
                                                padding: '14px 16px',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid rgba(99,102,241,0.3)',
                                                background: 'rgba(99,102,241,0.07)',
                                                display: 'flex',
                                                gap: 14,
                                                alignItems: 'flex-start',
                                            }}>
                                                <div style={{ fontSize: 24, color: '#818cf8', display: 'flex', alignItems: 'center' }}>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{fw.name} ({fw.framework_id})</div>
                                                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 8 }}>{fw.description}</div>
                                                    <span className="badge badge-blue" style={{ fontSize: 11 }}>✓ Auto-assigned</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Voluntary */}
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 24 }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    Voluntary Frameworks
                                </div>
                                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {loadingFrameworks ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
                                    ) : (
                                        dbFrameworks?.filter((fw: any) => fw.type.toLowerCase() === 'voluntary' && fw.framework_id !== 'DST').map((fw: any) => {
                                            const isActive = companyData.active_frameworks.includes(fw.framework_id) || (fw.framework_id === 'GREEN KEY' && companyData.has_green_key);
                                            return (
                                                <div key={fw.id} style={{
                                                    padding: '14px 16px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: `1px solid ${isActive ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                                    background: isActive ? 'var(--accent-green-dim)' : 'var(--bg-card)',
                                                    display: 'flex',
                                                    gap: 14,
                                                    alignItems: 'flex-start',
                                                    transition: 'all var(--transition-fast)',
                                                }}>
                                                    <div style={{ fontSize: 24, color: isActive ? 'var(--accent-green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{fw.name} ({fw.framework_id})</div>
                                                                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>{fw.description}</div>
                                                            </div>
                                                            <label className="toggle" style={{ marginLeft: 16, flexShrink: 0 }}>
                                                                <input type="checkbox" checked={isActive} onChange={() => {
                                                                    if (fw.framework_id === 'GREEN KEY') {
                                                                        setCompanyData(prev => ({ ...prev, has_green_key: !prev.has_green_key }));
                                                                    } else {
                                                                        setCompanyData(prev => ({
                                                                            ...prev,
                                                                            active_frameworks: isActive
                                                                                ? prev.active_frameworks.filter(f => f !== fw.framework_id)
                                                                                : [...prev.active_frameworks, fw.framework_id]
                                                                        }));
                                                                    }
                                                                }} />
                                                                <span className="toggle-slider" />
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button type="button" className="btn btn-ghost btn-lg" onClick={() => setStep(1)}>← Back</button>
                                <button type="submit" className="btn btn-primary btn-lg"
                                    disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}>
                                    {createCompanyMutation.isPending || updateCompanyMutation.isPending ? 'Saving...' : 'Save & Continue →'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* STEP 3: Profiling */}
                    {step === 3 && (
                        <form onSubmit={handleAnswersSubmit} className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>ESG Assessment</h2>
                                <span className="badge badge-green">{progress}% Complete</span>
                            </div>
                            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 24 }}>
                                Answer the following questions to activate the right data elements.
                            </p>

                            {/* Progress Bar */}
                            <div style={{ marginBottom: 20 }}>
                                <div className="progress-bar-track" style={{ height: 8 }}>
                                    <div className="progress-bar-fill green" style={{ width: `${progress}%` }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{answeredCount}/{totalQuestions} answered</span>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                                    onClick={() => { const a: Record<number, boolean> = {}; questions?.forEach(q => a[q.id] = false); setAnswers(a); }}>
                                    Answer All No
                                </button>
                                <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                                    onClick={() => { const a: Record<number, boolean> = {}; questions?.forEach(q => a[q.id] = true); setAnswers(a); }}>
                                    Answer All Yes
                                </button>
                            </div>

                            {loadingQuestions ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                                    {questions?.map((q, idx) => (
                                        <div key={q.id} style={{
                                            background: 'var(--bg-elevated)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '16px',
                                        }}>
                                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>
                                                {idx + 1}. {q.question_text}
                                            </p>
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Activates specific data elements in your checklist.</p>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <label style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '10px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: `1px solid ${answers[q.id] === false ? 'rgba(239,68,68,0.4)' : 'var(--border-subtle)'}`,
                                                    background: answers[q.id] === false ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                    color: answers[q.id] === false ? '#f87171' : 'var(--text-secondary)',
                                                    transition: 'all var(--transition-fast)',
                                                }}>
                                                    <input type="radio" name={`q_${q.id}`} style={{ display: 'none' }}
                                                        checked={answers[q.id] === false} onChange={() => setAnswers({ ...answers, [q.id]: false })} />
                                                    NO
                                                </label>
                                                <label style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '10px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: `1px solid ${answers[q.id] === true ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                                    background: answers[q.id] === true ? 'var(--accent-green-dim)' : 'var(--bg-card)',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                    color: answers[q.id] === true ? 'var(--accent-green)' : 'var(--text-secondary)',
                                                    transition: 'all var(--transition-fast)',
                                                }}>
                                                    <input type="radio" name={`q_${q.id}`} style={{ display: 'none' }}
                                                        checked={answers[q.id] === true} onChange={() => setAnswers({ ...answers, [q.id]: true })} />
                                                    YES
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button type="button" className="btn btn-ghost btn-lg" onClick={() => setStep(2)}>← Back</button>
                                <button type="submit" className="btn btn-primary btn-lg"
                                    disabled={submitAnswersMutation.isPending || answeredCount < totalQuestions}>
                                    {submitAnswersMutation.isPending
                                        ? 'Generating...'
                                        : (myAnswers && myAnswers.length > 0)
                                            ? 'Update & View Checklist →'
                                            : 'Generate Checklist →'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Selection Modals */}
            {activeModal && (
                <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
                    <div className="modal animate-scale-in" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">
                                {activeModal === 'emirate' ? 'Select Emirate' : 'Select Primary Sector'}
                            </span>
                            <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                                {(activeModal === 'emirate' ? EMIRATE_OPTIONS : SECTOR_OPTIONS).map(opt => {
                                    const isSelected = activeModal === 'emirate'
                                        ? companyData.emirate.toLowerCase() === opt.toLowerCase()
                                        : companyData.sector.toLowerCase() === opt.toLowerCase();

                                    // Icons for fun
                                    const icon = activeModal === 'emirate' ?
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> :
                                        opt === 'Hospitality' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14" /><path d="M9 11h2" /><path d="M9 15h2" /><path d="M13 11h2" /><path d="M13 15h2" /></svg> :
                                            opt === 'RealEstate' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M8 10h.01" /><path d="M16 10h.01" /><path d="M8 14h.01" /><path d="M16 14h.01" /></svg> :
                                                opt === 'Manufacturing' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20V4l8 4V4l8 4V4l4 4v12H2z" /><path d="M7 20v-4" /><path d="M12 20v-4" /><path d="M17 20v-4" /></svg> :
                                                    opt === 'Technology' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg> :
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;

                                    return (
                                        <div
                                            key={opt}
                                            className={`selection-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => {
                                                if (activeModal === 'emirate') {
                                                    setCompanyData({ ...companyData, emirate: opt as any });
                                                } else {
                                                    setCompanyData({ ...companyData, sector: opt as any });
                                                }
                                                setActiveModal(null);
                                            }}
                                            style={{
                                                padding: '16px 20px',
                                                borderRadius: 'var(--radius-lg)',
                                                border: `1px solid ${isSelected ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                                background: isSelected ? 'var(--accent-green-dim)' : 'var(--bg-card)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 16,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <div style={{ color: isSelected ? 'var(--accent-green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{icon}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, color: isSelected ? 'var(--accent-green)' : 'var(--text-primary)', fontSize: 15 }}>{opt}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {activeModal === 'emirate' ? `Region in UAE` : `Business Sector`}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div style={{ color: 'var(--accent-green)' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
