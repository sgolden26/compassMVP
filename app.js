/**
 * EW Signal App - Main UI and compass logic.
 */

import { HIGH_CONFIDENCE_THRESHOLD, THREAT_LEVEL_MIN, THREAT_LEVEL_MAX } from './config.js';
import { DummyDataProvider } from './data-provider.js';

const dataProvider = new DummyDataProvider();

const CARDINALS = [
  { name: 'N', min: 348.75, max: 360 }, { name: 'N', min: 0, max: 11.25 },
  { name: 'NE', min: 11.25, max: 56.25 }, { name: 'E', min: 56.25, max: 101.25 },
  { name: 'SE', min: 101.25, max: 146.25 }, { name: 'S', min: 146.25, max: 191.25 },
  { name: 'SW', min: 191.25, max: 236.25 }, { name: 'W', min: 236.25, max: 281.25 },
  { name: 'NW', min: 281.25, max: 348.75 },
];

const RELATIVE = [
  { name: 'ahead', min: 337.5, max: 22.5 }, { name: 'ahead right', min: 22.5, max: 67.5 },
  { name: 'right', min: 67.5, max: 112.5 }, { name: 'behind right', min: 112.5, max: 157.5 },
  { name: 'behind', min: 157.5, max: 202.5 }, { name: 'behind left', min: 202.5, max: 247.5 },
  { name: 'left', min: 247.5, max: 292.5 }, { name: 'ahead left', min: 292.5, max: 337.5 },
];

function bearingToCardinal(deg) {
  const d = ((deg % 360) + 360) % 360;
  const c = CARDINALS.find((r) => d >= r.min && d < r.max);
  return c ? c.name : 'N';
}

function bearingToRelative(deg) {
  const d = ((deg % 360) + 360) % 360;
  const r = RELATIVE.find((x) => d >= x.min && d < x.max);
  return r ? r.name : 'ahead';
}

function relativeBearing(deviceHeading, threatBearing) {
  return ((threatBearing - deviceHeading) % 360 + 360) % 360;
}

function formatDirection(deviceHeading, threatBearing) {
  const rel = relativeBearing(deviceHeading, threatBearing);
  const deg = Math.round(rel);
  const card = bearingToCardinal(rel);
  const relText = bearingToRelative(rel);
  return `${String(deg).padStart(3, '0')}° ${card}, ${relText}`;
}

function confidenceToThreatLevel(confidence) {
  if (confidence == null) return 5;
  const level = Math.round(1 + (1 - confidence) * 9);
  return Math.max(THREAT_LEVEL_MIN, Math.min(THREAT_LEVEL_MAX, level));
}

function threatLevelToGradient(level) {
  const t = (level - THREAT_LEVEL_MIN) / (THREAT_LEVEL_MAX - THREAT_LEVEL_MIN);
  const r = t <= 0.5 ? 1 : 1 - (t - 0.5) * 2;
  const g = t <= 0.5 ? t * 2 : 1;
  const b = 0;
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

const el = (id) => document.getElementById(id);
const elements = {
  root: document.documentElement,
  threatLevel: el('threat-level'),
  primaryLabel: el('primary-label'),
  directionText: el('direction-text'),
  compassCanvas: el('compass-canvas'),
  secondaryList: el('secondary-list'),
};

const SECONDARY_COLORS = ['#6b7280', '#9ca3af']; // gray tones so primary DRONE pops

function drawCompass(deviceHeading, threats, showSecondary) {
  const canvas = elements.compassCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight, 320);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);
  const r = size / 2;
  const cx = r;
  const cy = r;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-deviceHeading * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  const cardinals = ['N', 'E', 'S', 'W'];
  for (let i = 0; i < 360; i += 15) {
    const rad = (i * Math.PI) / 180;
    const inner = r - (i % 90 === 0 ? 20 : 10);
    const outer = r - 4;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = i % 90 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(rad) * inner, cy - Math.cos(rad) * inner);
    ctx.lineTo(cx + Math.sin(rad) * outer, cy - Math.cos(rad) * outer);
    ctx.stroke();
    if (i % 90 === 0) {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tx = cx + Math.sin(rad) * (r - 24);
      const ty = cy - Math.cos(rad) * (r - 24);
      ctx.fillText(cardinals[i / 90], tx, ty);
      const deg = (360 - i) % 360;
      ctx.font = '10px sans-serif';
      ctx.fillText(deg + '°', cx + Math.sin(rad) * (r - 38), cy - Math.cos(rad) * (r - 38));
    }
  }
  ctx.restore();

  const needleRad = (deviceHeading * Math.PI) / 180;
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(needleRad) * (r - 8), cy - Math.cos(needleRad) * (r - 8));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  const primary = threats[0];
  if (primary) {
    const rel = relativeBearing(deviceHeading, primary.bearing);
    const rad = (rel * Math.PI) / 180;
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(rad) * (r - 12), cy - Math.cos(rad) * (r - 12));
    ctx.stroke();
  }

  if (showSecondary && threats.length > 1) {
    threats.slice(1, 3).forEach((t, i) => {
      const rel = relativeBearing(deviceHeading, t.bearing);
      const rad = (rel * Math.PI) / 180;
      ctx.strokeStyle = SECONDARY_COLORS[i] || '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(rad) * (r - 14), cy - Math.cos(rad) * (r - 14));
      ctx.stroke();
    });
  }
}

let lastData = { threats: [], device: { heading: 0 } };

function render(data) {
  const { threats = [], device = {} } = data;
  const heading = device.heading ?? 0;
  const sorted = [...threats].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const primary = sorted[0];
  const showOthers = !primary || primary.confidence < HIGH_CONFIDENCE_THRESHOLD;
  const secondary = showOthers ? sorted.slice(1, 3) : [];

  const level = primary ? confidenceToThreatLevel(primary.confidence) : 5;
  const color = threatLevelToGradient(level);

  elements.root.style.setProperty('--threat-bg', color);
  if (elements.threatLevel) elements.threatLevel.textContent = `Threat Level: ${level}`;

  if (primary) {
    if (elements.primaryLabel) elements.primaryLabel.textContent = primary.label;
    if (elements.directionText) elements.directionText.textContent = formatDirection(heading, primary.bearing);
  } else {
    if (elements.primaryLabel) elements.primaryLabel.textContent = '—';
    if (elements.directionText) elements.directionText.textContent = '—';
  }

  if (elements.secondaryList) {
    elements.secondaryList.innerHTML = secondary
      .map((t, i) => {
        const dir = formatDirection(heading, t.bearing);
        const hex = SECONDARY_COLORS[i] || '#666';
        return `<li style="color:${hex}"><strong>${t.label}</strong> ${Math.round((t.confidence || 0) * 100)}% — ${dir}</li>`;
      })
      .join('');
  }
  const secondarySection = document.querySelector('.secondary-section');
  if (secondarySection) secondarySection.hidden = secondary.length === 0;

  drawCompass(heading, primary ? [primary, ...secondary] : [], showOthers);
}

function init() {
  const unsub = dataProvider.subscribe((data) => {
    lastData = data;
    render(data);
  });
  dataProvider.connect();
  window.addEventListener('resize', () => render(lastData));
  window.addEventListener('beforeunload', () => {
    dataProvider.disconnect();
    unsub();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    init();
  });
} else {
  init();
}
