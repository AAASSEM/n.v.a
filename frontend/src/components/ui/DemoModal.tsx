import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface DemoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DemoModal({ isOpen, onClose }: DemoModalProps) {
    const { demoLogin } = useAuthStore();
    const navigate = useNavigate();
    const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'roles' | 'data'>('roles');

    if (!isOpen) return null;

    const handleDemoLogin = async (email: string) => {
        try {
            setLoadingEmail(email);
            await demoLogin(email);
            // Navigate immediately — the dashboard has its own loading state
            // so the user sees the app shell right away instead of waiting on this modal
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setLoadingEmail(null);
        }
    };

    return (
        <div className="dm-overlay" onClick={onClose}>
            <style>{`
          .dm-overlay {
              position: fixed; inset: 0; z-index: 9999;
              background: rgba(5,6,16,0.92);
              display: flex; align-items: center; justify-content: center;
              padding: 24px;
              animation: fadeIn 0.2s ease-out;
          }
          .dm-modal {
              background: #0c0d1e; border: 1px solid rgba(255,255,255,0.08);
              border-radius: 20px; max-width: 620px; width: 100%;
              padding: 32px; box-shadow: 0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02);
              animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
              position: relative;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .spin { animation: spin 1s linear infinite; display: inline-block; transform-origin: center; }
          
          .dm-close {
              position: absolute; top: 20px; right: 20px;
              background: none; border: none; color: #9ca3af;
              font-size: 20px; cursor: pointer; transition: color 0.15s;
          }
          .dm-close:hover { color: #f0f2ff; }
          
          .dm-title { font-size: 22px; font-weight: 800; color: #f0f2ff; letter-spacing: -0.5px; margin-bottom: 8px; }
          .dm-sub { font-size: 13.5px; color: #9ca3af; line-height: 1.5; margin-bottom: 24px; font-weight: 300; }
          
          .dm-grid { display: flex; flex-direction: column; gap: 12px; }
          .dm-card {
              background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
              border-radius: 12px; padding: 16px 20px; display: flex; align-items: center;
              justify-content: space-between; cursor: pointer;
              transition: background 0.12s ease, border-color 0.12s ease;
              gap: 16px;
              will-change: background, border-color;
          }
          .dm-card:hover {
              background: rgba(16,185,129,0.06); border-color: rgba(16,185,129,0.35);
          }
          .dm-card-left { display: flex; align-items: flex-start; gap: 14px; flex: 1; }
          .dm-card-avatar {
              width: 40px; height: 40px; border-radius: 50%;
              background: linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.2) 100%);
              border: 1px solid rgba(16,185,129,0.3);
              display: flex; align-items: center; justify-content: center;
              color: #10b981; font-weight: 700; font-size: 14px; flex-shrink: 0;
          }
          .dm-card:nth-child(2) .dm-card-avatar { background: linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(79,70,229,0.2) 100%); border-color: rgba(99,102,241,0.3); color: #818cf8; }
          .dm-card:nth-child(3) .dm-card-avatar { background: linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.2) 100%); border-color: rgba(245,158,11,0.3); color: #fbbf24; }
          
          .dm-card-info { display: flex; flex-direction: column; text-align: left; }
          .dm-card-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
          .dm-card-name { font-size: 14.5px; font-weight: 700; color: #f0f2ff; }
          .dm-card-badge {
              font-family: ui-monospace, monospace; font-size: 9px;
              letter-spacing: 0.05em; text-transform: uppercase;
              padding: 2px 6px; border-radius: 4px;
              font-weight: 500;
          }
          .badge-super { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
          .badge-manager { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.2); }
          .badge-uploader { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
          
          .dm-card-desc { font-size: 12px; color: #9ca3af; line-height: 1.5; font-weight: 300; }
          .dm-card-arrow { color: #6b7280; font-size: 16px; transition: color 0.12s ease; }
          .dm-card:hover .dm-card-arrow { color: #10b981; }

          .dm-tabs { display: flex; gap: 16px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
          .dm-tab { background: none; border: none; font-size: 14px; font-weight: 600; color: #9ca3af; cursor: pointer; transition: color 0.15s; padding: 4px 8px; position: relative; }
          .dm-tab:hover { color: #f0f2ff; }
          .dm-tab.active { color: #10b981; }
          .dm-tab.active::after { content: ''; position: absolute; bottom: -13px; left: 0; right: 0; height: 2px; background: #10b981; border-radius: 2px; }

          .dm-data-panel { font-size: 13.5px; color: #9ca3af; line-height: 1.6; display: flex; flex-direction: column; gap: 16px; }
          .dm-data-title { font-weight: 700; color: #f0f2ff; font-size: 14.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
          .dm-data-box { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; position: relative; overflow: hidden; }
          .dm-data-box::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
          .dm-data-box.box-blue::before { background: #3b82f6; }
          .dm-data-box.box-green::before { background: #10b981; }
          .dm-data-box.box-purple::before { background: #8b5cf6; }
          
          .dm-icon-wrap { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
          .box-blue .dm-icon-wrap { background: rgba(59,130,246,0.15); color: #60a5fa; }
          .box-green .dm-icon-wrap { background: rgba(16,185,129,0.15); color: #34d399; }
          .box-purple .dm-icon-wrap { background: rgba(139,92,246,0.15); color: #a78bfa; }

          .dm-data-list { margin: 0; padding-left: 20px; color: #9ca3af; }
          .dm-data-list li { margin-bottom: 6px; }
            `}</style>
            <div className="dm-modal" onClick={e => e.stopPropagation()}>
                <button className="dm-close" onClick={onClose}>✕</button>
                <h2 className="dm-title">Explore ESGravity Demo</h2>
                <p className="dm-sub">Apex Hospitality — Realistic 4-Star Hotel Sustainability Model</p>

                <div className="dm-tabs">
                    <button className={`dm-tab ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>Select Persona</button>
                    <button className={`dm-tab ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>Data Sandbox Overview</button>
                </div>

                {activeTab === 'roles' ? (
                    <div className="dm-grid">
                        <div className="dm-card" style={loadingEmail === 'super@apex.demo' ? { opacity: 0.7, pointerEvents: 'none' } : {}} onClick={() => !loadingEmail && handleDemoLogin('super@apex.demo')}>
                            <div className="dm-card-left">
                                <div className="dm-card-avatar">SS</div>
                                <div className="dm-card-info">
                                    <div className="dm-card-name-row">
                                        <span className="dm-card-name">Sam Super (super@apex.demo)</span>
                                        <span className="dm-card-badge badge-super">Super Admin</span>
                                    </div>
                                    <span className="dm-card-desc">Full access to company-wide analytics, settings, audit trails, and developer controls.</span>
                                </div>
                            </div>
                            <span className="dm-card-arrow">{loadingEmail === 'super@apex.demo' ? <span className="spin">↻</span> : '→'}</span>
                        </div>

                        <div className="dm-card" style={loadingEmail === 'manager.a@apex.demo' ? { opacity: 0.7, pointerEvents: 'none' } : {}} onClick={() => !loadingEmail && handleDemoLogin('manager.a@apex.demo')}>
                            <div className="dm-card-left">
                                <div className="dm-card-avatar">MM</div>
                                <div className="dm-card-info">
                                    <div className="dm-card-name-row">
                                        <span className="dm-card-name">Mona Marina (manager.a@apex.demo)</span>
                                        <span className="dm-card-badge badge-manager">Site Manager</span>
                                    </div>
                                    <span className="dm-card-desc">Manages Dubai Marina Resort. Review dashboards, update meters, and sign off data submissions.</span>
                                </div>
                            </div>
                            <span className="dm-card-arrow">{loadingEmail === 'manager.a@apex.demo' ? <span className="spin">↻</span> : '→'}</span>
                        </div>

                        <div className="dm-card" style={loadingEmail === 'uploader.a1@apex.demo' ? { opacity: 0.7, pointerEvents: 'none' } : {}} onClick={() => !loadingEmail && handleDemoLogin('uploader.a1@apex.demo')}>
                            <div className="dm-card-left">
                                <div className="dm-card-avatar">UU</div>
                                <div className="dm-card-info">
                                    <div className="dm-card-name-row">
                                        <span className="dm-card-name">Usama Upload (uploader.a1@apex.demo)</span>
                                        <span className="dm-card-badge badge-uploader">Data Entry</span>
                                    </div>
                                    <span className="dm-card-desc">Assigned to Dubai Marina Resort. Restricted access to enter and upload monthly ESG telemetry metrics.</span>
                                </div>
                            </div>
                            <span className="dm-card-arrow">{loadingEmail === 'uploader.a1@apex.demo' ? <span className="spin">↻</span> : '→'}</span>
                        </div>
                    </div>
                ) : (
                    <div className="dm-data-panel">
                        <div className="dm-data-box box-blue">
                            <div className="dm-data-title">
                                <div className="dm-icon-wrap">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                Historical Depth (Jan 2019 – Jun 2026)
                            </div>
                            <div style={{ marginLeft: 32 }}>The database is pre-loaded with over 7 years of realistic hospitality telemetry. It models historical trends, including 2020-2021 COVID occupancy drops, subsequent recovery, and annual efficiency improvements.</div>
                        </div>
                        <div className="dm-data-box box-purple">
                            <div className="dm-data-title">
                                <div className="dm-icon-wrap">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
                                </div>
                                Property Portfolio
                            </div>
                            <ul className="dm-data-list" style={{ marginLeft: 12 }}>
                                <li><strong>Dubai Marina Resort:</strong> <span style={{ color: '#e2e8f0' }}>300 rooms</span>, full reporting suite.</li>
                                <li><strong>Abu Dhabi Downtown Hotel:</strong> <span style={{ color: '#e2e8f0' }}>240 rooms</span>, ~80% scale of the primary site.</li>
                            </ul>
                        </div>
                        <div className="dm-data-box box-green">
                            <div className="dm-data-title">
                                <div className="dm-icon-wrap">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 0 9.5a7 7 0 0 1-8 8.5z"/><path d="M19 2L11 10"/></svg>
                                </div>
                                Modeled Benchmarks & Frameworks
                            </div>
                            <div style={{ marginLeft: 32 }}>Data aligns with real UAE benchmarks (e.g., <span style={{ color: '#e2e8f0' }}>45 kWh</span> electricity / <span style={{ color: '#e2e8f0' }}>280 L</span> water per occupied room). Seasonality (summer AC load spikes) is accurately synthesized. Fully maps to ESG, Dubai Sustainable Tourism (DST), and Green Key standards.</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
