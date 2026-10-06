'use client';

import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Custom pulsing icon for user location
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="user-loc-pulse"></div><div class="user-loc-dot"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface Report {
  _id: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  severityScore: number;
  blockageType: string;
  status: string;
}

interface MapProps {
  reports: Report[];
  theme?: string;
  flyToLocation?: [number, number] | null;
}

function sevColor(s: number) {
  if (s <= 1) return '#22c55e';
  if (s <= 2) return '#4ade80';
  if (s <= 3) return '#f59e0b';
  if (s <= 4) return '#f97316';
  return '#ef4444';
}

function sevLabel(s: number) {
  if (s <= 1) return 'Minor';
  if (s <= 2) return 'Low';
  if (s <= 3) return 'Moderate';
  if (s <= 4) return 'High';
  return 'Critical';
}

// Free OpenStreetMap tiles — no API key needed
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/* ───── Locate Me Control ───── */
function LocateControl({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 15, { duration: 1.5 });
        onLocate(latitude, longitude);
        setLocating(false);
      },
      () => { setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map, onLocate]);

  return (
    <button
      onClick={handleLocate}
      className="map-locate-btn"
      title="Go to my location"
      aria-label="Go to my location"
    >
      {locating ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin-icon">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
        </svg>
      )}
    </button>
  );
}

/* ───── Fly-to handler ───── */
function FlyToHandler({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.5 });
    }
  }, [position, map]);
  return null;
}

/* ───── Theme handler — reactively toggle dark-tiles class ───── */
function ThemeHandler({ theme }: { theme: string }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (theme === 'dark') {
      container.classList.add('dark-tiles');
    } else {
      container.classList.remove('dark-tiles');
    }
  }, [theme, map]);
  return null;
}

export default function MapComponent({ reports, theme = 'dark', flyToLocation = null }: MapProps) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  const center: [number, number] = reports.length > 0
    ? [reports[0].latitude, reports[0].longitude]
    : [13.0827, 80.2707];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      attributionControl={false}
      zoomControl={false}
    >
      <TileLayer url={OSM_URL} />
      <ThemeHandler theme={theme} />

      <LocateControl onLocate={(lat, lng) => setUserPos([lat, lng])} />
      <FlyToHandler position={flyToLocation} />

      {/* User location marker */}
      {userPos && (
        <Marker position={userPos} icon={userLocationIcon}>
          <Popup>
            <div style={{ padding: '0.25rem', fontSize: '0.8125rem', fontWeight: 600 }}>
              📍 You are here
            </div>
          </Popup>
        </Marker>
      )}

      {/* Report markers */}
      {reports.map((rep) => {
        const color = sevColor(rep.severityScore);
        return (
          <Marker key={rep._id} position={[rep.latitude, rep.longitude]} icon={icon}>
            <Popup>
              <div style={{ minWidth: '200px', maxWidth: '260px', padding: '0.375rem' }}>
                <div style={{ borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '0.625rem', border: '1px solid var(--border)' }}>
                  <img src={rep.imageUrl} alt="" style={{ width: '100%', height: '6rem', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{
                      display: 'inline-block', width: '8px', height: '8px',
                      borderRadius: '50%', background: color,
                      boxShadow: `0 0 6px ${color}`,
                    }} />
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color }}>{sevLabel(rep.severityScore)}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>({rep.severityScore}/5)</span>
                  </div>
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 600, padding: '0.125rem 0.5rem', borderRadius: '999px',
                    background: rep.status === 'Resolved' ? 'var(--green-muted)' : rep.status === 'Dispatched' ? 'var(--blue-muted)' : 'var(--amber-muted)',
                    color: rep.status === 'Resolved' ? 'var(--green)' : rep.status === 'Dispatched' ? 'var(--blue)' : 'var(--amber)',
                  }}>
                    {rep.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>{rep.blockageType}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Severity halo circles */}
      {reports.map((rep) => {
        const color = sevColor(rep.severityScore);
        return (
          <CircleMarker
            key={`c-${rep._id}`}
            center={[rep.latitude, rep.longitude]}
            radius={rep.severityScore * 6 + 4}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: rep.severityScore >= 4 ? 0.15 : 0.08,
              weight: rep.severityScore >= 4 ? 2 : 1,
              opacity: rep.severityScore >= 4 ? 0.4 : 0.2,
            }}
          />
        );
      })}
    </MapContainer>
  );
}