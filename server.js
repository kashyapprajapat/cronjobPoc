/**
 * ============================================================
 *  CronManager POC – server.js
 *  Node.js + Express + node-cron
 *
 *  - Serves the HTML dashboard at GET /
 *  - Runs 10 real cron jobs (8 enabled, 2 disabled by default)
 *  - Pushes live execution logs to browser via SSE
 *  - REST API to toggle (enable/disable) any job
 * ============================================================
 */

const express  = require('express');
const cron     = require('node-cron');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Disable browser caching in dev/demo mode
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
//  Job Definitions
//  cronExpr uses 6-field node-cron syntax:
//  "second minute hour day month weekday"
//  e.g.  "*/12 * * * * *"  = every 12 seconds (demo mode)
// ─────────────────────────────────────────────
const JOB_DEFS = [
  {
    id: 1,
    name: 'daily-report-generator',
    category: 'Reporting',
    icon: '📊',
    desc: 'Generates and emails daily business summary reports.',
    cronExpr: '*/12 * * * * *',   // every 12 sec – demo
    cronLabel: 'Every 12 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Fetching metrics from analytics DB... Done ✓',
      'Rendering PDF report (42 pages)... Done ✓',
      'Emailing report to 12 stakeholders via SendGrid... Done ✓',
      'Revenue today: ₹48,320 | Orders: 1,204 | New users: 231',
      'Report archived to S3://prod-reports/... Done ✓',
      'Job completed successfully in 2.4s. Exit code: 0',
    ],
  },
  {
    id: 2,
    name: 'db-backup-weekly',
    category: 'Maintenance',
    icon: '🗄️',
    desc: 'Full database snapshots uploaded to cloud storage.',
    cronExpr: '*/15 * * * * *',
    cronLabel: 'Every 15 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Starting full DB dump — 312 tables, 9.2M rows...',
      'Compressing backup: 4.2GB → 680MB (gzip level 9) ✓',
      'Uploading to s3://prod-backups/2024/08/... ✓',
      'Checksum verified: SHA256 match confirmed ✓',
      'Removed 2 old backups (retention: 30 days) ✓',
      'Backup complete. Duration: 18.3s. Exit code: 0',
    ],
  },
  {
    id: 3,
    name: 'user-cleanup-task',
    category: 'Data Management',
    icon: '🧹',
    desc: 'Removes inactive accounts and expired session tokens.',
    cronExpr: '*/18 * * * * *',
    cronLabel: 'Every 18 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Scanning for accounts inactive > 90 days... Found 47',
      'Archiving 47 accounts to cold storage ✓',
      'Purging 12,453 expired session tokens ✓',
      'Freed 2.1 GB of orphaned file references ✓',
      'GDPR deletion queue: 3 requests processed ✓',
      'Cleanup done. Rows removed: 12,503. Exit code: 0',
    ],
  },
  {
    id: 4,
    name: 'invoice-processor',
    category: 'Finance',
    icon: '💳',
    desc: 'Processes pending invoices via payment gateway.',
    cronExpr: '*/10 * * * * *',
    cronLabel: 'Every 10 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Fetching pending invoices from queue... Found 23',
      'Processing #INV-2024-0892 → Stripe charge ₹1,240 ✓',
      'Processing #INV-2024-0893 → Stripe charge ₹560 ✓',
      'Sending 23 receipt emails... Done ✓',
      'Failed: 1 (card declined – will retry next cycle)',
      'Invoices done. Revenue collected: ₹48,320. Exit code: 0',
    ],
  },
  {
    id: 5,
    name: 'email-digest-sender',
    category: 'Notifications',
    icon: '📧',
    desc: 'Sends personalized email digests to subscribers.',
    cronExpr: '*/20 * * * * *',
    cronLabel: 'Every 20 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Loading subscriber list... 8,423 active users ✓',
      'Personalising content per user segment... Done ✓',
      'Queuing 8,423 emails via SendGrid API... ✓',
      'Delivery confirmed: 98.7% open rate predicted',
      'Unsubscribe requests processed: 3 removed ✓',
      'Digest sent. 8,420 emails dispatched. Exit code: 0',
    ],
  },
  {
    id: 6,
    name: 'cache-invalidator',
    category: 'Performance',
    icon: '⚡',
    desc: 'Clears stale Redis cache and CDN edge nodes.',
    cronExpr: '*/8 * * * * *',
    cronLabel: 'Every 8 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Connecting to Redis cluster (6 nodes)... OK ✓',
      'Evicted 4,812 stale keys (TTL expired) ✓',
      'Purging CloudFront edge: us-east-1... ✓',
      'Purging CloudFront edge: ap-south-1... ✓',
      'CDN hit rate restored to 94.2% ✓',
      'Cache flush complete. Duration: 1.1s. Exit code: 0',
    ],
  },
  {
    id: 7,
    name: 'analytics-aggregator',
    category: 'Analytics',
    icon: '📈',
    desc: 'Aggregates raw Kafka events into dashboard metrics.',
    cronExpr: '*/14 * * * * *',
    cronLabel: 'Every 14 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Ingesting Kafka stream... 2.1M events buffered ✓',
      'Aggregating: sessions, users, pages... Done (1.8s) ✓',
      'Writing hourly rollups to ClickHouse... ✓',
      'DAU=23,891 | Sessions=41,203 | Bounce=38.2% ✓',
      'Funnel conversion: 3.2% (+0.4% WoW) ✓',
      '2.1M events aggregated. Exit code: 0',
    ],
  },
  {
    id: 8,
    name: 'log-archiver',
    category: 'Maintenance',
    icon: '📦',
    desc: 'Compresses and archives application logs > 7 days.',
    cronExpr: '*/22 * * * * *',
    cronLabel: 'Every 22 seconds (demo)',
    enabledByDefault: true,
    messages: [
      'Scanning /var/log/app for files > 7 days... 142 files',
      'Compressing 142 log files: 18.4GB → 2.1GB (gzip) ✓',
      'Uploading to s3://logs-archive/2024/08/... ✓',
      'Deleting originals from disk. Freed 18.4GB ✓',
      'Retention policy enforced (90-day archive) ✓',
      'Archival done. 142 files, 18.4GB freed. Exit code: 0',
    ],
  },
  {
    id: 9,
    name: 'ml-model-retrainer',
    category: 'Machine Learning',
    icon: '🤖',
    desc: 'Re-trains recommendation model. Disabled by default.',
    cronExpr: '*/6 * * * * *',   // fires every 6 sec when enabled
    cronLabel: 'Every 6 seconds (demo)',
    enabledByDefault: false,
    messages: [
      'Loading training dataset: 4.2M interactions... ✓',
      'Preprocessing features (normalize, encode)... ✓',
      'Training XGBoost (100 estimators)... Epoch 100/100 ✓',
      'Model accuracy: 92.4% (prev 91.8%) — +0.6% gain ✓',
      'Deploying new model to prediction service... ✓',
      'Retraining complete. Accuracy +0.6%. Exit code: 0',
    ],
  },
  {
    id: 10,
    name: 'sms-alert-dispatcher',
    category: 'Notifications',
    icon: '📱',
    desc: 'SMS threshold alerts to on-call team. Disabled by default.',
    cronExpr: '*/7 * * * * *',
    cronLabel: 'Every 7 seconds (demo)',
    enabledByDefault: false,
    messages: [
      'Checking thresholds — CPU: 45%, RAM: 62%, Disk: 71%',
      'ALERT: API latency > 500ms → notifying on-call team ✓',
      'SMS sent via Twilio to 3 engineers... Delivered ✓',
      'PagerDuty incident created: INC-2024-0034 ✓',
      'Alert cooldown set (15 min) to prevent spam ✓',
      'Dispatch complete. Recipients: 3. Exit code: 0',
    ],
  },
];

