import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';

const CATEGORIES = [
    {
        id: 'environmental',
        label: 'Environmental Metrics',
        desc: 'Scope emissions, carbon tracking, and energy reporting.',
        count: 12,
        accent: '#10b981',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
                <path d="M12 2C6.5 7 6.5 17 12 22" />
                <path d="M12 2c5.5 5 5.5 15 0 20" />
            </svg>
        ),
    },
    {
        id: 'social',
        label: 'Social & Community',
        desc: 'DEI metrics, safety reporting, and evidence chains.',
        count: 8,
        accent: '#6366f1',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        id: 'governance',
        label: 'Governance & Frameworks',
        desc: 'GRI, TCFD, CSRD compliance and report generation.',
        count: 15,
        accent: '#8b5cf6',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
        ),
    },
    {
        id: 'platform',
        label: 'Platform Guidance',
        desc: 'User roles, data entry, meters, and integrations.',
        count: 24,
        accent: '#14b8a6',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
            </svg>
        ),
    },
];

const POPULAR = [
    { title: 'How to calculate Scope 2 emissions?', category: 'Environmental', tag: 'POPULAR' },
    { title: 'Uploading evidence for Green Key certification', category: 'Governance', tag: 'GUIDE' },
    { title: 'Adding new meters and data elements', category: 'Platform', tag: 'HOW-TO' },
    { title: 'Generating fiscal year sustainability reports', category: 'Governance', tag: 'GUIDE' },
    { title: 'User role levels and platform permissions', category: 'Platform', tag: 'REFERENCE' },
    { title: 'Setting up CSRD disclosure pipeline', category: 'Governance', tag: 'NEW' },
];

const TAG_COLORS: Record<string, string> = {
    POPULAR: '#10b981',
    GUIDE: '#6366f1',
    'HOW-TO': '#14b8a6',
    REFERENCE: '#f59e0b',
    NEW: '#ef4444',
};

