import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

/* ─────────────────────────── tiny hooks ─────────────────────────── */
function useCountUp(target: number, duration = 2000, start = false) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime: number | null = null;
        const step = (ts: number) => {
            if (!startTime) startTime = ts;
            const p = Math.min((ts - startTime) / duration, 1);
            setVal(Math.floor(p * target));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [target, duration, start]);
    return val;
}

function useInView(threshold = 0.2) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, inView };
}

/* ─────────────────────────── data ─────────────────────────── */
const TICKERS = [
    { label: 'Carbon Offset', value: '−2.4t', delta: '↓ 12%' },
    { label: 'GRI Score', value: '98.2', delta: '↑ 4.1' },
    { label: 'Scope 1', value: '144 tCO₂', delta: '↓ 8%' },
    { label: 'Social Index', value: '87.5', delta: '↑ 2.3' },
    { label: 'Governance', value: 'AAA', delta: 'STABLE' },
    { label: 'Energy Use', value: '1.2 GWh', delta: '↓ 5%' },
    { label: 'Water', value: '340 kL', delta: '↓ 3%' },
    { label: 'Waste Recycled', value: '91%', delta: '↑ 6%' },
];

const FEATURES = [
    {
        num: '01', title: 'Carbon Intelligence', accent: '#10b981',
        body: 'Automate Scope 1, 2, and 3 emissions tracking with real-time telemetry. Connect data sources directly to your carbon footprint dashboard.',
        tags: ['Scope 1–3', 'Real-time', 'API-native'],
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /><path d="M12 2C6.5 7 6.5 17 12 22" /><path d="M12 2c5.5 5 5.5 15 0 20" /></svg>,
    },
    {
        num: '02', title: 'Social Metrics Engine', accent: '#6366f1',
        body: 'Monitor health & safety KPIs, DEI benchmarks, and community impact scores — backed by cryptographically signed evidence chains.',
        tags: ['DEI Tracking', 'Audit Trail', 'ISO 26000'],
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
    },
    {
        num: '03', title: 'Governance Command', accent: '#8b5cf6',
        body: 'Centralize compliance, board-level risk assessments, and disclosure reporting in a single auditable source of truth.',
        tags: ['SEC Aligned', 'TCFD Ready', 'SOC 2'],
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    },
    {
        num: '04', title: 'Automated Disclosures', accent: '#14b8a6',
        body: 'Generate GRI, SASB, TCFD, and CSRD reports at one click. Export audit-ready packages for any regulatory framework.',
        tags: ['GRI 2024', 'CSRD', 'SASB'],
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    },
];

const STEPS = [
    { n: '1', title: 'Connect Sources', body: 'Link ERP, IoT sensors, HR systems, and third-party data via 200+ native connectors.' },
    { n: '2', title: 'AI Normalizes Data', body: 'Our engine cleanses, classifies, and enriches raw data against global ESG taxonomies.' },
    { n: '3', title: 'Publish & Comply', body: 'Generate certified reports, share live dashboards with stakeholders, and file with regulators.' },
];

const LOGOS = ['Unilever', 'BlackRock', 'Nestlé', 'Siemens', 'Schneider', 'BASF', 'Philips', 'Danone'];