// ─────────────────────────────────────────────
//  Runtime State
// ─────────────────────────────────────────────
let totalExecutions = 0;
const execHistory   = [];   // last 100 executions
const sseClients    = new Set();

// Job state map: id → { enabled, runCount, lastRun, task (node-cron task) }
const jobState = {};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(msg); } catch { sseClients.delete(client); }
  });
}

function pickRandom(arr, n = 3) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return [...new Set(shuffled.slice(0, n))];
}

function fireJob(job) {
  const state = jobState[job.id];
  if (!state.enabled) return;   // safety guard

  totalExecutions++;
  state.runCount++;
  state.lastRun = new Date().toISOString();

  const exec = {
    id:        totalExecutions,
    jobId:     job.id,
    jobName:   job.name,
    icon:      job.icon,
    category:  job.category,
    timestamp: state.lastRun,
    status:    'success',
    lines:     pickRandom(job.messages, 3),
    duration:  (Math.random() * 2.5 + 0.4).toFixed(2) + 's',
  };

  execHistory.unshift(exec);
  if (execHistory.length > 100) execHistory.pop();

  broadcast('execution', exec);
  broadcast('stats', getStats());

  console.log(`[CRON] ✓ ${job.name} fired (run #${state.runCount})`);
}

function getStats() {
  const enabled  = Object.values(jobState).filter(s => s.enabled).length;
  const disabled = Object.values(jobState).filter(s => !s.enabled).length;
  return { totalExecutions, enabled, disabled, total: JOB_DEFS.length };
}

