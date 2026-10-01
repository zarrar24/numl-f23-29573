(()=>{
'use strict';

const $ = id => document.getElementById(id);
const de = document.documentElement, body = document.body;
const cv = $('overlay'), cx = cv.getContext('2d');

/* Synthesized Web Audio Sound Generator (No external files) */
let soundEnabled = true;
let audioCtx = null;
function playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.05) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (err) {}
}

const sounds = {
  click: () => playTone(820, 'sine', 0.05, 0.04),
  rage: () => { playTone(160, 'sawtooth', 0.25, 0.1); playTone(120, 'square', 0.2, 0.08); },
  mode: () => playTone(1100, 'triangle', 0.04, 0.03),
  undo: () => playTone(440, 'sine', 0.1, 0.05)
};

/* Core State */
const S = {
  on: true,
  t0: Date.now(),
  pausedMs: 0,
  pauseAt: 0,
  id: 'nt_' + Math.random().toString(36).slice(2, 9),
  ev: [],
  clicks: [],
  moves: [],
  scrolls: [],
  rage: 0,
  depth: 0,
  marks: {},
  mode: 'clicks',
  dwell: {},
  since: {},
  inView: {},
  lastMove: 0,
  lastScroll: 0,
  recent: []
};

const MAX_EV = 25000, MAX_MV = 5000, LOG_MAX = 100;
const iso = () => new Date().toISOString();
const ignored = e => !!e.target.closest('[data-ignore]');
const elapsed = () => Math.max(0, Math.floor(((S.on ? Date.now() : S.pauseAt) - S.t0 - S.pausedMs) / 1000));
const fmt = s => s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's';

function label(el) {
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  else if (typeof el.className === 'string' && el.className.trim()) {
    s += '.' + el.className.trim().split(/\s+/)[0];
  }
  const t = (el.innerText || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ');
  return t ? s + ' "' + (t.length > 24 ? t.slice(0, 24) + '…' : t) + '"' : s;
}

function logEvent(e) {
  const box = $('log');
  if (!box) return;
  const d = document.createElement('div');
  let badgeClass = 'badge-move';
  if (e.type === 'click') badgeClass = 'badge-click';
  else if (e.type === 'rage_click') badgeClass = 'badge-rage';
  else if (e.type.includes('scroll')) badgeClass = 'badge-scroll';
  else if (e.type.includes('visibility')) badgeClass = 'badge-view';

  d.innerHTML = `
    <span style="color:var(--ink-dim)">${e.timestamp.slice(11, 23)}</span>
    <span class="badge-ev ${badgeClass}">${e.type.toUpperCase()}</span>
    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${e.label || (e.percent ? e.percent + '%' : '') || ''}</span>
  `;
  box.prepend(d);
  while (box.children.length > LOG_MAX) box.lastChild.remove();
  const sc = $('streamCount');
  if (sc) sc.textContent = S.ev.length + ' entries';
}

function rec(type, d = {}) {
  if (!S.on) return;
  const e = { session: S.id, type, timestamp: iso(), ms: Date.now() - S.t0 - S.pausedMs, ...d };
  S.ev.push(e);
  if (S.ev.length > MAX_EV) S.ev.shift();
  const logAll = $('logAll');
  if ((logAll && logAll.checked) || (type !== 'mousemove' && type !== 'scroll')) {
    logEvent(e);
  }
  updateStats();
}

function updateStats() {
  if ($('mEv')) $('mEv').textContent = S.ev.length;
  if ($('mCl')) $('mCl').textContent = S.clicks.length;
  if ($('mRg')) $('mRg').textContent = S.rage;
  if ($('mMv')) $('mMv').textContent = S.moves.length;
  if ($('mSc')) $('mSc').textContent = S.scrolls.length;
  if ($('mDp')) $('mDp').textContent = S.depth + '%';
  if ($('mTm')) $('mTm').textContent = fmt(elapsed());
  if ($('mLast')) $('mLast').textContent = S.clicks.length ? S.clicks[S.clicks.length - 1].label : '—';
  
  if (S.rage > 0 && $('chipRage')) $('chipRage').classList.add('rage');
  
  // Real-time dwell badges on sections
  Object.keys(S.dwell).forEach(sec => {
    const el = $('dwell-' + sec);
    if (el) el.textContent = '⏱ ' + (dwellMs(sec) / 1000).toFixed(1) + 's in view';
  });
}

/* Canvas Sizing & Multi-Mode Renderers */
function size() {
  if (!cv || !cx) return;
  const w = Math.max(de.scrollWidth, body.scrollWidth);
  const h = Math.max(de.scrollHeight, body.scrollHeight);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
  }
  draw();
}