export default function HelpCenterView() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const filtered = POPULAR.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AppLayout hideNav={true}>
            <div style={{ background: '#0e0f1a', minHeight: '100vh', padding: '40px 32px' }}>
                <style>{`
            .hc-root { font-family: 'Inter', system-ui, sans-serif; max-width: 1200px; margin: 0 auto; color: #f0f2ff; }

            /* ── BACK BUTTON ── */
            .hc-back {
              display: flex; align-items: center; gap: 8px;
              color: #6b7280; text-decoration: none; font-size: 13px;
              margin-bottom: 32px; cursor: pointer; border: none; background: transparent;
              transition: color 0.2s; padding: 0;
            }
            .hc-back:hover { color: #f0f2ff; }

            /* ── HERO ── */
            .hc-hero {
              text-align: center;
              padding: 20px 0 48px;
              position: relative;
            }
            .hc-hero::before {
              content: '';
              position: absolute;
              top: 0; left: 50%; transform: translateX(-50%);
              width: 600px; height: 300px;
              background: radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.1), transparent 70%);
              pointer-events: none;
            }
            .hc-eyebrow {
              display: inline-flex; align-items: center; gap: 8px;
              font-family: ui-monospace, monospace; font-size: 9.5px;
              letter-spacing: 0.22em; text-transform: uppercase;
              color: #10b981; border: 1px solid rgba(16,185,129,0.28);
              border-radius: 4px; padding: 5px 13px; margin-bottom: 20px;
              background: rgba(16,185,129,0.08);
            }
            .hc-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #10b981; animation: hcblink 1.4s infinite; }
            @keyframes hcblink { 0%,100%{opacity:1} 50%{opacity:0.2} }
            .hc-title {
              font-weight: 800;
              font-size: clamp(28px, 4vw, 44px); letter-spacing: -0.025em;
              color: #f0f2ff; margin-bottom: 12px; line-height: 1.1;
            }
            .hc-title em { font-style: normal; color: #10b981; }
            .hc-sub { font-size: 14px; color: #9ca3af; font-weight: 300; max-width: 420px; margin: 0 auto 32px; line-height: 1.7; }

            /* Search */
            .hc-search-wrap {
              max-width: 540px; margin: 0 auto; position: relative;
            }
            .hc-search-icon {
              position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
              color: #6b7280; pointer-events: none; transition: color 0.2s;
            }
            .hc-search-wrap:focus-within .hc-search-icon { color: #10b981; }
            .hc-search {
              width: 100%; height: 52px; padding: 0 20px 0 52px;
              background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
              border-radius: 12px; color: #f0f2ff; font-size: 14px;
              font-family: inherit; outline: none; transition: all 0.2s;
            }
            .hc-search::placeholder { color: #6b7280; }
            .hc-search:focus { border-color: rgba(16,185,129,0.35); background: rgba(16,185,129,0.04); box-shadow: 0 0 0 3px rgba(16,185,129,0.08); }
            .hc-search-shortcut {
              position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
              font-family: ui-monospace, monospace; font-size: 9px; color: #4b5563;
              background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
              padding: 3px 7px; border-radius: 4px; letter-spacing: 0.05em;
            }

            /* ── CATEGORIES ── */
            .hc-cats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
            @media (max-width: 900px) { .hc-cats { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 500px) { .hc-cats { grid-template-columns: 1fr; } }

            .hc-cat {
              background: rgba(255,255,255,0.025);
              border: 1px solid rgba(255,255,255,0.06);
              border-radius: 14px; padding: 20px;
              cursor: pointer; transition: all 0.2s;
              position: relative; overflow: hidden;
            }
            .hc-cat:hover { background: rgba(255,255,255,0.045); border-color: rgba(255,255,255,0.12); transform: translateY(-2px); }
            .hc-cat.active { border-color: var(--cat-accent); background: rgba(255,255,255,0.04); }
            .hc-cat.active::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--cat-accent); }

            .hc-cat-icon {
              width: 38px; height: 38px; border-radius: 10px;
              display: flex; align-items: center; justify-content: center;
              margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.06);
              transition: transform 0.2s;
            }
            .hc-cat:hover .hc-cat-icon { transform: scale(1.08); }
            .hc-cat-label { font-weight: 700; font-size: 13px; color: #f0f2ff; margin-bottom: 5px; letter-spacing: -0.01em; }
            .hc-cat-desc { font-size: 11.5px; color: #6b7280; line-height: 1.5; margin-bottom: 14px; font-weight: 300; }
            .hc-cat-count {
              font-family: ui-monospace, monospace; font-size: 9px;
              letter-spacing: 0.14em; text-transform: uppercase;
              display: inline-flex; align-items: center; gap: 6px;
            }
            .hc-cat-count-dot { width: 4px; height: 4px; border-radius: 50%; }

            /* ── BODY GRID ── */
            .hc-body { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
            @media (max-width: 900px) { .hc-body { grid-template-columns: 1fr; } }

            /* ── ARTICLES PANEL ── */
            .hc-articles-panel {
              background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
              border-radius: 16px; overflow: hidden;
            }
            .hc-articles-head {
              padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
              display: flex; align-items: center; justify-content: space-between;
            }
            .hc-articles-title { font-family: ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #9ca3af; }
            .hc-articles-count { font-family: ui-monospace, monospace; font-size: 9px; color: #4b5563; }

            .hc-article-row {
              display: flex; align-items: center; justify-content: space-between;
              padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.04);
              cursor: pointer; transition: background 0.15s; gap: 12px;
            }
            .hc-article-row:last-child { border-bottom: none; }
            .hc-article-row:hover { background: rgba(16,185,129,0.04); }
            .hc-article-row:hover .hc-article-arrow { opacity: 1; transform: translateX(0); color: #10b981; }
            .hc-article-row:hover .hc-article-title { color: #f0f2ff; }

            .hc-article-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
            .hc-article-tag {
              font-family: ui-monospace, monospace; font-size: 8px; letter-spacing: 0.1em;
              text-transform: uppercase; padding: 3px 7px; border-radius: 3px;
              white-space: nowrap; flex-shrink: 0; font-weight: 500;
            }
            .hc-article-title { font-size: 13.5px; color: #9ca3af; font-weight: 400; transition: color 0.15s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .hc-article-cat { font-family: ui-monospace, monospace; font-size: 9px; color: #4b5563; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap; flex-shrink: 0; }
            .hc-article-arrow { color: #4b5563; opacity: 0; transform: translateX(-6px); transition: all 0.2s; flex-shrink: 0; }

            /* ── SIDEBAR ── */
            .hc-sidebar { display: flex; flex-direction: column; gap: 14px; }

            /* Support card */
            .hc-support-card {
              border-radius: 14px; overflow: hidden; position: relative;
              background: linear-gradient(135deg, #1a1f3a 0%, #0f1729 100%);
              border: 1px solid rgba(99,102,241,0.2);
            }
            .hc-support-glow {
              position: absolute; top: -40px; right: -40px;
              width: 140px; height: 140px; border-radius: 50%;
              background: rgba(99,102,241,0.15); filter: blur(40px);
              pointer-events: none;
            }
            .hc-support-body { padding: 22px; position: relative; }
            .hc-support-badge {
              display: inline-flex; align-items: center; gap: 6px;
              font-family: ui-monospace, monospace; font-size: 8.5px;
              letter-spacing: 0.14em; text-transform: uppercase;
              color: #a5b4fc; background: rgba(99,102,241,0.12);
              border: 1px solid rgba(99,102,241,0.2); border-radius: 3px;
              padding: 3px 8px; margin-bottom: 14px;
            }
            .hc-support-title { font-weight: 700; font-size: 16px; color: #f0f2ff; margin-bottom: 8px; letter-spacing: -0.01em; line-height: 1.3; }
            .hc-support-sub { font-size: 12.5px; color: #9ca3af; line-height: 1.6; font-weight: 300; margin-bottom: 18px; }
            .hc-support-btn {
              width: 100%; padding: 11px 16px;
              background: #6366f1; color: #fff;
              border: none; border-radius: 8px; cursor: pointer;
              font-family: ui-monospace, monospace; font-size: 10.5px;
              letter-spacing: 0.1em; text-transform: uppercase;
              display: flex; align-items: center; justify-content: center; gap: 8px;
              transition: all 0.2s; font-weight: 500;
              box-shadow: 0 4px 16px rgba(99,102,241,0.25);
            }
            .hc-support-btn:hover { background: #818cf8; transform: translateY(-1px); }

            .hc-support-footer {
              padding: 12px 22px; border-top: 1px solid rgba(255,255,255,0.06);
              display: flex; align-items: center; gap: 8px;
            }
            .hc-avail-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: hcblink 1.4s infinite; flex-shrink: 0; }
            .hc-avail-text { font-family: ui-monospace, monospace; font-size: 9px; color: #6b7280; letter-spacing: 0.08em; }

            /* Updates card */
            .hc-updates-card {
              background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06);
              border-radius: 14px; overflow: hidden;
            }
            .hc-updates-head { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
            .hc-updates-label { font-family: ui-monospace, monospace; font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280; }
            .hc-updates-badge { font-family: ui-monospace, monospace; font-size: 8px; color: #10b981; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 2px 6px; border-radius: 3px; }

            .hc-update-item { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.04); }
            .hc-update-item:last-child { border-bottom: none; }
            .hc-update-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
            .hc-update-name { font-size: 12px; font-weight: 700; color: #f0f2ff; }
            .hc-update-date { font-family: ui-monospace, monospace; font-size: 8.5px; letter-spacing: 0.1em; }
            .hc-update-body { font-size: 12px; color: #6b7280; line-height: 1.5; font-weight: 300; }

            /* ── FOOTER BANNER ── */
            .hc-footer-banner {
              display: flex; align-items: center; justify-content: space-between;
              padding: 16px 20px; margin-top: 8px;
              background: rgba(255,255,255,0.018); border: 1px solid rgba(255,255,255,0.06);
              border-radius: 12px; gap: 16px; flex-wrap: wrap;
            }
            .hc-footer-left { display: flex; align-items: center; gap: 12px; }
            .hc-footer-icon { width: 32px; height: 32px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .hc-footer-text { font-size: 12.5px; color: #6b7280; font-weight: 300; }
            .hc-footer-text a { color: #f0f2ff; font-weight: 500; cursor: pointer; transition: color 0.2s; }
            .hc-footer-text a:hover { color: #10b981; }
            .hc-footer-version { font-family: ui-monospace, monospace; font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: #374151; flex-shrink: 0; }

            /* Stagger animation */
            .hc-fade { animation: hcFade 0.5s ease both; }
            @keyframes hcFade { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: none; } }
            .hc-fade-1 { animation-delay: 0.05s; }
            .hc-fade-2 { animation-delay: 0.12s; }
            .hc-fade-3 { animation-delay: 0.19s; }
            .hc-fade-4 { animation-delay: 0.26s; }
          `}</style>

                <div className="hc-root">
                    <button className="hc-back" onClick={() => navigate(-1)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to Platform
                    </button>

                    {/* ── HERO ── */}
                    <div className="hc-hero hc-fade">
                        <div className="hc-eyebrow">
                            <span className="hc-eyebrow-dot" />
                            Support Center
                        </div>
                        <h1 className="hc-title">
                            How can we <em>help you?</em>
                        </h1>
                        <p className="hc-sub">
                            Everything you need to master your environmental, social, and governance disclosures.
                        </p>

                        <div className="hc-search-wrap">
                            <span className="hc-search-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                className="hc-search"
                                placeholder="Search articles, guides, frameworks…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <span className="hc-search-shortcut">⌘ K</span>
                        </div>
                    </div>

                    {/* ── CATEGORIES ── */}
                    <div className="hc-cats hc-fade hc-fade-1">
                        {CATEGORIES.map(cat => (
                            <div
                                key={cat.id}
                                className={`hc-cat${activeCategory === cat.id ? ' active' : ''}`}
                                style={{ '--cat-accent': cat.accent } as React.CSSProperties}
                                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                            >
                                <div className="hc-cat-icon" style={{ background: `${cat.accent}15`, color: cat.accent }}>
                                    {cat.icon}
                                </div>
                                <div className="hc-cat-label">{cat.label}</div>
                                <div className="hc-cat-desc">{cat.desc}</div>
                                <div className="hc-cat-count" style={{ color: cat.accent }}>
                                    <span className="hc-cat-count-dot" style={{ background: cat.accent }} />
                                    {cat.count} articles
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── BODY ── */}
                    <div className="hc-body hc-fade hc-fade-2">

                        {/* Articles list */}
                        <div className="hc-articles-panel">
                            <div className="hc-articles-head">
                                <span className="hc-articles-title">
                                    {searchQuery ? `Results for "${searchQuery}"` : 'Popular Articles'}
                                </span>
                                <span className="hc-articles-count">{filtered.length} articles</span>
                            </div>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#4b5563', fontFamily: "inherit", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                    No results found
                                </div>
                            ) : (
                                filtered.map((article, idx) => (
                                    <div className="hc-article-row" key={idx}>
                                        <div className="hc-article-left">
                                            <span
                                                className="hc-article-tag"
                                                style={{
                                                    color: TAG_COLORS[article.tag] ?? '#9ca3af',
                                                    background: `${TAG_COLORS[article.tag] ?? '#9ca3af'}15`,
                                                    border: `1px solid ${TAG_COLORS[article.tag] ?? '#9ca3af'}30`,
                                                }}
                                            >
                                                {article.tag}
                                            </span>
                                            <span className="hc-article-title">{article.title}</span>
                                        </div>
                                        <span className="hc-article-cat">{article.category}</span>
                                        <span className="hc-article-arrow">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M5 12h14M12 5l7 7-7 7" />
                                            </svg>
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="hc-sidebar hc-fade hc-fade-3">

                            {/* Support card */}
                            <div className="hc-support-card">
                                <div className="hc-support-glow" />
                                <div className="hc-support-body">
                                    <div className="hc-support-badge">
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                                        24 / 7 Support
                                    </div>
                                    <div className="hc-support-title">Need direct assistance?</div>
                                    <div className="hc-support-sub">Our sustainability team is ready for technical and compliance support.</div>
                                    <button className="hc-support-btn">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.128.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.572 2.81.7A2 2 0 0 1 22 16.92z" />
                                        </svg>
                                        Contact Support
                                    </button>
                                </div>
                                <div className="hc-support-footer">
                                    <span className="hc-avail-dot" />
                                    <span className="hc-avail-text">Average response time · 4 minutes</span>
                                </div>
                            </div>

                            {/* Updates card */}
                            <div className="hc-updates-card">
                                <div className="hc-updates-head">
                                    <span className="hc-updates-label">Latest Updates</span>
                                    <span className="hc-updates-badge">2 NEW</span>
                                </div>
                                <div className="hc-update-item">
                                    <div className="hc-update-top">
                                        <span className="hc-update-name">v2.4.0 Release</span>
                                        <span className="hc-update-date" style={{ color: '#10b981' }}>MAR 2024</span>
                                    </div>
                                    <div className="hc-update-body">GRI 2021 Update synchronization and CSRD pipeline now live.</div>
                                </div>
                                <div className="hc-update-item">
                                    <div className="hc-update-top">
                                        <span className="hc-update-name">Security Patch</span>
                                        <span className="hc-update-date" style={{ color: '#6b7280' }}>FEB 2024</span>
                                    </div>
                                    <div className="hc-update-body">AES-256 evidence encryption is now standard across all accounts.</div>
                                </div>
                                <div className="hc-update-item">
                                    <div className="hc-update-top">
                                        <span className="hc-update-name">Scope 3 Wizard</span>
                                        <span className="hc-update-date" style={{ color: '#6b7280' }}>JAN 2024</span>
                                    </div>
                                    <div className="hc-update-body">New guided workflow for upstream and downstream Scope 3 data entry.</div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* ── FOOTER BANNER ── */}
                    <div className="hc-footer-banner hc-fade hc-fade-4">
                        <div className="hc-footer-left">
                            <div className="hc-footer-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" opacity="0.4" />
                                    <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
                                    <path d="M12 12L12 21" opacity="0.6" />
                                    <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
                                </svg>
                            </div>
                            <div className="hc-footer-text">
                                Looking for our <a>Terms of Use</a> or <a>Privacy Policy</a>?
                            </div>
                        </div>
                        <div className="hc-footer-version">ESG Compass v2.43</div>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}