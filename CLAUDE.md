# CLAUDE.md — bodybasetwitter

## IDENTIDADE DO REPO

Servidor TypeScript puro que substitui os workflows n8n de Twitter do BodyBase.
Sem n8n no loop — código que o Clawd lê, debuga e modifica diretamente.

## CLAWD WORKSPACE

Este repo é usado como tool pelo Clawd bot.
Workspace público: https://github.com/estevaoantuness/clawd-workspace

O Clawd acessa este repo para:
- Ler logs de operação
- Modificar o system prompt em `src/lib/claude.ts`
- Ajustar o cron schedule em `src/daily.ts`
- Adicionar novos cases em `src/commands.ts`

## DEPLOY — COOLIFY

- **Plataforma:** Coolify (coolify.pangeia.cloud)
- **Projeto:** BodyBase (uuid: xcocw0w88c4co0g0wcs84ooo)
- **App UUID:** bcogocwo4gssw4o4ccs0ssk8
- **URL:** https://bcogocwo4gssw4o4ccs0ssk8.pangeia.cloud
- **Branch:** main — auto-deploy a cada push
- **Build:** nixpacks → `npm run build` → `node dist/index.js`

### Credenciais Coolify (para automação via API)
Estão em `/Users/estevaoantunes/superbem/.env`:
```
COOLIFY_URL=https://coolify.pangeia.cloud
COOLIFY_API_KEY=...
```

### Triggar redeploy via API
```bash
curl -s -X POST \
  -H "Authorization: Bearer $COOLIFY_API_KEY" \
  "https://coolify.pangeia.cloud/api/v1/deploy?uuid=bcogocwo4gssw4o4ccs0ssk8&force=false"
```

## STACK

- **Runtime:** Node.js 20+ / TypeScript strict
- **Framework:** Express
- **Cron:** node-cron (07:00 BRT = 10:00 UTC)
- **AI:** Anthropic claude-opus-4-6
- **DB:** Supabase (mesmo projeto do BodyBase: nklnhazqmxmetrumovaf)
- **Twitter:** twitter-api-v2
- **Telegram:** fetch nativo (Bot API)

## ESTRUTURA

```
src/
  index.ts       # Express entry + /health + cron register
  daily.ts       # Cron → Claude → Telegram topic 16 → Supabase
  commands.ts    # POST /telegram/webhook → 4 cases
  types.ts       # Draft, TelegramUpdate, CommandRoute
  lib/
    logger.ts    # log(step, data) → JSON estruturado
    twitter.ts   # postTweet() + uploadMedia()
    telegram.ts  # sendMessage() + getFilePath() + downloadFile()
    claude.ts    # generateDrafts() — system prompt ghostwriter
    supabase.ts  # getDraft() + saveTweet() + saveResearch() + updateDraft()
workflows/
  archive/       # Workflows n8n originais (referência histórica)
CLAWD-DEBUG.md   # Manual de operação completo
```

## TABELAS SUPABASE

```sql
-- tw_daily_research: drafts gerados pelo cron
-- colunas: date (text PK), drafts (jsonb), created_at (timestamptz)

-- tw_posted: tweets publicados
-- colunas: tweet_id (text PK), texto (text), format (text), posted_at (timestamptz)
```

Schema completo em `schema/twitter-tables.sql`.

## TELEGRAM TOPICS (Clawd HQ)

| Topic ID | Nome | Uso |
|----------|------|-----|
| 16 | twitter | Drafts do dia + comandos de aprovação |
| 20 | sistema | Alertas de erro do servidor |

## COMANDOS DISPONÍVEIS (topic 16)

| Comando | Formato |
|---------|---------|
| Aprovar texto | `aprova 1` |
| Aprovar com foto | Enviar foto + caption `aprova 1` |
| Editar draft | `edita 2: novo texto aqui` |
| Descartar tudo | `ignore` |

## ENV VARS NECESSÁRIAS

```
NODE_ENV=production
PORT=3000
SUPABASE_URL=               # mesmo do bodybaseback
SUPABASE_SERVICE_ROLE_KEY=  # mesmo do bodybaseback
ANTHROPIC_API_KEY=          # console.anthropic.com
TELEGRAM_BOT_TOKEN=         # @BotFather
TELEGRAM_CHAT_ID=           # ID do Clawd HQ
TWITTER_API_KEY=            # Twitter Dev Portal
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_TOKEN_SECRET=
```

## DEV WORKFLOW

```bash
npm run dev        # tsx watch — hot reload
npm run typecheck  # tsc --noEmit
npm run build      # compila para dist/
```

## LOGS

Todos os logs são JSON estruturado. Ver `CLAWD-DEBUG.md` para mapa completo de steps.

```bash
# Logs no Coolify
railway logs --tail 100  # se Railway
# ou via Coolify dashboard → bodybasetwitter → Logs
```
