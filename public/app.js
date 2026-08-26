/**
 * CronManager – Frontend (public/app.js)
 * Connects to Express server via SSE.
 * node-cron fires jobs on the server → SSE pushes → we display here.
 */

// ── State ─────────────────────────────────────
let jobs       = [];
let filter     = 'all';
let pendingId  = null;
let totalRuns  = 0;
let toastTimer = null;
let startedAt  = Date.now();
let sse        = null;

// ── DOM ───────────────────────────────────────
const $ = id => document.getElementById(id);
const cardsEl   = $('cards');
const termBody  = $('term-body');
const termIdle  = $('term-idle');
const overlay   = $('overlay');
const toast     = $('toast');

// ── Clock & Uptime ────────────────────────────
setInterval(() => {
  $('clock').textContent = new Date().toLocaleTimeString('en-IN', {
    hour12: false, timeZone: 'Asia/Kolkata'
  });
  const s  = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  $('st-up').textContent = `${mm}:${ss}`;
}, 1000);

// ── SSE connection ─────────────────────────────
function connectSSE() {
  const badge = $('conn-badge');
  badge.className = 'live-chip connecting';
  badge.textContent = '⬤ CONNECTING';

  if (sse) sse.close();
  sse = new EventSource('/events');

  sse.addEventListener('connected', () => {
    badge.className = 'live-chip live';
    badge.textContent = '⬤ LIVE';
  });

  // Real execution fired by node-cron on the server
  sse.addEventListener('execution', e => {
    const ex = JSON.parse(e.data);
    onExecution(ex);
  });

  // Toggle broadcast (another browser tab toggled a job)
  sse.addEventListener('toggle', e => {
    const d = JSON.parse(e.data);
    // Use Number() to handle both string and numeric jobId from server
    const j = jobs.find(j => j.id === Number(d.jobId));
    if (j) { j.enabled = d.enabled; renderCards(); }
    showToast(
      d.enabled ? 'ok' : 'warn',
      d.enabled ? '▶' : '⏸',
      d.enabled ? 'Job Enabled – Cron Started' : 'Job Disabled – Cron Stopped',
      d.jobName
    );
  });

  // Stats
  sse.addEventListener('stats', e => {
    const s = JSON.parse(e.data);
    $('h-en').textContent  = s.enabled;
    $('h-dis').textContent = s.disabled;
    $('h-exec').textContent = s.totalExecutions;
    $('st-active').textContent = s.enabled;
    totalRuns = s.totalExecutions;
    $('st-total').textContent = totalRuns;
    $('run-badge').textContent = `${totalRuns} runs`;
  });

  sse.onerror = () => {
    badge.className = 'live-chip error';
    badge.textContent = '✕ OFFLINE';
    setTimeout(connectSSE, 3000);
  };
}

// ── Execution handler ─────────────────────────
function onExecution(ex) {
  // Pulse the matching card
  const card = cardsEl.querySelector(`[data-id="${ex.jobId}"]`);
  if (card) {
    card.classList.remove('firing');
    void card.offsetWidth;
    card.classList.add('firing');
    // Update run count tag in-place
    const rt = card.querySelector('.runtag');
    const j  = jobs.find(j => j.id === ex.jobId);
    if (j && rt) { j.runCount = (j.runCount || 0) + 1; rt.textContent = `${j.runCount} runs`; }
  }

  // Remove idle screen on first log
  if (termIdle) termIdle.remove();

  appendLog(ex);
  $('term-ts').textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });

  // Brief execution toast
  showToast('exec', ex.icon || '⚙', ex.jobName, `Completed in ${ex.duration}`);
}

// ── Append log entry to terminal ──────────────
function appendLog(ex) {
  const ts  = new Date(ex.timestamp).toLocaleTimeString('en-IN', {
    hour12: false, timeZone: 'Asia/Kolkata'
  });
  const el  = document.createElement('div');
  el.className = 'log-entry';
  const lines  = (ex.lines || ['Executed']).map((l, i, a) =>
    `<div class="lline ${i === a.length - 1 ? 'last' : ''}">${esc(l)}</div>`
  ).join('');
  el.innerHTML = `
    <div class="lhdr">
      <span class="lico">${ex.icon || '⚙'}</span>
      <span class="ljob">${esc(ex.jobName)}</span>
      <span class="ldur">${ex.duration}</span>
      <span class="lts">${ts}</span>
    </div>
    ${lines}`;
  termBody.appendChild(el);
  termBody.scrollTop = termBody.scrollHeight;
}

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Render job cards ───────────────────────────
function renderCards() {
  const list = filter === 'all' ? jobs
    : jobs.filter(j => filter === 'enabled' ? j.enabled : !j.enabled);

  cardsEl.innerHTML = '';
  list.forEach((j, i) => {
    const el = document.createElement('div');
    el.className = `card ${j.enabled ? '' : 'dim'}`;
    el.dataset.id = j.id;
    el.style.animationDelay = `${i * 0.04}s`;
    el.innerHTML = `
      <div class="ct">
        <div class="cico">${j.icon}</div>
        <div class="cinfo">
          <div class="cname">${j.name}</div>
          <div class="ccat">${j.category}</div>
        </div>
        <div class="cbadge ${j.enabled ? 'on' : 'off'}">
          <div class="bdot"></div>${j.enabled ? 'RUNNING' : 'STOPPED'}
        </div>
      </div>
      <div class="cdesc">${j.desc}</div>
      <div class="cfooter">
        <div class="ctags">
          <div class="ctag">⏱ ${j.cronLabel}</div>
          <div class="ctag runtag">${j.runCount || 0} runs</div>
        </div>
        <div class="tgl-wrap">
          <span class="tgl-lbl ${j.enabled ? 'on' : 'off'}">${j.enabled ? 'ON' : 'OFF'}</span>
          <label class="tgl">
            <input type="checkbox" ${j.enabled ? 'checked' : ''} data-jid="${j.id}"/>
            <div class="ttrack"></div>
            <div class="tthumb"></div>
          </label>
        </div>
      </div>`;

    // Use click on the <label> wrapper — avoids the double-fire bug
    // that happens when listening to 'change' on a checkbox inside a label.
    const lbl = el.querySelector('.tgl');
    lbl.addEventListener('click', e => {
      e.preventDefault();          // stop the checkbox from actually toggling
      e.stopPropagation();
      openModal(j.id);
    });
    cardsEl.appendChild(el);
  });

  $('fc-all').textContent  = jobs.length;
  $('fc-run').textContent  = jobs.filter(j => j.enabled).length;
  $('fc-stop').textContent = jobs.filter(j => !j.enabled).length;
}

