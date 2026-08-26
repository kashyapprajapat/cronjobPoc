# CronManager POC

A real-time cron job management dashboard built with **Node.js**, **Express**, and **node-cron**.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.x-blue) ![node-cron](https://img.shields.io/badge/node--cron-3.x-orange)

## Features

- **10 Real Cron Jobs** — 8 enabled by default, 2 disabled
- **Live Execution Feed** — real-time terminal-style log via Server-Sent Events (SSE)
- **Enable/Disable Toggle** — confirmation modal with instant UI update
- **node-cron Scheduling** — actual cron expressions running on the server
- **Dark Mode Dashboard** — premium glassmorphism UI with animations

## Quick Start

```bash
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

## Architecture

```
server.js          → Express + node-cron (10 scheduled jobs)
  ├── GET /        → Serves the dashboard (public/index.html)
  ├── GET /events  → SSE stream (real-time execution push)
  ├── GET /api/jobs    → List all jobs with state
  ├── GET /api/stats   → Execution stats
  ├── GET /api/history → Last 50 executions
  └── POST /api/jobs/:id/toggle → Enable/disable a job

public/
  ├── index.html   → Dashboard HTML
  ├── style.css    → Dark-mode CSS
  └── app.js       → Frontend (SSE client, toggle UI, live feed)
```

## How It Works

1. **Server starts** → 8 cron jobs begin firing at 8–22 second intervals (demo mode)
2. **Each execution** → picks random dummy log messages and broadcasts via SSE
3. **Browser connects** → receives live execution events, renders in terminal feed
4. **Toggle a job** → confirmation modal → POST to server → node-cron starts/stops → SSE broadcasts state change

## Demo Mode

Jobs fire every 6–22 seconds for demo purposes. In production, you'd set real cron expressions like `0 8 * * *` (daily at 8 AM).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js + Express |
| Scheduler | node-cron |
| Real-time | Server-Sent Events (SSE) |
| Frontend | Vanilla HTML/CSS/JS |
| Fonts | Inter + JetBrains Mono |