function draw() {
  if (!cv || !cx) return;
  cx.clearRect(0, 0, cv.width, cv.height);
  const m = S.mode;
  if (m === 'off') return;

  const isLight = de.getAttribute('data-theme') === 'light';
  const primary = isLight ? '#4f46e5' : '#6366f1';
  const cyan = isLight ? '#0284c7' : '#06b6d4';

  /* Mode 1: Clicks (Layered Glowing Circular Badges) */
  if (m === 'clicks') {
    S.clicks.forEach((c, idx) => {
      const isLatest = idx === S.clicks.length - 1;
      
      // Outer halo
      cx.beginPath();
      cx.arc(c.pageX, c.pageY, isLatest ? 18 : 13, 0, Math.PI * 2);
      cx.fillStyle = isLatest ? 'rgba(6, 182, 212, 0.35)' : 'rgba(99, 102, 241, 0.22)';
      cx.fill();

      // Main core
      cx.beginPath();
      cx.arc(c.pageX, c.pageY, 10, 0, Math.PI * 2);
      cx.fillStyle = isLatest ? cyan : primary;
      cx.fill();
      cx.lineWidth = 2;
      cx.strokeStyle = '#ffffff';
      cx.stroke();

      // Number badge
      cx.fillStyle = '#ffffff';
      cx.font = 'bold 10px var(--font-mono), monospace';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(c.n, c.pageX, c.pageY);
    });
  }

  /* Mode 2: Multi-Stop Thermal Heatmap */
  else if (m === 'heat') {
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    S.clicks.forEach(c => {
      const radius = 58;
      const g = cx.createRadialGradient(c.pageX, c.pageY, 0, c.pageX, c.pageY, radius);
      g.addColorStop(0.0, 'rgba(255, 255, 255, 0.7)');
      g.addColorStop(0.18, 'rgba(244, 63, 94, 0.45)');
      g.addColorStop(0.45, 'rgba(245, 158, 11, 0.25)');
      g.addColorStop(0.75, 'rgba(6, 182, 212, 0.12)');
      g.addColorStop(1.0, 'rgba(99, 102, 241, 0)');
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(c.pageX, c.pageY, radius, 0, Math.PI * 2);
      cx.fill();
    });
    cx.restore();
  }

  /* Mode 3: Precision Scatter Reticles */
  else if (m === 'scatter') {
    S.clicks.forEach(c => {
      cx.strokeStyle = cyan;
      cx.lineWidth = 1.5;
      
      // Reticle ring
      cx.beginPath();
      cx.arc(c.pageX, c.pageY, 7, 0, Math.PI * 2);
      cx.stroke();

      // Crosshairs
      cx.beginPath();
      cx.moveTo(c.pageX - 11, c.pageY); cx.lineTo(c.pageX + 11, c.pageY);
      cx.moveTo(c.pageX, c.pageY - 11); cx.lineTo(c.pageX + 11, c.pageY);
      cx.stroke();

      cx.beginPath();
      cx.arc(c.pageX, c.pageY, 2.5, 0, Math.PI * 2);
      cx.fillStyle = '#fff';
      cx.fill();
    });
  }

  /* Mode 4: Move Points with Velocity Fading */
  else if (m === 'moves') {
    const len = S.moves.length;
    S.moves.forEach((p, i) => {
      const progress = i / len;
      cx.fillStyle = isLight ? `rgba(79, 70, 229, ${0.15 + progress * 0.6})` : `rgba(6, 182, 212, ${0.15 + progress * 0.7})`;
      cx.fillRect(p.pageX - 2, p.pageY - 2, 4, 4);
    });
  }

  /* Mode 5: Directed Vector Spline Path */
  else if (m === 'path' && S.moves.length > 1) {
    const pts = [S.moves[0]];
    S.moves.forEach(p => {
      const q = pts[pts.length - 1];
      if (Math.hypot(p.pageX - q.pageX, p.pageY - q.pageY) >= 22) pts.push(p);
    });

    if (pts.length < 2) return;

    // Path Line
    cx.lineWidth = 2.5;
    cx.lineCap = 'round';
    cx.lineJoin = 'round';
    const grad = cx.createLinearGradient(pts[0].pageX, pts[0].pageY, pts[pts.length - 1].pageX, pts[pts.length - 1].pageY);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, cyan);
    grad.addColorStop(1, primary);
    cx.strokeStyle = grad;

    cx.beginPath();
    pts.forEach((p, i) => i === 0 ? cx.moveTo(p.pageX, p.pageY) : cx.lineTo(p.pageX, p.pageY));
    cx.stroke();

    // Directional arrows
    for (let i = 1; i < pts.length; i += 4) {
      const p0 = pts[i - 1], p1 = pts[i];
      const angle = Math.atan2(p1.pageY - p0.pageY, p1.pageX - p0.pageX);
      cx.save();
      cx.translate(p1.pageX, p1.pageY);
      cx.rotate(angle);
      cx.fillStyle = cyan;
      cx.beginPath();
      cx.moveTo(5, 0);
      cx.lineTo(-4, -3);
      cx.lineTo(-4, 3);
      cx.closePath();
      cx.fill();
      cx.restore();
    }

    // Start / End chips
    const a = pts[0], b = pts[pts.length - 1];
    
    // Start
    cx.fillStyle = '#10b981';
    cx.beginPath(); cx.arc(a.pageX, a.pageY, 6, 0, Math.PI * 2); cx.fill();
    cx.font = 'bold 11px var(--font-mono)';
    cx.fillText('START', a.pageX + 10, a.pageY - 8);

    // End
    cx.fillStyle = primary;
    cx.beginPath(); cx.arc(b.pageY ? b.pageX : 0, b.pageY, 7, 0, Math.PI * 2); cx.fill();
    cx.fillText('CURRENT', b.pageX + 10, b.pageY - 8);
  }
}