// ─────────────────────────────────────────────
//  Scheduler — starts/stops node-cron tasks
// ─────────────────────────────────────────────
function startJob(job) {
  const state = jobState[job.id];
  if (state.task) { state.task.stop(); state.task = null; }

  state.task = cron.schedule(job.cronExpr, () => fireJob(job), {
    scheduled: true,
  });
  state.enabled = true;
  console.log(`[CRON] ▶ Started: ${job.name}  (${job.cronExpr})`);
}

function stopJob(job) {
  const state = jobState[job.id];
  if (state.task) { state.task.stop(); state.task = null; }
  state.enabled = false;
  console.log(`[CRON] ⏸ Stopped: ${job.name}`);
}

// Initialise all jobs
JOB_DEFS.forEach(job => {
  jobState[job.id] = { enabled: false, runCount: 0, lastRun: null, task: null };
  if (job.enabledByDefault) startJob(job);
});

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────

// Home → serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Docs → serve the documentation page
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// SSE – real-time event stream
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('event: connected\ndata: {"ok":true}\n\n');

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// GET /api/jobs – list all jobs with current state
app.get('/api/jobs', (req, res) => {
  const jobs = JOB_DEFS.map(j => ({
    id:         j.id,
    name:       j.name,
    category:   j.category,
    icon:       j.icon,
    desc:       j.desc,
    cronExpr:   j.cronExpr,
    cronLabel:  j.cronLabel,
    enabled:    jobState[j.id].enabled,
    runCount:   jobState[j.id].runCount,
    lastRun:    jobState[j.id].lastRun,
  }));
  res.json(jobs);
});

// GET /api/history – last 50 executions
app.get('/api/history', (req, res) => {
  res.json(execHistory.slice(0, 50));
});

// GET /api/stats
app.get('/api/stats', (req, res) => res.json(getStats()));

// POST /api/jobs/:id/toggle – enable or disable a job
app.post('/api/jobs/:id/toggle', (req, res) => {
  const id  = parseInt(req.params.id, 10);
  const job = JOB_DEFS.find(j => j.id === id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const state      = jobState[id];
  const willEnable = !state.enabled;

  if (willEnable) {
    startJob(job);
    broadcast('toggle', { jobId: id, enabled: true,  jobName: job.name });
  } else {
    stopJob(job);
    broadcast('toggle', { jobId: id, enabled: false, jobName: job.name });
  }

  broadcast('stats', getStats());
  res.json({ success: true, jobId: id, enabled: willEnable });
});

// ─────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║      CronManager POC – Server Running     ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║  Dashboard → http://localhost:${PORT}          ║`);
  console.log(`║  Jobs API  → http://localhost:${PORT}/api/jobs ║`);
  console.log(`║  SSE Feed  → http://localhost:${PORT}/events   ║`);
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║  8 jobs ENABLED  |  2 jobs DISABLED       ║');
  console.log('║  Jobs fire every 8–22 seconds (demo mode) ║');
  console.log('╚═══════════════════════════════════════════╝\n');
});
