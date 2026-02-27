-- ============================================================
-- Twitter Pipeline — Tabelas Supabase
-- Projeto: BodyBase (@bodybasehealth)
-- ============================================================

-- tw_posted: tweets publicados via API
-- Populado por tw-03 (no momento do post)
-- Atualizado por tw-04 (métricas de engajamento)
CREATE TABLE IF NOT EXISTS tw_posted (
  id               SERIAL PRIMARY KEY,
  tweet_id         TEXT UNIQUE NOT NULL,
  tweet_text       TEXT NOT NULL,
  format           TEXT,             -- 'dado_surpreendente' | 'opiniao_contraria' | 'thread' | 'noticia_comentada' | 'engajamento'
  scheduled_slot   TEXT,             -- '08h' | '12h' | '18h'
  research_date    DATE,             -- data da sessão de pesquisa que originou o tweet
  posted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at      TIMESTAMPTZ,

  -- Métricas de performance (populado pelo tw-04)
  impressions      INTEGER,
  likes            INTEGER,
  retweets         INTEGER,
  replies          INTEGER,
  bookmarks        INTEGER,
  performance_score INTEGER,         -- 0-100 calculado
  performance_label TEXT,            -- 'viral' | 'good' | 'normal' | 'flop'
  checked_at       TIMESTAMPTZ,      -- quando tw-04 coletou métricas

  -- Loop de aprendizado
  learning_notes   TEXT              -- padrões identificados (formato, gancho, horário)
);

-- tw_daily_research: sessões de pesquisa diária
-- Populado por tw-02 (após gerar rascunhos)
-- Atualizado por tw-03 (após aprovação e post)
CREATE TABLE IF NOT EXISTS tw_daily_research (
  id               SERIAL PRIMARY KEY,
  research_date    DATE UNIQUE NOT NULL,
  trending_topics  JSONB,            -- array de topics encontrados
  generated_drafts JSONB,            -- array de {num, text, format, source}
  approved_nums    TEXT[],           -- quais números foram aprovados ('1', '2', '3')
  posted_tweet_ids TEXT[],           -- tweet IDs postados no dia
  research_summary TEXT,             -- resumo das oportunidades identificadas pelo Claude
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

-- Índices para tw-04 e dashboards
CREATE INDEX IF NOT EXISTS idx_tw_posted_unchecked
  ON tw_posted(posted_at DESC)
  WHERE checked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tw_posted_posted_at
  ON tw_posted(posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_tw_posted_performance
  ON tw_posted(performance_score DESC)
  WHERE performance_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tw_research_date
  ON tw_daily_research(research_date DESC);

-- View: top tweets (últimos 30 dias)
CREATE OR REPLACE VIEW tw_top_tweets_30d AS
SELECT
  tweet_id,
  tweet_text,
  format,
  scheduled_slot,
  posted_at,
  impressions,
  likes,
  retweets,
  bookmarks,
  performance_score,
  performance_label
FROM tw_posted
WHERE posted_at >= NOW() - INTERVAL '30 days'
  AND performance_score IS NOT NULL
ORDER BY performance_score DESC;

-- View: performance por formato (para aprendizado)
CREATE OR REPLACE VIEW tw_performance_by_format AS
SELECT
  format,
  COUNT(*) as total_tweets,
  ROUND(AVG(performance_score)) as avg_score,
  ROUND(AVG(impressions)) as avg_impressions,
  ROUND(AVG(likes)) as avg_likes,
  SUM(CASE WHEN performance_label = 'viral' THEN 1 ELSE 0 END) as virais,
  SUM(CASE WHEN performance_label = 'good' THEN 1 ELSE 0 END) as bons
FROM tw_posted
WHERE performance_score IS NOT NULL
GROUP BY format
ORDER BY avg_score DESC;

-- View: performance por horário
CREATE OR REPLACE VIEW tw_performance_by_slot AS
SELECT
  scheduled_slot,
  COUNT(*) as total_tweets,
  ROUND(AVG(performance_score)) as avg_score,
  ROUND(AVG(impressions)) as avg_impressions
FROM tw_posted
WHERE performance_score IS NOT NULL
GROUP BY scheduled_slot
ORDER BY avg_score DESC;