function setMode(m) {
  S.mode = m;
  sounds.mode();
  document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  draw();
}

/* Spawn Dynamic Click Ripple */
function spawnRipple(x, y) {
  const rip = document.createElement('div');
  rip.className = 'click-ripple';
  rip.style.left = x + 'px';
  rip.style.top = y + 'px';
  body.appendChild(rip);
  setTimeout(() => rip.remove(), 600);
}

/* Event Listeners */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) {
    const target = g.dataset.go === 'top' ? 0 : $(g.dataset.go)?.offsetTop - 120;
    window.scrollTo({ top: target, behavior: 'smooth' });
  }

  if (ignored(e) || !S.on) return;

  const el = e.target;
  const c = {
    n: S.clicks.length + 1,
    pageX: e.pageX,
    pageY: e.pageY,
    clientX: e.clientX,
    clientY: e.clientY,
    label: label(el),
    time: iso()
  };

  S.clicks.push(c);
  sounds.click();
  spawnRipple(e.pageX, e.pageY);

  rec('click', {
    pageX: c.pageX,
    pageY: c.pageY,
    clientX: c.clientX,
    clientY: c.clientY,
    label: c.label,
    clickNumber: c.n,
    viewport: innerWidth + 'x' + innerHeight
  });

  // Rage Click Detector
  const now = Date.now();
  S.recent = S.recent.filter(r => now - r.t < 700);
  S.recent.push({ t: now, x: e.pageX, y: e.pageY });

  if (S.recent.length >= 3 && S.recent.every(r => Math.hypot(r.x - e.pageX, r.y - e.pageY) < 30)) {
    S.rage++;
    S.recent = [];
    sounds.rage();
    const sb = $('stressBox');
    if (sb) {
      sb.classList.add('shake');
      setTimeout(() => sb.classList.remove('shake'), 450);
    }
    rec('rage_click', { pageX: c.pageX, pageY: c.pageY, label: c.label });
  }

  draw();
}, true);

document.addEventListener('mousemove', e => {
  if (!S.on || ignored(e)) return;
  const now = performance.now();
  if (now - S.lastMove < 45 || S.moves.length >= MAX_MV) return;
  S.lastMove = now;

  S.moves.push({ pageX: e.pageX, pageY: e.pageY, clientX: e.clientX, clientY: e.clientY, time: iso() });
  const logAll = $('logAll');
  if (logAll && logAll.checked) {
    rec('mousemove', { pageX: e.pageX, pageY: e.pageY });
  } else {
    updateStats();
  }

  if (S.mode === 'moves' || S.mode === 'path') draw();
});

addEventListener('scroll', () => {
  if (!S.on) return;
  const y = scrollY, h = de.scrollHeight;
  const d = Math.min(100, Math.round((y + innerHeight) / h * 100));
  S.depth = Math.max(S.depth, d);

  [25, 50, 75, 100].forEach(k => {
    if (d >= k && !S.marks[k]) {
      S.marks[k] = 1;
      rec('scroll_depth', { percent: k });
    }
  });

  const now = performance.now();
  if (now - S.lastScroll >= 160) {
    S.lastScroll = now;
    S.scrolls.push({ scrollY: y, depth: d, time: iso() });
    rec('scroll', { scrollY: y, depth: d });
  } else {
    updateStats();
  }
}, { passive: true });

document.addEventListener('visibilitychange', () => rec('page_visibility', { state: document.visibilityState }));

/* Section Dwell Intersection Observer */
const dwellMs = n => (S.dwell[n] || 0) + (S.since[n] ? Date.now() - S.since[n] : 0);

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const n = entry.target.dataset.track;
      const isVis = entry.isIntersecting;
      if (isVis === !!S.inView[n]) return;
      S.inView[n] = isVis;

      if (S.on) {
        if (isVis) {
          S.since[n] = Date.now();
        } else if (S.since[n]) {
          S.dwell[n] = (S.dwell[n] || 0) + Date.now() - S.since[n];
          S.since[n] = 0;
        }
      }
      rec('section_visibility', { section: n, visible: isVis, ratio: +entry.intersectionRatio.toFixed(2) });
    });
  }, { threshold: [0, 0.5] });

  document.querySelectorAll('[data-track]').forEach(el => {
    S.dwell[el.dataset.track] = 0;
    io.observe(el);
  });
}