/* ─────────────────────────── component ─────────────────────────── */
export default function LandingPage() {
    const { isAuthenticated } = useAuthStore();
    const statsRef = useInView();
    const eff = useCountUp(94, 1800, statsRef.inView);
    const metrics = useCountUp(12, 2200, statsRef.inView);
    const clients = useCountUp(340, 1600, statsRef.inView);

    return (
        <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: '#050610', color: '#f0f2ff', minHeight: '100vh', overflowX: 'hidden' }}>
            <style>{`

        :root {
          --bg: #050610; --surface: #0c0d1e; --surface2: #111328;
          --border: rgba(255,255,255,0.06); --border-h: rgba(255,255,255,0.12);
          --green: #10b981; --green-dim: rgba(16,185,129,0.1); --green-glow: rgba(16,185,129,0.25);
          --muted: #6b7280; --muted2: #9ca3af;
        }

        * { box-sizing: border-box; }

        /* Grid texture */
        body::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 80px 80px;
        }

        /* NAV */
        .lp-nav { position: sticky; top: 0; z-index: 100; border-bottom: 1px solid var(--border); background: rgba(5,6,16,0.88); backdrop-filter: blur(20px); }
        .lp-nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 32px; height: 66px; display: flex; align-items: center; justify-content: space-between; }
        .lp-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        .lp-logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 9px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(16,185,129,0.3); }
        .lp-logo-name { font-family: inherit; font-weight: 800; font-size: 14px; letter-spacing: 0.06em; color: #f0f2ff; }
        .lp-logo-sub { font-family: ui-monospace, monospace; font-size: 8.5px; color: #10b981; letter-spacing: 0.22em; text-transform: uppercase; margin-top: 1px; }
        .lp-nav-links { display: flex; gap: 32px; }
        .lp-nav-links a { font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--muted); text-decoration: none; letter-spacing: 0.12em; text-transform: uppercase; transition: color 0.2s; }
        .lp-nav-links a:hover { color: #f0f2ff; }
        .lp-nav-cta { display: flex; align-items: center; gap: 16px; }
        .lp-btn-ghost { font-family: ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); text-decoration: none; transition: color 0.2s; }
        .lp-btn-ghost:hover { color: #10b981; }
        .lp-btn-primary { font-family: ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; background: #10b981; color: #000; padding: 9px 22px; border-radius: 7px; text-decoration: none; font-weight: 500; transition: all 0.2s; box-shadow: 0 0 18px rgba(16,185,129,0.3); }
        .lp-btn-primary:hover { background: #34d399; transform: translateY(-1px); }

        /* TICKER */
        .lp-ticker { border-bottom: 1px solid var(--border); background: var(--surface); overflow: hidden; height: 36px; position: relative; z-index: 10; }
        .lp-ticker-track { display: flex; white-space: nowrap; animation: lp-ticker-scroll 60s linear infinite; }
        @keyframes lp-ticker-scroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
        }
        .lp-ticker-item { display: inline-flex; align-items: center; gap: 10px; padding: 0 26px; height: 36px; border-right: 1px solid var(--border); flex-shrink: 0; }
        .lp-tick-lbl { font-family: ui-monospace, monospace; font-size: 9.5px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
        .lp-tick-val { font-family: ui-monospace, monospace; font-size: 10.5px; font-weight: 500; color: #f0f2ff; }
        .lp-tick-delta { font-family: ui-monospace, monospace; font-size: 9.5px; color: #10b981; }

        .lp-hero { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 80px 32px 100px; display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
        @media (max-width: 900px) { .lp-hero { grid-template-columns: 1fr; } .lp-hero-right { display: none; } }
        .lp-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-family: ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #10b981; border: 1px solid rgba(16,185,129,0.3); border-radius: 4px; padding: 5px 13px; margin-bottom: 30px; background: var(--green-dim); }
        .lp-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #10b981; animation: eblink 1.4s infinite; }
        @keyframes eblink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .lp-h1 { font-family: inherit; font-weight: 800; font-size: clamp(46px, 5.5vw, 76px); line-height: 1.0; letter-spacing: -0.03em; margin-bottom: 22px; }
        .lp-h1-green { color: #10b981; }
        .lp-h1-stroke { -webkit-text-stroke: 1.5px rgba(255,255,255,0.28); color: transparent; }
        .lp-hero-sub { font-size: 16px; line-height: 1.75; color: var(--muted2); max-width: 420px; margin-bottom: 40px; font-weight: 300; }
        .lp-hero-actions { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 52px; }
        .lp-btn-hero { font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 32px; border-radius: 9px; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 9px; transition: all 0.25s; border: none; cursor: pointer; }
        .lp-btn-hero-p { background: #10b981; color: #000; box-shadow: 0 0 28px rgba(16,185,129,0.3); }
        .lp-btn-hero-p:hover { background: #34d399; transform: translateY(-2px); box-shadow: 0 8px 36px rgba(16,185,129,0.35); }
        .lp-btn-hero-o { background: transparent; color: #f0f2ff; border: 1px solid rgba(255,255,255,0.12) !important; }
        .lp-btn-hero-o:hover { border-color: #10b981 !important; color: #10b981; }
        .lp-proof { display: flex; gap: 0; }
        .lp-proof-item { padding-right: 28px; margin-right: 28px; border-right: 1px solid var(--border); }
        .lp-proof-item:last-child { border-right: none; }
        .lp-proof-num { font-family: inherit; font-size: 28px; font-weight: 800; color: #f0f2ff; }
        .lp-proof-num span { color: #10b981; }
        .lp-proof-lbl { font-family: ui-monospace, monospace; font-size: 9px; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px; }

        /* DASHBOARD CARD */
        .lp-dash-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03); animation: cardIn 1s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes cardIn { from { opacity:0; transform: translateY(28px) scale(0.97); } to { opacity:1; transform: none; } }
        .lp-dash-topbar { display: flex; align-items: center; gap: 7px; padding: 11px 15px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.018); }
        .lp-dot { width: 8px; height: 8px; border-radius: 50%; }
        .lp-dash-url { margin-left: 8px; font-family: ui-monospace, monospace; font-size: 8.5px; color: var(--muted); background: rgba(255,255,255,0.04); padding: 3px 9px; border-radius: 3px; letter-spacing: 0.07em; }
        .lp-dash-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .lp-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
        .lp-kpi { background: rgba(255,255,255,0.022); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
        .lp-kpi-lbl { font-family: ui-monospace, monospace; font-size: 8.5px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 7px; }
        .lp-kpi-val { font-family: inherit; font-size: 20px; font-weight: 800; }
        .lp-kpi-delta { font-family: ui-monospace, monospace; font-size: 8.5px; color: #10b981; margin-top: 3px; }
        .lp-chart-box { background: rgba(255,255,255,0.018); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
        .lp-chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .lp-chart-title { font-family: ui-monospace, monospace; font-size: 9px; color: var(--muted2); letter-spacing: 0.08em; text-transform: uppercase; }
        .lp-chart-live { font-family: ui-monospace, monospace; font-size: 8.5px; color: #10b981; background: rgba(16,185,129,0.1); padding: 2px 7px; border-radius: 3px; }
        .lp-dash-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .lp-mini { background: rgba(255,255,255,0.022); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
        .lp-mini-lbl { font-family: ui-monospace, monospace; font-size: 8.5px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 9px; }
        .lp-bar-row { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
        .lp-bar-lbl { font-family: ui-monospace, monospace; font-size: 8.5px; color: var(--muted2); width: 22px; }
        .lp-bar-track { flex: 1; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
        .lp-bar-fill { height: 100%; border-radius: 2px; }
        .lp-bar-pct { font-family: ui-monospace, monospace; font-size: 8px; color: var(--muted); width: 26px; text-align: right; }

        /* LOGOS */
        .lp-logos { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); overflow: hidden; position: relative; z-index: 1; padding: 0; }
        .lp-logo-track { display: flex; animation: logoScroll 28s linear infinite; white-space: nowrap; }
        @keyframes logoScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .lp-logo-item { display: inline-flex; align-items: center; gap: 9px; padding: 22px 36px; font-family: inherit; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.15); letter-spacing: 0.05em; text-transform: uppercase; border-right: 1px solid var(--border); flex-shrink: 0; }

        /* FEATURES */
        .lp-feat-section { position: relative; z-index: 1; padding: 110px 32px; max-width: 1280px; margin: 0 auto; }
        .lp-sec-label { font-family: ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.25em; text-transform: uppercase; color: #10b981; margin-bottom: 18px; display: flex; align-items: center; gap: 12px; }
        .lp-sec-label::after { content: ''; width: 48px; height: 1px; background: rgba(16,185,129,0.4); }
        .lp-feat-h2 { font-family: inherit; font-size: clamp(32px, 4.5vw, 56px); font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 70px; max-width: 520px; }
        .lp-feat-h2 em { font-style: normal; color: #10b981; }
        .lp-feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
        @media (max-width: 680px) { .lp-feat-grid { grid-template-columns: 1fr; } }
        .lp-feat-card { padding: 40px 36px; background: var(--surface); position: relative; overflow: hidden; transition: background 0.3s; }
        .lp-feat-card:hover { background: var(--surface2); }
        .lp-feat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--accent, #10b981), transparent); opacity: 0; transition: opacity 0.3s; }
        .lp-feat-card:hover::before { opacity: 1; }
        .lp-feat-num { font-family: ui-monospace, monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.14em; margin-bottom: 22px; }
        .lp-feat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; border: 1px solid rgba(255,255,255,0.06); }
        .lp-feat-title { font-family: inherit; font-size: 20px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.01em; }
        .lp-feat-body { font-size: 13.5px; line-height: 1.72; color: var(--muted2); margin-bottom: 22px; font-weight: 300; }
        .lp-feat-tags { display: flex; gap: 7px; flex-wrap: wrap; }
        .lp-feat-tag { font-family: ui-monospace, monospace; font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 3px; border: 1px solid var(--border-h); color: var(--muted2); }

        /* STATS */
        .lp-stats-section { position: relative; z-index: 1; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: linear-gradient(135deg, rgba(16,185,129,0.04), rgba(99,102,241,0.04)); }
        .lp-stats-inner { max-width: 1280px; margin: 0 auto; padding: 90px 32px; display: grid; grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 680px) { .lp-stats-inner { grid-template-columns: 1fr 1fr; } }
        .lp-stat-cell { padding: 40px 36px; }
        .lp-stat-cell + .lp-stat-cell { border-left: 1px solid var(--border); }
        .lp-stat-num { font-family: inherit; font-size: clamp(40px, 4.5vw, 62px); font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin-bottom: 10px; }
        .lp-stat-num .ac { color: #10b981; }
        .lp-stat-lbl { font-family: ui-monospace, monospace; font-size: 9.5px; color: var(--muted); letter-spacing: 0.16em; text-transform: uppercase; }

        /* HOW */
        .lp-how-section { position: relative; z-index: 1; padding: 110px 32px; max-width: 1280px; margin: 0 auto; }
        .lp-how-steps { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 70px; border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
        @media (max-width: 680px) { .lp-how-steps { grid-template-columns: 1fr; } }
        .lp-step { padding: 44px 36px; background: var(--surface); position: relative; }
        .lp-step + .lp-step { border-left: 1px solid var(--border); }
        .lp-step-n { font-family: ui-monospace, monospace; font-size: 9.5px; color: var(--muted); letter-spacing: 0.2em; margin-bottom: 28px; }
        .lp-step-conn { position: absolute; top: 44px; right: -13px; width: 22px; height: 22px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 2; box-shadow: 0 0 14px rgba(16,185,129,0.4); }
        .lp-step-title { font-family: inherit; font-size: 20px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.01em; }
        .lp-step-body { font-size: 13.5px; line-height: 1.72; color: var(--muted2); font-weight: 300; }

        /* CTA */
        .lp-cta { position: relative; z-index: 1; border-top: 1px solid var(--border); background: radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.1), transparent 65%); padding: 130px 32px; text-align: center; }
        .lp-cta-eyebrow { font-family: ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.25em; text-transform: uppercase; color: #10b981; margin-bottom: 26px; }
        .lp-cta-h2 { font-family: inherit; font-size: clamp(40px, 5.5vw, 72px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.0; margin-bottom: 22px; }
        .lp-cta-h2 em { font-style: normal; color: #10b981; }
        .lp-cta-sub { font-size: 16px; color: var(--muted2); max-width: 440px; margin: 0 auto 48px; line-height: 1.75; font-weight: 300; }
        .lp-cta-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        /* FOOTER */
        .lp-footer { border-top: 1px solid var(--border); background: var(--surface); position: relative; z-index: 1; }
        .lp-footer-inner { max-width: 1280px; margin: 0 auto; padding: 56px 32px 36px; display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 44px; }
        @media (max-width: 800px) { .lp-footer-inner { grid-template-columns: 1fr 1fr; } }
        .lp-footer-brand { display: flex; flex-direction: column; gap: 14px; }
        .lp-footer-brand p { font-size: 13px; color: var(--muted); line-height: 1.7; font-weight: 300; max-width: 220px; }
        .lp-footer-col-title { font-family: ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 18px; }
        .lp-footer-links { display: flex; flex-direction: column; gap: 11px; }
        .lp-footer-links a { font-size: 13px; color: var(--muted2); text-decoration: none; transition: color 0.2s; font-weight: 300; }
        .lp-footer-links a:hover { color: #10b981; }
        .lp-footer-bottom { max-width: 1280px; margin: 0 auto; padding: 20px 32px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
        .lp-footer-copy { font-family: ui-monospace, monospace; font-size: 9px; color: var(--muted); letter-spacing: 0.1em; }
        .lp-footer-badges { display: flex; gap: 10px; }
        .lp-badge { font-family: ui-monospace, monospace; font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 3px; border: 1px solid var(--border-h); color: var(--muted); }

        /* ORBS */
        .lp-orb { position: fixed; border-radius: 50%; pointer-events: none; filter: blur(130px); z-index: 0; }
      `}</style>

            {/* Background orbs */}
            <div className="lp-orb" style={{ width: 580, height: 580, top: -180, left: -180, background: 'rgba(16,185,129,0.055)' }} />
            <div className="lp-orb" style={{ width: 480, height: 480, bottom: -140, right: -140, background: 'rgba(99,102,241,0.055)' }} />

            {/* ── NAV ── */}
            <nav className="lp-nav">
                <div className="lp-nav-inner">
                    <Link to="/" className="lp-logo">
                        <div className="lp-logo-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" opacity="0.4" />
                                <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
                                <path d="M12 12L12 21" opacity="0.6" />
                                <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
                            </svg>
                        </div>
                        <div>
                            <div className="lp-logo-name">ESG COMPASS</div>
                            <div className="lp-logo-sub">Sustainability Intelligence</div>
                        </div>
                    </Link>
                    <div className="lp-nav-links">
                        <a href="#features">Features</a>
                        <a href="#how">How It Works</a>
                        <a href="#metrics">Frameworks</a>
                        <a href="#security">Security</a>
                    </div>
                    <div className="lp-nav-cta">
                        {isAuthenticated ? (
                            <Link to="/dashboard" className="lp-btn-primary">Dashboard →</Link>
                        ) : (
                            <>
                                <Link to="/login" className="lp-btn-ghost">Login</Link>
                                <Link to="/signup" className="lp-btn-primary">Start Free →</Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── LIVE TICKER ── */}
            <div className="lp-ticker">
                <div className="lp-ticker-track">
                    {[...TICKERS, ...TICKERS, ...TICKERS, ...TICKERS].map((t, i) => (
                        <div className="lp-ticker-item" key={i}>
                            <span className="lp-tick-lbl">{t.label}</span>
                            <span className="lp-tick-val">{t.value}</span>
                            <span className="lp-tick-delta">{t.delta}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── HERO ── */}
            <section style={{ position: 'relative', zIndex: 1 }}>
                <div className="lp-hero">
                    {/* LEFT */}
                    <div>
                        <div className="lp-eyebrow"><span className="lp-eyebrow-dot" /> Now Compliant with GRI 2024 Standards</div>
                        <h1 className="lp-h1">
                            Measure<br />
                            what <span className="lp-h1-green">really</span><br />
                            <span className="lp-h1-stroke">matters.</span>
                        </h1>
                        <p className="lp-hero-sub">
                            The command center for corporate sustainability. Track emissions, automate disclosures, and transform ESG data into a genuine competitive edge.
                        </p>
                        <div className="lp-hero-actions">
                            <Link to="/signup" className="lp-btn-hero lp-btn-hero-p">
                                Start Free Trial
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </Link>
                            <button className="lp-btn-hero lp-btn-hero-o">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" /></svg>
                                Watch Demo
                            </button>
                        </div>
                        <div className="lp-proof">
                            <div className="lp-proof-item"><div className="lp-proof-num">94<span>%</span></div><div className="lp-proof-lbl">Efficiency Gain</div></div>
                            <div className="lp-proof-item"><div className="lp-proof-num">12<span>k+</span></div><div className="lp-proof-lbl">Metrics Tracked</div></div>
                            <div className="lp-proof-item" style={{ borderRight: 'none', marginRight: 0 }}><div className="lp-proof-num">340<span>+</span></div><div className="lp-proof-lbl">Enterprises</div></div>
                        </div>
                    </div>

                    {/* RIGHT — live-looking dashboard */}
                    <div className="lp-hero-right">
                        <div className="lp-dash-card">
                            <div className="lp-dash-topbar">
                                <div className="lp-dot" style={{ background: '#ef4444', opacity: 0.5 }} />
                                <div className="lp-dot" style={{ background: '#f59e0b', opacity: 0.5 }} />
                                <div className="lp-dot" style={{ background: '#10b981', opacity: 0.5 }} />
                                <span className="lp-dash-url">esg-compass.io/dashboard</span>
                            </div>
                            <div className="lp-dash-body">
                                <div className="lp-kpis">
                                    {[
                                        { l: 'Carbon Score', v: '98.2', d: '↑ 4.1', c: '#10b981' },
                                        { l: 'Scope 1 (tCO₂)', v: '144', d: '↓ 8%', c: '#10b981' },
                                        { l: 'GRI Rating', v: 'AAA', d: 'STABLE', c: '#6366f1' },
                                    ].map((k, i) => (
                                        <div className="lp-kpi" key={i}>
                                            <div className="lp-kpi-lbl">{k.l}</div>
                                            <div className="lp-kpi-val" style={{ color: k.c }}>{k.v}</div>
                                            <div className="lp-kpi-delta">{k.d}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="lp-chart-box">
                                    <div className="lp-chart-head">
                                        <span className="lp-chart-title">Emissions Trend — 12 Months</span>
                                        <span className="lp-chart-live">● LIVE</span>
                                    </div>
                                    <svg viewBox="0 0 380 88" style={{ width: '100%', height: 72 }}>
                                        <defs>
                                            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M0,65 L32,56 L63,61 L95,46 L127,51 L158,36 L190,40 L222,28 L253,33 L285,20 L317,26 L348,16 L380,18 L380,88 L0,88 Z" fill="url(#cg)" />
                                        <polyline points="0,65 32,56 63,61 95,46 127,51 158,36 190,40 222,28 253,33 285,20 317,26 348,16 380,18" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <circle cx="380" cy="18" r="3.5" fill="#10b981" />
                                        <circle cx="380" cy="18" r="3.5" fill="#10b981" opacity="0.3">
                                            <animate attributeName="r" from="3.5" to="12" dur="1.6s" repeatCount="indefinite" />
                                            <animate attributeName="opacity" from="0.3" to="0" dur="1.6s" repeatCount="indefinite" />
                                        </circle>
                                    </svg>
                                </div>

                                <div className="lp-dash-bottom">
                                    <div className="lp-mini">
                                        <div className="lp-mini-lbl">Scope Breakdown</div>
                                        {[{ l: 'S1', w: 35, c: '#10b981' }, { l: 'S2', w: 52, c: '#6366f1' }, { l: 'S3', w: 78, c: '#8b5cf6' }].map((b, i) => (
                                            <div className="lp-bar-row" key={i}>
                                                <span className="lp-bar-lbl">{b.l}</span>
                                                <div className="lp-bar-track"><div className="lp-bar-fill" style={{ width: `${b.w}%`, background: b.c }} /></div>
                                                <span className="lp-bar-pct">{b.w}%</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="lp-mini" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div>
                                            <div className="lp-mini-lbl" style={{ textAlign: 'center' }}>ESG Score</div>
                                            <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block', margin: '0 auto' }}>
                                                <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                                                <circle cx="40" cy="40" r="30" fill="none" stroke="#10b981" strokeWidth="6"
                                                    strokeDasharray="188" strokeDashoffset="28" strokeLinecap="round"
                                                    transform="rotate(-90 40 40)" />
                                                <text x="40" y="44" textAnchor="middle" style={{ fontFamily: 'inherit', fontSize: 16, fontWeight: 800, fill: '#f0f2ff' }}>A+</text>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── LOGO MARQUEE ── */}
            <div className="lp-logos">
                <div className="lp-logo-track">
                    {[...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS].map((n, i) => (
                        <span className="lp-logo-item" key={i}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-block' }} />
                            {n}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── FEATURES ── */}
            <section id="features" className="lp-feat-section">
                <div className="lp-sec-label">Platform Capabilities</div>
                <h2 className="lp-feat-h2">Everything you need to<br /><em>lead on sustainability.</em></h2>
                <div className="lp-feat-grid">
                    {FEATURES.map((f, i) => (
                        <div className="lp-feat-card" key={i} style={{ '--accent': f.accent } as React.CSSProperties}>
                            <div className="lp-feat-num">{f.num} / {String(FEATURES.length).padStart(2, '0')}</div>
                            <div className="lp-feat-icon" style={{ background: `${f.accent}18`, color: f.accent }}>{f.icon}</div>
                            <div className="lp-feat-title">{f.title}</div>
                            <div className="lp-feat-body">{f.body}</div>
                            <div className="lp-feat-tags">{f.tags.map((t, j) => <span className="lp-feat-tag" key={j}>{t}</span>)}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── STATS ── */}
            <section id="metrics" className="lp-stats-section">
                <div className="lp-stats-inner" ref={statsRef.ref}>
                    <div className="lp-stat-cell"><div className="lp-stat-num">{eff}<span className="ac">%</span></div><div className="lp-stat-lbl">Efficiency Gains</div></div>
                    <div className="lp-stat-cell"><div className="lp-stat-num">{metrics}<span className="ac">k+</span></div><div className="lp-stat-lbl">Metrics Tracked</div></div>
                    <div className="lp-stat-cell"><div className="lp-stat-num" style={{ fontSize: 'clamp(36px, 3.5vw, 52px)' }}>GRI<span className="ac">+</span></div><div className="lp-stat-lbl">Native Framework Support</div></div>
                    <div className="lp-stat-cell"><div className="lp-stat-num">{clients}<span className="ac">+</span></div><div className="lp-stat-lbl">Enterprise Clients</div></div>
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section id="how" className="lp-how-section">
                <div className="lp-sec-label">Process</div>
                <h2 className="lp-feat-h2" style={{ maxWidth: 460 }}>From raw data to<br /><em>certified reports.</em></h2>
                <div className="lp-how-steps">
                    {STEPS.map((s, i) => (
                        <div className="lp-step" key={i}>
                            <div className="lp-step-n">STEP {s.n}</div>
                            {i < STEPS.length - 1 && (
                                <div className="lp-step-conn">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                </div>
                            )}
                            <div className="lp-step-title">{s.title}</div>
                            <div className="lp-step-body">{s.body}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="lp-cta">
                <div className="lp-cta-eyebrow">Get Started Today</div>
                <h2 className="lp-cta-h2">Your sustainability<br />journey starts <em>now.</em></h2>
                <p className="lp-cta-sub">Join 340+ enterprises already using ESG Compass to turn compliance into competitive advantage.</p>
                <div className="lp-cta-actions">
                    <Link to="/signup" className="lp-btn-hero lp-btn-hero-p">
                        Start Free — No Card Required
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </Link>
                    <Link to="/contact" className="lp-btn-hero lp-btn-hero-o" style={{ textDecoration: 'none' }}>Talk to Sales</Link>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="lp-footer">
                <div className="lp-footer-inner">
                    <div className="lp-footer-brand">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="lp-logo-icon" style={{ width: 30, height: 30, borderRadius: 8 }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" opacity="0.4" />
                                    <path d="M12 12L12 3C12 3 14 4.5 14 6C14 7.5 12 9 12 9" fill="white" stroke="white" strokeWidth="1" />
                                    <path d="M12 12L12 21" opacity="0.6" />
                                    <circle cx="12" cy="12" r="1.5" fill="white" stroke="none" />
                                </svg>
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.05em', color: '#f0f2ff' }}>ESG COMPASS</span>
                        </div>
                        <p>The command center for corporate sustainability intelligence.</p>
                    </div>
                    {[
                        { title: 'Product', links: ['Features', 'Frameworks', 'Security', 'Changelog'] },
                        { title: 'Company', links: ['About', 'Careers', 'Blog', 'Press'] },
                        { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Cookies'] },
                    ].map((col, i) => (
                        <div key={i}>
                            <div className="lp-footer-col-title">{col.title}</div>
                            <div className="lp-footer-links">{col.links.map((l, j) => <a href="#" key={j}>{l}</a>)}</div>
                        </div>
                    ))}
                </div>
                <div className="lp-footer-bottom">
                    <span className="lp-footer-copy">© 2024 ESG COMPASS GLOBAL SYSTEMS — ALL RIGHTS RESERVED</span>
                    <div className="lp-footer-badges">
                        <span className="lp-badge">SOC 2</span>
                        <span className="lp-badge">ISO 27001</span>
                        <span className="lp-badge">GRI 2024</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}