# BodyBase Twitter

Automação e gestão de conteúdo para o Twitter/X da BodyBase (@bodybasehealth).

## Workflows n8n

| Arquivo | Trigger | Função |
|---------|---------|--------|
| `tw-01-poster.json` | Webhook POST | Publica tweet via Twitter API v2 (OAuth 1.0a) |
| `tw-02-daily-research.json` | Cron 07h BRT | Pesquisa tendências + gera 3 rascunhos via Claude |
| `tw-03-telegram-commands.json` | Telegram topic 16 | Processa "aprova/edita/ignore" + suporte a fotos |
| `tw-04-performance-tracker.json` | Cron 18h BRT | Coleta métricas, calcula score, envia relatório |

## Schema Supabase

`schema/twitter-tables.sql` — criar as tabelas antes de ativar tw-03 e tw-04.

Tabelas:
- `tw_posted` — tweets publicados + métricas de engajamento
- `tw_daily_research` — sessões de pesquisa diária

Views automáticas:
- `tw_top_tweets_30d` — melhores tweets dos últimos 30 dias
- `tw_performance_by_format` — score médio por formato de tweet
- `tw_performance_by_slot` — score médio por horário (08h/12h/18h)

## Patches

`workflows/PATCHES.md` — nós extras para adicionar ao tw-02 e tw-03 após importação no n8n.

## Setup

1. Rodar `schema/twitter-tables.sql` no Supabase SQL Editor
2. Configurar variáveis n8n: `SUPABASE_URL`, `SUPABASE_KEY`, `TELEGRAM_CHAT_ID`
3. Importar workflows em ordem: tw-01 → tw-02 → tw-03 → tw-04
4. Configurar credenciais: Twitter Bearer (tw-02/04), Twitter OAuth1a (tw-01/03), Telegram
5. Ativar workflows
6. Resolver 403 n8n: Settings → API → Enable API → copiar chave

## Comandos Telegram (topic rascunhos, thread 16)

```
aprova 1          → posta tweet 1
aprova 1,3        → posta tweets 1 e 3
edita 2: [texto]  → edita e aguarda nova aprovação
ignore            → descarta rascunhos do dia
[foto] + "aprova 1" → posta com imagem
```
