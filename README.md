# bodybasetwitter

> TypeScript/Node.js server that automates Twitter content for [@bodybasehealth](https://twitter.com/bodybasehealth). Generates daily tweet drafts via Google Gemini and routes approval through a Telegram bot — no n8n in the loop.

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Deploy](https://img.shields.io/badge/deploy-Coolify-purple)](https://coolify.io)

---

## Table of Contents

- [About](#about)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Daily Cron Flow](#daily-cron-flow)
- [Telegram Commands](#telegram-commands)
- [API Endpoints](#api-endpoints)
- [Logging](#logging)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## About

`bodybasetwitter` replaces the original n8n Twitter workflows for BodyBase. It is a standalone Express server that:

1. Runs a daily cron at **07:00 BRT** (10:00 UTC) to generate 3 tweet drafts via Google Gemini
2. Sends drafts to a Telegram topic for human review
3. Responds to approval commands from Telegram to publish tweets via the Twitter API
4. Stores all drafts and published tweets in Supabase for auditing

The server is operated by the Clawd bot (`@bodybase_robot`) and the founder via Telegram (Clawd HQ, topic 16).

### Built With

- [Node.js](https://nodejs.org) >= 20 / [TypeScript](https://www.typescriptlang.org) 5 (strict)
- [Express](https://expressjs.com) — HTTP server and webhook receiver
- [node-cron](https://github.com/node-cron/node-cron) — scheduled daily job
- [Google Gemini](https://ai.google.dev) — draft generation (`gemini-2.0-flash`) and free chat (`gemini-2.5-flash`)
- [twitter-api-v2](https://github.com/PLhery/node-twitter-api-v2) — tweet posting and media upload
- [Supabase](https://supabase.com) — storage for drafts and posted tweets
- Telegram Bot API (native `fetch`) — approval workflow interface

---

## Architecture

```
                        +-----------------------------+
                        |   node-cron  07:00 BRT      |
                        |   (10:00 UTC every day)     |
                        +-------------+---------------+
                                      |
                              generateDrafts()
                           (gemini-2.0-flash, 3 drafts)
                                      |
                           +----------v----------+
                           |   Supabase           |
                           |   tw_daily_research  |
                           +----------+----------+
                                      |
                           sendDrafts() -> Telegram topic 16
                                      |
                    +-----------------v-------------------+
                    |           Telegram Bot              |
                    |   aprova N / [foto] aprova N        |
                    |   edita N: texto / ignore / gera    |
                    +-----------------+-------------------+
                                      |
                          POST /telegram/webhook
                                      |
                    +-----------------v-------------------+
                    |        commands.ts router           |
                    |  getDraft -> postTweet -> saveTweet |
                    |  -> confirm (Telegram) + tw_posted  |
                    +-------------------------------------+
```

---

## Project Structure

```
bodybasetwitter/
├── src/
│   ├── index.ts          # Express entry point — /health endpoint + cron registration
│   ├── daily.ts          # Cron job: Gemini -> Telegram -> Supabase
│   ├── commands.ts       # POST /telegram/webhook — command routing and execution
│   ├── types.ts          # TypeScript interfaces: Draft, PostedTweet, TelegramUpdate, CommandRoute
│   └── lib/
│       ├── claude.ts     # generateDrafts() + chat() — Google Gemini integration
│       ├── logger.ts     # log(step, data) — structured JSON logging
│       ├── supabase.ts   # getDraft / saveTweet / saveResearch / updateDraft
│       ├── telegram.ts   # sendMessage / sendDrafts / confirm / getFilePath / downloadFile
│       └── twitter.ts    # postTweet() + uploadMedia()
├── schema/
│   └── twitter-tables.sql  # Supabase table definitions
├── workflows/
│   └── archive/            # Original n8n workflows (historical reference)
├── docs/                   # Additional documentation
├── knowledge/              # Content knowledge base
├── CLAWD-DEBUG.md          # Ops manual for Clawd agent
├── CLAUDE.md               # Repo context for Claude Code / Clawd
├── package.json
├── tsconfig.json
└── railway.toml            # Build/deploy config (used by Coolify/Nixpacks)
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- A Supabase project with the Twitter tables created (see [Database Schema](#database-schema))
- A Telegram bot token from [@BotFather](https://t.me/BotFather) and a group/topic chat ID
- A Twitter Developer app with **Read and Write** permissions and OAuth 1.0a keys
- A Google AI Studio API key with access to Gemini models

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/estevaoantuness/bodybasetwitter.git
   cd bodybasetwitter
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   # Fill in the values — see Environment Variables below
   ```

4. Create Supabase tables by running the SQL in `schema/twitter-tables.sql` against your Supabase project.

5. Register the Telegram webhook (replace with your server URL):

   ```bash
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://YOUR_SERVER_URL/telegram/webhook"
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NODE_ENV` | `production` or `development` | Yes |
| `PORT` | HTTP server port (default: `3000`) | No |
| `GEMINI_API_KEY` | Google AI Studio API key | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | Yes |
| `TELEGRAM_CHAT_ID` | Telegram chat/group ID for draft delivery and alerts | Yes |
| `TWITTER_API_KEY` | Twitter Developer app key | Yes |
| `TWITTER_API_SECRET` | Twitter Developer app secret | Yes |
| `TWITTER_ACCESS_TOKEN` | Twitter OAuth 1.0a access token | Yes |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter OAuth 1.0a access token secret | Yes |

---

## Database Schema

Two tables in Supabase (see `schema/twitter-tables.sql` for the full DDL):

### `tw_daily_research`

Stores the 3 Gemini-generated drafts for each day. Written by the cron job, read and mutated by approval commands.

| Column | Type | Description |
|---|---|---|
| `date` | `TEXT` (PK) | Date key in `YYYY-MM-DD` format |
| `drafts` | `JSONB` | Array of `{num, texto, format, date}` objects |
| `created_at` | `TIMESTAMPTZ` | Row creation timestamp |

### `tw_posted`

Immutable record of every tweet successfully published.

| Column | Type | Description |
|---|---|---|
| `tweet_id` | `TEXT` (PK) | Twitter tweet ID |
| `texto` | `TEXT` | Tweet text as posted |
| `format` | `TEXT` | `'text'` or `'image'` |
| `posted_at` | `TIMESTAMPTZ` | Publish timestamp |

Useful queries:

```sql
-- Check today's drafts
SELECT * FROM tw_daily_research WHERE date = CURRENT_DATE;

-- Last 10 published tweets
SELECT * FROM tw_posted ORDER BY posted_at DESC LIMIT 10;
```

---

## Daily Cron Flow

The cron fires every day at **10:00 UTC (07:00 BRT)**:

1. `generateDrafts()` calls `gemini-2.0-flash` with the ghostwriter system prompt
2. Gemini returns a JSON array of 3 drafts, each with `num`, `texto`, and `format` (`"text"` or `"image"`)
3. Drafts are sent individually to the Telegram topic with usage instructions
4. The full drafts array is upserted into `tw_daily_research` keyed by today's date
5. On any error, an alert is sent to the Telegram system topic

To trigger the daily flow manually from Telegram, send:

```
gera
```

---

## Telegram Commands

All commands are sent in **Clawd HQ, topic 16 (twitter)**. The bot listens via webhook at `POST /telegram/webhook`.

| Command | Format | Action |
|---|---|---|
| Approve as text-only | `aprova 1` | Posts draft 1 to Twitter without media |
| Approve with photo | Send photo + caption `aprova 1` | Downloads the photo, uploads to Twitter, posts with draft 1 |
| Edit a draft | `edita 2: new text here` | Updates draft 2 in Supabase without posting |
| Discard all drafts | `ignore` | Discards all today's drafts (no post) |
| Regenerate drafts | `gera` | Runs the full daily pipeline immediately |
| Free chat | Any other message | Forwarded to `gemini-2.5-flash` as a content assistant; replies inline |

After a successful post, the bot confirms with a direct link to the published tweet.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok", ts: "<ISO timestamp>" }` — used as health check by Coolify |
| `POST` | `/telegram/webhook` | Receives Telegram update objects and routes to the command handler |

The server responds `200` to the webhook immediately before processing, preventing Telegram retries on slow operations such as media uploads.

---

## Logging

All logs are structured JSON emitted to stdout. Each entry has a fixed `ts` (ISO 8601) and `step` field, plus step-specific fields.

```json
{ "ts": "2026-02-27T10:00:01.234Z", "step": "[daily:start]", "date": "2026-02-27" }
{ "ts": "2026-02-27T10:00:03.456Z", "step": "[daily:claude]", "count": 3 }
{ "ts": "2026-02-27T10:00:03.567Z", "step": "[claude:generateDrafts:done]", "input_tokens": 542, "output_tokens": 310 }
```

Key log steps:

| Step | Meaning |
|---|---|
| `[server:start]` | Express server started |
| `[daily:cron:registered]` | Cron job registered successfully |
| `[daily:start]` / `[daily:done]` | Cron job began / completed |
| `[daily:error]` | Cron job failed — includes `message` and `stack` |
| `[cmd:received]` | Telegram command received — includes `route` type |
| `[cmd:draft]` | Draft fetched from Supabase |
| `[cmd:tweet]` | Tweet posted — includes `tweetId` |
| `[cmd:confirm]` | Confirmation sent to Telegram |
| `[cmd:edit]` | Draft updated in Supabase |
| `[cmd:ignore]` | Drafts discarded |
| `[cmd:error]` | Command failed — includes `route` and `message` |
| `[supabase:saveTweet]` | Tweet saved to `tw_posted` |
| `[supabase:saveResearch]` | Drafts saved to `tw_daily_research` |

See `CLAWD-DEBUG.md` for the full step map and operational procedures.

---

## Deployment

The server runs on **Coolify** (pangeia.cloud), built with Nixpacks.

- **Build command:** `npm run build` (compiles TypeScript to `dist/`)
- **Start command:** `node dist/index.js`
- **Health check path:** `/health`
- **Auto-deploy:** on every push to `main`

### Development Commands

```bash
npm run dev        # tsx watch — hot reload with source maps
npm run typecheck  # tsc --noEmit — type check without emitting
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled output (dist/index.js)
```

### Re-register Telegram Webhook

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://YOUR_COOLIFY_URL/telegram/webhook"
```

### Verify Webhook Status

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

---

## Troubleshooting

| Log step / error | Likely cause | Fix |
|---|---|---|
| `[cmd:media]` status 401 | `TWITTER_ACCESS_TOKEN` expired | Regenerate in Twitter Dev Portal, update Coolify env vars |
| `[cmd:media]` status 403 | App lacks Write permission | Twitter Dev Portal → App Settings → App Permissions → Read and Write |
| `[cmd:tweet]` status 403 "duplicate content" | Identical text to a recent tweet | Edit the draft first: `edita N: new text` |
| `[cmd:tweet]` status 429 | Twitter rate limit hit | Wait 15 minutes and retry |
| `[daily:claude]` status 401 | `GEMINI_API_KEY` invalid | Regenerate at aistudio.google.com, update Coolify env vars |
| `[daily:claude]` status 429 | Gemini rate limit | Wait — cron retries automatically next day |
| `[cmd:file]` status 400 | Telegram `file_id` expired (old photo) | Resend the photo |
| `[cmd:draft]` not found | Draft number does not exist for today | Only drafts 1, 2, 3 are valid |
| `[supabase:getDraft]` not found | Cron did not run or failed today | Check `[daily:error]` in logs; run `gera` to regenerate |
| `/health` returns 503 | App crashed or restarting | Check Coolify dashboard → bodybasetwitter → Logs |
| Webhook not receiving messages | Webhook URL incorrect or app offline | Re-register webhook (see above) |
