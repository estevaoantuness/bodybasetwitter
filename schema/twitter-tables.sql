-- ============================================================
-- Twitter Pipeline — Tabelas Supabase
-- Projeto: BodyBase (@bodybasehealth)
-- Schema alinhado com src/lib/supabase.ts
-- ============================================================

-- tw_daily_research: drafts gerados pelo cron diário (07h BRT)
-- Populado por daily.ts (saveResearch)
-- Lido e atualizado por commands.ts (getDraft, updateDraft)
CREATE TABLE IF NOT EXISTS tw_daily_research (
  date        TEXT PRIMARY KEY,   -- YYYY-MM-DD
  drafts      JSONB NOT NULL,     -- array de {num, texto, format, date}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tw_posted: tweets publicados via Twitter API
-- Populado por commands.ts (saveTweet) após post bem-sucedido
CREATE TABLE IF NOT EXISTS tw_posted (
  tweet_id    TEXT PRIMARY KEY,
  texto       TEXT NOT NULL,      -- texto do tweet como postado
  format      TEXT NOT NULL,      -- 'text' | 'image'
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tw_trends: trends detectadas pelo cron de 2h
-- Populado por trends.ts (runTrendCycle)
CREATE TABLE IF NOT EXISTS tw_trends (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source         TEXT NOT NULL,         -- 'reddit' | 'biorxiv' | 'perplexity' | 'pubmed'
  trend_type     TEXT NOT NULL,         -- 'velocity' | 'context'
  title          TEXT NOT NULL,
  url            TEXT,
  relevance_score INT NOT NULL DEFAULT 0, -- 0-100
  used           BOOLEAN NOT NULL DEFAULT false
);

-- tw_performance: métricas de engajamento dos tweets postados
-- Populado pelo cron diário (daily.ts via analytics.ts)
CREATE TABLE IF NOT EXISTS tw_performance (
  tweet_id        TEXT PRIMARY KEY REFERENCES tw_posted(tweet_id),
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  impressions     INT NOT NULL DEFAULT 0,
  likes           INT NOT NULL DEFAULT 0,
  retweets        INT NOT NULL DEFAULT 0,
  replies         INT NOT NULL DEFAULT 0,
  bookmarks       INT NOT NULL DEFAULT 0,
  engagement_rate FLOAT NOT NULL DEFAULT 0  -- (RT×20 + reply×13.5 + bookmark×10 + like) / impressions
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_tw_daily_research_date
  ON tw_daily_research(date DESC);

CREATE INDEX IF NOT EXISTS idx_tw_posted_posted_at
  ON tw_posted(posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_tw_trends_detected_at
  ON tw_trends(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_tw_trends_relevance
  ON tw_trends(relevance_score DESC);