/* Control Actions */
function togglePause() {
  if (S.on) {
    rec('tracking_paused');
    S.on = false;
    S.pauseAt = Date.now();
    Object.keys(S.since).forEach(n => {
      if (S.since[n]) {
        S.dwell[n] += Date.now() - S.since[n];
        S.since[n] = 0;
      }
    });
  } else {
    S.pausedMs += Date.now() - S.pauseAt;
    S.on = true;
    Object.keys(S.inView).forEach(n => {
      if (S.inView[n]) S.since[n] = Date.now();
    });
    rec('tracking_resumed');
  }
  if ($('bPause')) $('bPause').textContent = S.on ? '⏸ Pause' : '▶ Resume';
  if ($('stateTxt')) $('stateTxt').textContent = S.on ? 'LIVE RECORDING' : 'RECORDER PAUSED';
  if ($('statePill')) $('statePill').classList.toggle('paused', !S.on);
  updateStats();
}

function undoClick() {
  if (!S.clicks.length) return;
  sounds.undo();
  const r = S.clicks.pop();
  S.ev = S.ev.filter(e => !(e.type === 'click' && e.clickNumber === r.n));
  draw();
  updateStats();
}

let resetArmed = 0;
function resetSession() {
  const btn = $('bReset');
  if (!resetArmed) {
    resetArmed = setTimeout(() => {
      resetArmed = 0;
      if (btn) btn.textContent = 'Reset';
    }, 3200);
    if (btn) btn.textContent = 'Confirm Reset?';
    return;
  }
  clearTimeout(resetArmed);
  resetArmed = 0;
  if (btn) btn.textContent = 'Reset';

  Object.assign(S, {
    t0: Date.now(),
    pausedMs: 0,
    pauseAt: 0,
    id: 'nt_' + Math.random().toString(36).slice(2, 9),
    ev: [],
    clicks: [],
    moves: [],
    scrolls: [],
    rage: 0,
    depth: 0,
    marks: {},
    recent: []
  });

  Object.keys(S.dwell).forEach(n => {
    S.dwell[n] = 0;
    S.since[n] = S.on && S.inView[n] ? Date.now() : 0;
  });

  if ($('log')) $('log').replaceChildren();
  if ($('json')) $('json').value = '';
  if ($('chipRage')) $('chipRage').classList.remove('rage');
  draw();
  updateStats();
}

/* Data & Export Helpers */
const getDataPayload = () => ({
  session: S.id,
  exportedAt: iso(),
  active: S.on,
  summary: {
    events: S.ev.length,
    clicks: S.clicks.length,
    rageClicks: S.rage,
    cursorPoints: S.moves.length,
    scrollEvents: S.scrolls.length,
    maxDepthPercent: S.depth,
    activeSeconds: elapsed(),
    secondsInView: Object.fromEntries(Object.keys(S.dwell).map(n => [n, +(dwellMs(n) / 1000).toFixed(1)]))
  },
  events: S.ev,
  clicks: S.clicks,
  mouse: S.moves,
  scrolls: S.scrolls
});

