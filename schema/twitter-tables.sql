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

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_tw_daily_research_date
  ON tw_daily_research(date DESC);

CREATE INDEX IF NOT EXISTS idx_tw_posted_posted_at
  ON tw_posted(posted_at DESC);