// ── Modal ──────────────────────────────────────
function openModal(jid) {
  const j = jobs.find(j => j.id === jid);
  if (!j) return;
  pendingId = jid;
  const en  = !j.enabled;

  $('mglow').className    = `modal-glow ${en ? 'en' : 'dis'}`;
  $('memoji').textContent  = en ? '▶' : '⏸';
  $('mtitle').textContent  = en ? 'Enable Cron Job?' : 'Disable Cron Job?';
  $('mchip').textContent   = j.name;
  $('mcron').textContent   = j.cronExpr;
  $('mclbl').textContent   = `· ${j.cronLabel}`;
  $('mdesc').innerHTML     = en
    ? `This job is currently <strong>stopped</strong>. Enabling it will start the <strong>node-cron</strong> scheduler. It will fire every few seconds in demo mode.`
    : `This job is currently <strong>running</strong>. Disabling it will <strong>stop</strong> the node-cron task immediately on the server.`;
  $('btn-yes').textContent  = en ? '▶  Enable Job' : '⏸  Disable Job';
  $('btn-yes').className    = `btn-yes ${en ? 'en' : 'dis'}`;

  overlay.classList.add('open');
}

function closeModal() {
  overlay.classList.remove('open');
  pendingId = null;
}

// ── Confirm toggle ─────────────────────────────
async function confirmToggle() {
  if (pendingId === null) return;
  const jobId = pendingId;   // ← save BEFORE closeModal() zeros it out
  closeModal();
  console.log(`[Toggle] Sending POST /api/jobs/${jobId}/toggle`);
  try {
    const res  = await fetch(`/api/jobs/${jobId}/toggle`, { method: 'POST' });
    const data = await res.json();
    console.log(`[Toggle] Server response:`, data);
    if (!data.success) throw new Error(data.error || 'Toggle failed');

    // Optimistically update local state immediately
    const job = jobs.find(j => j.id === Number(jobId));
    console.log(`[Toggle] Found job in local state:`, job?.name, '→ enabled:', data.enabled);
    if (job) {
      job.enabled = data.enabled;
      renderCards();
      const en  = jobs.filter(j => j.enabled).length;
      const dis = jobs.filter(j => !j.enabled).length;
      $('h-en').textContent      = en;
      $('h-dis').textContent     = dis;
      $('st-active').textContent = en;
      showToast(
        data.enabled ? 'ok' : 'warn',
        data.enabled ? '▶' : '⏸',
        data.enabled ? 'Job Enabled – Cron Started' : 'Job Disabled',
        job.name
      );
    }
  } catch (err) {
    console.error(`[Toggle] Error:`, err);
    showToast('warn', '✕', 'Toggle failed', err.message);
  }
}

// ── Toast ──────────────────────────────────────
function showToast(type, icon, title, sub) {
  $('ticon').textContent  = icon;
  $('ticon').className    = `toast-ico ${type}`;
  $('ttitle').textContent = title;
  $('tsub').textContent   = sub;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Event listeners ────────────────────────────
$('tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filter = btn.dataset.f;
  renderCards();
});

$('btn-yes').addEventListener('click', confirmToggle);
$('btn-no').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('clr-btn').addEventListener('click', () => {
  termBody.innerHTML = `<div class="term-idle">
    <div style="font-size:1.8rem">🗑</div>
    <div class="tid-title" style="color:var(--mu)">Cleared</div>
    <div class="tid-sub">New executions will appear here…</div>
  </div>`;
});

// ── Init ───────────────────────────────────────
(async function init() {
  connectSSE();
  try {
    const [jobsRes, histRes] = await Promise.all([
      fetch('/api/jobs'),
      fetch('/api/history')
    ]);
    jobs = await jobsRes.json();
    renderCards();

    const hist = await histRes.json();
    if (hist.length) {
      if (termIdle) termIdle.remove();
      hist.reverse().forEach(appendLog);
    }

    const stats = await fetch('/api/stats').then(r => r.json());
    totalRuns = stats.totalExecutions;
    $('h-en').textContent  = stats.enabled;
    $('h-dis').textContent = stats.disabled;
    $('h-exec').textContent = totalRuns;
    $('st-total').textContent = totalRuns;
    $('st-active').textContent = stats.enabled;
    $('run-badge').textContent = `${totalRuns} runs`;
  } catch (err) {
    console.error('Init error:', err);
    showToast('warn', '✕', 'Cannot reach server', 'Make sure node server.js is running');
  }
})();