function downloadFile(name, type, content) {
  const blob = new Blob([content], { type });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

function renderJsonOutput() {
  const json = JSON.stringify(getDataPayload(), null, 2);
  if ($('json')) $('json').value = json;
}

function exportJson() {
  renderJsonOutput();
  downloadFile(`neurotrack-${S.id}.json`, 'application/json', JSON.stringify(getDataPayload(), null, 2));
}

function exportCsv() {
  const cols = ['timestamp', 'ms', 'type', 'label', 'pageX', 'pageY', 'detail'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = S.ev.map(e => cols.map(c => c === 'detail' ? q(e.section || e.state || (e.percent != null ? e.percent + '%' : '')) : q(e[c])).join(','));
  downloadFile(`neurotrack-${S.id}.csv`, 'text/csv', [cols.join(',')].concat(rows).join('\n'));
}

/* Executive Summary Dialog */
function openSummary() {
  const t = elapsed();
  const tally = {};
  S.clicks.forEach(c => tally[c.label] = (tally[c.label] || 0) + 1);

  if ($('dlgSessionId')) $('dlgSessionId').textContent = 'ID: ' + S.id;
  if ($('sCl')) $('sCl').textContent = S.clicks.length;
  if ($('sRg')) $('sRg').textContent = S.rage;
  if ($('sRate')) $('sRate').textContent = t ? (S.clicks.length / (t / 60)).toFixed(1) : '0';
  if ($('sMv')) $('sMv').textContent = S.moves.length;
  if ($('sDp')) $('sDp').textContent = S.depth + '%';
  if ($('sTm')) $('sTm').textContent = fmt(t);

  // Top Clicks Table
  const sortedClicks = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxClick = sortedClicks.length ? sortedClicks[0][1] : 1;
  const tc = $('tClicks');
  if (tc) {
    tc.replaceChildren();
    if (!sortedClicks.length) {
      tc.innerHTML = '<tr><td colspan="3" style="color:var(--ink-dim); text-align:center">No click interactions captured yet</td></tr>';
    } else {
      sortedClicks.forEach(([elem, count]) => {
        const pct = Math.round((count / maxClick) * 100);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${elem}</td>
          <td class="n">${count}</td>
          <td class="n"><div class="bar-cell"><div class="pct-bar" style="width:${pct}%"></div><span>${pct}%</span></div></td>
        `;
        tc.appendChild(tr);
      });
    }
  }

  // Dwell Table
  const td = $('tDwell');
  if (td) {
    td.replaceChildren();
    const dwellList = Object.keys(S.dwell).map(n => [n, +(dwellMs(n) / 1000).toFixed(1)]).sort((a, b) => b[1] - a[1]);
    const totalDwell = dwellList.reduce((acc, cur) => acc + cur[1], 0) || 1;

    dwellList.forEach(([sec, secTime]) => {
      const pct = Math.min(100, Math.round((secTime / totalDwell) * 100));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${sec}</strong></td>
        <td class="n">${secTime}s</td>
        <td class="n"><div class="bar-cell"><div class="pct-bar" style="width:${pct}%; background:linear-gradient(90deg,var(--emerald),var(--cyan))"></div><span>${pct}%</span></div></td>
      `;
      td.appendChild(tr);
    });
  }

  renderJsonOutput();
  if ($('dlg')) $('dlg').showModal();
}

/* Built-In Session Replay Player */
let replayTimer = null, replayIdx = 0, replaySpeed = 1, isReplaying = false;
const replayEvents = [];

function startReplay() {
  if (S.ev.length < 5) {
    alert('Not enough session activity to replay yet. Click, move, and scroll around first!');
    return;
  }
  
  // Pause live tracking during replay
  if (S.on) togglePause();
  
  // Gather chronological movement, click, and scroll events
  replayEvents.length = 0;
  S.ev.forEach(e => {
    if (e.type === 'click' || e.type === 'mousemove' || e.type === 'scroll') {
      replayEvents.push(e);
    }
  });

  if (!replayEvents.length) return;

  const deck = $('replayDeck');
  if (deck) deck.classList.add('show');
  const vCursor = $('virtualCursor');
  if (vCursor) vCursor.style.display = 'block';
  replayIdx = 0;
  isReplaying = true;
  if ($('rpPlay')) $('rpPlay').textContent = '⏸ Pause';
  runReplayStep();
}

function runReplayStep() {
  if (!isReplaying || replayIdx >= replayEvents.length) {
    if (replayIdx >= replayEvents.length) {
      isReplaying = false;
      if ($('rpPlay')) $('rpPlay').textContent = '↺ Replay';
    }
    return;
  }

  const ev = replayEvents[replayIdx];
  const progress = Math.round((replayIdx / (replayEvents.length - 1)) * 100);
  if ($('rpProgress')) $('rpProgress').value = progress;
  if ($('rpTime')) $('rpTime').textContent = fmt(Math.floor(ev.ms / 1000));

  const vCursor = $('virtualCursor');
  if (vCursor && ev.pageX != null) {
    vCursor.style.transform = `translate(${ev.pageX}px, ${ev.pageY}px)`;
  }

  if (ev.type === 'click') {
    spawnRipple(ev.pageX, ev.pageY);
    sounds.click();
  } else if (ev.type === 'scroll') {
    window.scrollTo({ top: ev.scrollY, behavior: 'auto' });
  }

  const nextEv = replayEvents[replayIdx + 1];
  let delay = nextEv ? Math.min(250, Math.max(10, (nextEv.ms - ev.ms) / replaySpeed)) : 100;
  replayIdx++;
  replayTimer = setTimeout(runReplayStep, delay);
}

function stopReplay() {
  clearTimeout(replayTimer);
  isReplaying = false;
  const deck = $('replayDeck');
  if (deck) deck.classList.remove('show');
  const vCursor = $('virtualCursor');
  if (vCursor) vCursor.style.display = 'none';
  if (!S.on) togglePause();
}

/* Attach UI Event Handlers */
if ($('modes')) {
  $('modes').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setMode(b.dataset.mode);
  });
}

if ($('bPause')) $('bPause').onclick = togglePause;
if ($('bUndo')) $('bUndo').onclick = undoClick;
if ($('bReset')) $('bReset').onclick = resetSession;
if ($('bData')) $('bData').onclick = exportJson;
if ($('bCsv')) $('bCsv').onclick = exportCsv;
if ($('bSum')) $('bSum').onclick = openSummary;
if ($('bReplay')) $('bReplay').onclick = startReplay;

if ($('dJson')) $('dJson').onclick = exportJson;
if ($('dCsv')) $('dCsv').onclick = exportCsv;
if ($('dClose')) $('dClose').onclick = () => $('dlg').close();

// Audio toggle
if ($('bSound')) {
  $('bSound').onclick = () => {
    soundEnabled = !soundEnabled;
    $('bSound').textContent = soundEnabled ? '🔊' : '🔇';
  };
}

// Theme toggle
if ($('bTheme')) {
  $('bTheme').onclick = () => {
    const cur = de.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    de.setAttribute('data-theme', next);
    draw();
  };
}

// Copy JSON
if ($('bCopyJson')) {
  $('bCopyJson').onclick = () => {
    renderJsonOutput();
    if ($('json')) {
      navigator.clipboard.writeText($('json').value);
      $('bCopyJson').textContent = 'Copied!';
      setTimeout(() => $('bCopyJson').textContent = 'Copy JSON', 1800);
    }
  };
}

// Replay controls
if ($('rpPlay')) {
  $('rpPlay').onclick = () => {
    if (isReplaying) {
      isReplaying = false;
      clearTimeout(replayTimer);
      $('rpPlay').textContent = '▶ Play';
    } else {
      if (replayIdx >= replayEvents.length) replayIdx = 0;
      isReplaying = true;
      $('rpPlay').textContent = '⏸ Pause';
      runReplayStep();
    }
  };
}

if ($('rpSpeed')) {
  $('rpSpeed').onclick = () => {
    replaySpeed = replaySpeed === 1 ? 2 : replaySpeed === 2 ? 4 : 1;
    $('rpSpeed').textContent = replaySpeed + 'x';
  };
}

if ($('rpExit')) $('rpExit').onclick = stopReplay;

if ($('rpProgress')) {
  $('rpProgress').oninput = e => {
    replayIdx = Math.floor((e.target.value / 100) * (replayEvents.length - 1));
  };
}

// Interactive sandbox controls
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

if ($('rateSlider') && $('sliderVal')) {
  $('rateSlider').oninput = e => {
    $('sliderVal').textContent = e.target.value + '%';
  };
}

// Window Lifecycle
addEventListener('resize', size);
addEventListener('load', size);
if ('ResizeObserver' in window) new ResizeObserver(size).observe(body);
setInterval(updateStats, 1000);

// Global API
window.Tracker = {
  pause: togglePause,
  undo: undoClick,
  summary: openSummary,
  data: getDataPayload,
  exportJson,
  exportCsv,
  setMode,
  reset: resetSession,
  replay: startReplay
};

size();
updateStats();
rec('tracker_initialized', { page: document.title, resolution: screen.width + 'x' + screen.height });

})();

