'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100%', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', borderRadius: '0.75rem', background: 'var(--input-bg)',
    }}>
      <span style={{ color: 'var(--muted-fg)', fontSize: '0.8125rem' }}>Loading map…</span>
    </div>
  ),
});

interface Report {
  _id: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  severityScore: number;
  blockageType: string;
  status: string;
  createdAt: string;
}

/* ───── Small Components ───── */

function SeverityBar({ score }: { score: number }) {
  const color = score <= 1 ? 'var(--green)' : score <= 2 ? 'var(--green-bright)' : score <= 3 ? 'var(--amber)' : score <= 4 ? 'var(--orange)' : 'var(--red)';
  const label = score <= 1 ? 'Minor' : score <= 2 ? 'Low' : score <= 3 ? 'Moderate' : score <= 4 ? 'High' : 'Critical';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{
          display: 'inline-block', width: '6px', height: '6px',
          borderRadius: '50%', background: color,
          boxShadow: score >= 4 ? `0 0 6px ${color}` : 'none',
          animation: score >= 5 ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontWeight: 700, fontSize: '0.6875rem', color,
          fontVariantNumeric: 'tabular-nums', minWidth: '1.75rem',
        }}>
          {score}/5
        </span>
      </div>
      <div className="sev-bar" style={{ flex: 1 }}>
        <div className="sev-fill" style={{ width: `${(score / 5) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      </div>
      <span style={{
        fontSize: '0.5625rem', fontWeight: 700, color,
        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
        opacity: 0.85,
      }}>
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Resolved' ? 'badge-resolved' : status === 'Dispatched' ? 'badge-dispatched' : 'badge-pending';
  const icon = status === 'Resolved' ? '✓' : status === 'Dispatched' ? '→' : '●';
  return <span className={`badge ${cls}`}>{icon} {status}</span>;
}

function Stat({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className={`stat stat-${color} animate-in`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.9375rem' }}>{icon}</span>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function ThemeToggle({ theme, toggle }: { theme: string; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span className="theme-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}

/* ───── Delete Confirmation Modal ───── */
function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-overlay animate-in" onClick={onCancel}>
      <div className="modal-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🗑️</div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '0.375rem' }}>Delete Report?</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          This action cannot be undone. The report will be permanently removed.
        </p>
        <div style={{ display: 'flex', gap: '0.625rem', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1, padding: '0.625rem' }}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} style={{ flex: 1, padding: '0.625rem' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───── Main ───── */

export default function Home() {
  const [imageUrl, setImageUrl] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [locLoading, setLocLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem('kachrai-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('kachrai-theme', next);
  };

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports`);
      if (!res.ok) return; // backend error — keep existing reports
      const data = await res.json();
      if (Array.isArray(data)) setReports(data);
    } catch {
      // backend may not be running
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const showMsg = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const getLocation = () => {
    if (!navigator.geolocation) { showMsg('Geolocation not supported.', 'error'); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); showMsg('Location captured.', 'success'); setLocLoading(false); },
      (err) => { showMsg('Location error: ' + err.message, 'error'); setLocLoading(false); },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl || latitude === null || longitude === null) { showMsg('Provide an image URL and capture location first.', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, latitude, longitude }) });
      const data = await res.json();
      if (res.ok) { showMsg('Report submitted!', 'success'); setImageUrl(''); setLatitude(null); setLongitude(null); fetchReports(); }
      else { showMsg('Error: ' + data.error, 'error'); }
    } catch { showMsg('Server connection failed.', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/reports/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r._id !== id));
        showMsg('Report deleted.', 'success');
      } else {
        showMsg('Failed to delete report.', 'error');
      }
    } catch {
      showMsg('Server connection failed.', 'error');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const total = reports.length;
  const pending = reports.filter(r => r.status === 'Pending').length;
  const critical = reports.filter(r => r.severityScore >= 4).length;
  const resolved = reports.filter(r => r.status === 'Resolved').length;

  const timeAgo = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ═══ Navbar ═══ */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="logo-mark">K</div>
          <div>
            <span style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
              KachrAI
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="nav-tag">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
            Live
          </span>
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
      </nav>

      {/* ═══ Content ═══ */}
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '76rem', margin: '0 auto', width: '100%' }}>

        {/* Stats */}
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Stat icon="📊" label="Total" value={total} color="green" />
          <Stat icon="⏳" label="Pending" value={pending} color="amber" />
          <Stat icon="🔴" label="Critical" value={critical} color="red" />
          <Stat icon="✅" label="Resolved" value={resolved} color="blue" />
        </div>

        {/* Main Grid */}
        <div className="main-grid">

          {/* ── Left: Form ── */}
          <div className="card glass animate-in" style={{ padding: '1.5rem' }}>
            <p className="section-title">Report</p>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--fg)' }}>
              Submit a Chokeage Report
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Image URL */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="input"
                  required
                />
                {imageUrl && (
                  <div style={{
                    marginTop: '0.5rem', borderRadius: '0.625rem', overflow: 'hidden',
                    border: '1px solid var(--border)', height: '7rem',
                    position: 'relative',
                  }}>
                    <img
                      src={imageUrl} alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="img-preview-gradient" />
                  </div>
                )}
              </div>

              {/* GPS */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  Location
                </label>
                <button type="button" onClick={getLocation} className="btn btn-secondary" disabled={locLoading} style={{ width: '100%' }}>
                  {locLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="spinner" /> Capturing…
                    </span>
                  ) : '📍 Capture GPS'}
                </button>
                {latitude !== null && longitude !== null && (
                  <div className="gps-tag animate-in">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </div>
                )}
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <span className="spinner" /> Analyzing…
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Submit Report
                  </span>
                )}
              </button>
            </form>

            {/* Toast */}
            {message && (
              <div className={`toast animate-in ${messageType === 'success' ? 'toast-success' : messageType === 'error' ? 'toast-error' : 'toast-info'}`}
                style={{ marginTop: '0.875rem' }}>
                <span>{messageType === 'success' ? '✓' : messageType === 'error' ? '✕' : 'ℹ'}</span>
                {message}
              </div>
            )}
          </div>

          {/* ── Right: Map + Feed ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Map */}
            <div className="card animate-in" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="section-title" style={{ marginBottom: 0 }}>Live Map</p>
                <span style={{ fontSize: '0.625rem', color: 'var(--muted-fg)' }}>Click 📍 on map to locate yourself</span>
              </div>
              <div style={{ height: '22rem', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <MapComponent reports={reports} theme={theme} />
              </div>
            </div>

            {/* Feed */}
            <div className="card animate-in" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <p className="section-title">Feed</p>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>Recent Reports</h3>
                </div>
                <span className="badge badge-pending">{reports.length} total</span>
              </div>

              <div style={{ maxHeight: '22rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {reports.length === 0 ? (
                  <div className="empty-state">
                    <p style={{ fontSize: '2rem', marginBottom: '0.375rem' }}>📭</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>No reports yet</p>
                    <p style={{ fontSize: '0.75rem' }}>Submit one to get started</p>
                  </div>
                ) : (
                  reports.map((rep) => (
                    <div
                      key={rep._id}
                      className={`report-item ${rep.severityScore >= 5 ? 'report-critical' : ''} ${deletingId === rep._id ? 'report-deleting' : ''}`}
                    >
                      {/* Thumb */}
                      <div style={{
                        width: '3.5rem', height: '3.5rem', borderRadius: '0.5rem', overflow: 'hidden',
                        flexShrink: 0, border: '1px solid var(--border)', background: 'var(--input-bg)',
                      }}>
                        <img src={rep.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <SeverityBar score={rep.severityScore} />
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rep.blockageType}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                            <StatusBadge status={rep.status} />
                            <button
                              className="btn-icon-delete"
                              title="Delete report"
                              aria-label="Delete report"
                              onClick={() => setDeleteTarget(rep._id)}
                              disabled={deletingId === rep._id}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.625rem', color: 'var(--muted-fg)', fontFamily: 'var(--font-mono, monospace)' }}>
                            {rep.latitude.toFixed(3)}, {rep.longitude.toFixed(3)}
                          </span>
                          <span style={{ fontSize: '0.625rem', color: 'var(--muted-fg)' }}>
                            {timeAgo(rep.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>


      {/* ═══ Delete Confirmation Modal ═══ */}
      {deleteTarget && (
        <DeleteModal
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}