/* =====================================================================
   Usability Intelligence Add-on (PulseLens Engine)
   Self-contained; observes DOM & NeuroTrack state without interference
   ===================================================================== */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const ignored = e => !!e.target.closest('[data-ignore]');
 const paused = () => $('statePill') && $('statePill').classList.contains('paused');
 const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[data-go]';
 const BUCKETS = 20, IDLE_MS = 5000;
 const fresh = () => ({
   id:'ux_'+Math.random().toString(36).slice(2,9),
   start:Date.now(),
   active:0,
   dead:0,
   deadBy:{},
   dist:0,
   turns:0,
   pt:null,
   ang:null,
   kb:0,
   mouse:0,
   lastAct:Date.now(),
   idle:false,
   idleMs:0,
   speed:new Array(40).fill(0),
   cps:new Array(40).fill(0),
   stepDist:0,
   stepClicks:0,
   scroll:new Array(BUCKETS).fill(0),
   tags:[],
   tick:0
 });
 
 let U = fresh();
 const rage = () => parseInt(($('mRg')||{}).textContent,10) || 0;
 const depth = () => parseInt(($('mDp')||{}).textContent,10) || 0;
 const fmt = s => s < 60 ? s+'s' : Math.floor(s/60)+'m '+(s%60)+'s';
 const act = () => { U.lastAct = Date.now(); U.idle = false; };
 
 function lab(el){
   let s=el.tagName.toLowerCase();
   if(el.id) s+='#'+el.id;
   else if(typeof el.className==='string'&&el.className.trim()) s+='.'+el.className.trim().split(/\s+/)[0];
   const t=(el.innerText||el.value||el.placeholder||'').trim().replace(/\s+/g,' ');
   return t? s+' "'+(t.length>24?t.slice(0,24)+'…':t)+'"' : s;
 }

 function score(){
   const p = rage()*9 + U.dead*4 + Math.min(30,U.turns*.35) + (U.idle?8:0);
   return Math.max(0, Math.round(100-p));
 }
 
 function level(s){
   return s>=85?['Excellent','']: s>=65?['Good','']: s>=40?['Needs attention','warn']:['High friction','bad'];
 }

 function findings(){
  const f=[], r=rage();
  if(r) f.push(['bad', r+' rage-click burst'+(r>1?'s':'')+': repeated rapid clicks point to an unresponsive or unclear control.']);
  if(U.dead){
    const top=Object.entries(U.deadBy).sort((a,b)=>b[1]-a[1])[0];
    f.push(['warn', U.dead+' dead click'+(U.dead>1?'s':'')+' on non-interactive elements, most on '+top[0]+'. Users may expect it to respond.']);
  }
  if(U.turns>=40) f.push(['warn', 'Erratic cursor movement ('+U.turns+' direction changes) can indicate searching or hesitation.']);
  if(U.idle) f.push(['warn', 'User is idle ('+fmt(Math.round(U.idleMs/1000))+' total idle).']);
  if(U.active>=30 && depth()<25) f.push(['warn', 'Only '+depth()+'% of the page reached after '+fmt(U.active)+': content below the fold may be missed.']);
  if(!f.length) f.push(['ok', 'No friction signals detected so far. Keep interacting to build the picture.']);
  return f;
 }

 function spark(cv, data, color){
   if (!cv) return;
   const c=cv.getContext('2d'), w=cv.width, h=cv.height, m=Math.max(1,...data);
   c.clearRect(0,0,w,h);
   c.beginPath();
   data.forEach((v,i)=>{
     const x=i/(data.length-1)*w, y=h-4-(v/m)*(h-8);
     i?c.lineTo(x,y):c.moveTo(x,y);
   });
   c.strokeStyle=color;
   c.lineWidth=2;
   c.stroke();
   c.lineTo(w,h);
   c.lineTo(0,h);
   c.closePath();
   c.globalAlpha=.15;
   c.fillStyle=color;
   c.fill();
   c.globalAlpha=1;
 }

 const rows=[];
 (() => {
   const map=$('uxMap');
   if (!map) return;
   for(let i=0;i<BUCKETS;i++){
     const b=document.createElement('i');
     map.appendChild(b);
     rows.push(b);
   }
 })();

 let chip=null;
 (() => {
   const mEv = $('mEv');
   const dl = mEv && mEv.closest('dl');
   if(!dl) return;
   chip=document.createElement('div');
   chip.className='metric-chip';
   chip.innerHTML='<dt>UX Score</dt><dd id="uxChip">100</dd>';
   dl.appendChild(chip);
 })();

 function render(){
  if (!$('uxScore') || !$('uxArc') || !$('uxVerdict')) return;
  const s=score(), [v,cls]=level(s), arc=$('uxArc'), ver=$('uxVerdict');
  $('uxScore').textContent=s;
  arc.style.strokeDashoffset=(339.3*(1-s/100)).toFixed(1);
  arc.setAttribute('class','g-arc '+cls);
  ver.textContent=v;
  ver.className='ux-verdict '+cls;
  if ($('uxDead')) $('uxDead').textContent=U.dead;
  if ($('uxDist')) $('uxDist').textContent=Math.round(U.dist).toLocaleString()+' px';
  if ($('uxTurns')) $('uxTurns').textContent=U.turns;
  if ($('uxState')) $('uxState').textContent=paused()?'Paused':(U.idle?'Idle':'Active');
  if ($('uxIdle')) $('uxIdle').textContent=fmt(Math.round(U.idleMs/1000));
  
  const tot=U.kb+U.mouse;
  if ($('uxKb')) $('uxKb').textContent=(tot?Math.round(U.kb/tot*100):0)+'%';
  if(chip && $('uxChip')) $('uxChip').textContent=s;
  
  const uxEl = $('ux');
  if (uxEl) {
    const cs=getComputedStyle(uxEl);
    spark($('uxSpeed'),U.speed,cs.getPropertyValue('--cyan').trim()||'#06b6d4');
    spark($('uxCps'),U.cps,cs.getPropertyValue('--primary').trim()||'#6366f1');
  }
  
  const mx=Math.max(1,...U.scroll);
  rows.forEach((b,i)=>b.style.width=(U.scroll[i]/mx*100)+'%');
  
  const ul=$('uxFindings');
  if (ul) {
    ul.textContent='';
    findings().forEach(([c,t])=>{
      const li=document.createElement('li');
      li.className=c;
      li.textContent=t;
      ul.appendChild(li);
    });
  }
 }

 document.addEventListener('click', e => {
   const b=e.target.closest('#bReset');
   if(b && /confirm/i.test(b.textContent)){
     U=fresh();
     if ($('uxTags')) $('uxTags').textContent='';
     render();
   }
 }, true);

 document.addEventListener('click', e => {
   if(ignored(e)||paused()) return;
   act();
   U.mouse++;
   U.stepClicks++;
   if(!e.target.closest(INTERACTIVE)){
     U.dead++;
     const k=lab(e.target);
     U.deadBy[k]=(U.deadBy[k]||0)+1;
   }
   render();
 }, true);

 document.addEventListener('mousemove', e => {
   if(ignored(e)||paused()) return;
   act();
   const p={x:e.pageX,y:e.pageY};
   if(U.pt){
     const d=Math.hypot(p.x-U.pt.x,p.y-U.pt.y);
     U.dist+=d;
     U.stepDist+=d;
     if(d>=12){
       const a=Math.atan2(p.y-U.pt.y,p.x-U.pt.x);
       if(U.ang!==null){
         let df=Math.abs(a-U.ang);
         if(df>Math.PI) df=2*Math.PI-df;
         if(df>1.75) U.turns++;
       }
       U.ang=a;
       U.pt=p;
     }
   } else {
     U.pt=p;
   }
 });

 document.addEventListener('keydown', e => {
   if(ignored(e)||paused()) return;
   act();
   U.kb++;
 });

 addEventListener('scroll', () => {
   if(!paused()) act();
 }, {passive:true});

 setInterval(() => {
  if(paused()){ render(); return; }
  U.active += .25;
  U.speed.push(U.stepDist*4);
  U.speed.shift();
  U.stepDist=0;
  U.tick++;
  if(U.tick%4===0){
    U.cps.push(U.stepClicks);
    U.cps.shift();
    U.stepClicks=0;
  }
  if(U.tick%2===0){
    const d=document.documentElement, i=Math.min(BUCKETS-1, Math.floor(((scrollY+innerHeight/2)/Math.max(1,d.scrollHeight))*BUCKETS));
    U.scroll[Math.max(0,i)]++;
  }
  if(Date.now()-U.lastAct>IDLE_MS){
    if(!U.idle) U.idle=true;
    U.idleMs+=250;
  }
  render();
 }, 250);

 function addTag(){
   const inp=$('uxTagIn');
   if (!inp) return;
   const v=inp.value.trim();
   if(!v) return;
   U.tags.push({label:v, atSeconds:Math.round(U.active), scrollY:Math.round(scrollY), time:new Date().toISOString()});
   inp.value='';
   const li=document.createElement('li'), s=document.createElement('small');
   s.textContent=fmt(Math.round(U.active));
   li.append(s, document.createTextNode(v));
   if ($('uxTags')) $('uxTags').prepend(li);
 }

 if ($('uxTagBtn')) $('uxTagBtn').onclick=addTag;
 if ($('uxTagIn')) {
   $('uxTagIn').addEventListener('keydown',e=>{
     if(e.key==='Enter'){
       e.preventDefault();
       addTag();
     }
   });
 }

 function report(){
   const s=score();
   return {
     report:'NeuroTrack usability report',
     generatedAt:new Date().toISOString(),
     sessionId:U.id,
     usabilityScore:s,
     verdict:level(s)[0],
     metrics:{
       activeSeconds:Math.round(U.active),
       rageClicks:rage(),
       deadClicks:U.dead,
       cursorTravelPx:Math.round(U.dist),
       directionChanges:U.turns,
       idleSeconds:Math.round(U.idleMs/1000),
       keyboardEvents:U.kb,
       mouseClicks:U.mouse,
       maxScrollDepthPct:depth()
     },
     findings:findings().map(x=>x[1]),
     deadClickTargets:U.deadBy,
     scrollAttentionSeconds:U.scroll.map(v=>+(v*.5).toFixed(1)),
     tags:U.tags,
     neurotrack: (window.Tracker && window.Tracker.data) ? window.Tracker.data() : null
   };
 }

 if ($('uxExport')) {
   $('uxExport').onclick=()=>{
     const u=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));
     const a=document.createElement('a');
     a.href=u;
     a.download='neurotrack-usability-report-'+U.id+'.json';
     document.body.appendChild(a);
     a.click();
     a.remove();
     setTimeout(()=>URL.revokeObjectURL(u),1000);
   };
 }

 if ($('uxCopy')) {
   $('uxCopy').onclick=async()=>{
     const b=$('uxCopy');
     const t=b.textContent;
     try{
       await navigator.clipboard.writeText(JSON.stringify(report(),null,2));
       b.textContent='Copied ✓';
     }catch(e){
       b.textContent='Copy blocked';
     }
     setTimeout(()=>b.textContent=t,1500);
   };
 }

 render();
})();
