# CLAWD-DEBUG.md — bodybasetwitter

Manual de operação para o Clawd debuggar, monitorar e intervir no servidor de Twitter do BodyBase.

---

## 1. Como ler os logs

```bash
# Últimas 100 linhas
railway logs --tail 100

# Filtrar só o cron diário
railway logs --tail 500 | grep "daily:"

# Filtrar só erros de comandos
railway logs --tail 500 | grep "cmd:error"

# Filtrar só tweets postados
railway logs --tail 500 | grep "cmd:tweet"

# Ver logs desde o início do dia
railway logs --since 2h
```

Todos os logs são JSON estruturado. Campos fixos: `ts` (ISO 8601), `step`. Campos adicionais variam por step.

---

## 2. Mapa completo de steps

| Step | O que significa |
|------|----------------|
| `[server:start]` | Servidor Express iniciou |
| `[daily:cron:registered]` | Cron registrado com sucesso |
| `[daily:start]` | Cron disparou às 10:00 UTC (07:00 BRT) |
| `[daily:claude]` | Claude gerou os drafts — campo `count` |
| `[daily:telegram]` | Drafts enviados para topic 16 |
| `[daily:saved]` | Drafts salvos no Supabase (tw_daily_research) |
| `[daily:done]` | Cron concluído com sucesso |
| `[daily:error]` | Falha no cron — campos: `message`, `stack` |
| `[claude:generateDrafts:start]` | Iniciando chamada à API Anthropic |
| `[claude:generateDrafts:done]` | Resposta recebida — campos: `input_tokens`, `output_tokens` |
| `[cmd:received]` | Mensagem recebida do Telegram — campos: `route`, `chatId` |
| `[cmd:file]` | Buscando file_path no Telegram |
| `[cmd:download]` | Foto baixada — campo `bytes` |
| `[cmd:media]` | Upload da foto para Twitter — campo `mediaId` |
| `[cmd:draft]` | Draft buscado no Supabase — campos: `num`, `texto` (50 chars) |
| `[cmd:tweet]` | Tweet postado — campo `tweetId` |
| `[cmd:confirm]` | Confirmação enviada ao Telegram |
| `[cmd:edit]` | Draft atualizado no Supabase |
| `[cmd:ignore]` | Rascunhos descartados |
| `[cmd:unknown]` | Mensagem não reconhecida (ignorada) |
| `[cmd:error]` | Falha numa branch — campos: `route`, `message` |
| `[twitter:postTweet]` | Tweet postado — campo `tweet_id` |
| `[twitter:uploadMedia]` | Mídia enviada — campo `mediaId` |
| `[telegram:sendMessage]` | Mensagem enviada — campos: `chatId`, `threadId` |
| `[telegram:getFilePath]` | file_path obtido — campo `file_path` |
| `[telegram:downloadFile]` | Arquivo baixado — campo `bytes` |
| `[supabase:getDraft]` | Draft lido — campos: `num`, `date` |
| `[supabase:saveTweet]` | Tweet salvo em tw_posted — campo `tweet_id` |
| `[supabase:saveResearch]` | Drafts salvos em tw_daily_research — campos: `date`, `count` |
| `[supabase:updateDraft]` | Draft atualizado em tw_daily_research — campos: `num`, `date` |

---

## 3. Erros conhecidos + fix

| Erro no log | Causa provável | Fix |
|-------------|---------------|-----|
| `[cmd:media]` status 401 | `TWITTER_ACCESS_TOKEN` inválido ou expirado | Regenerar no Twitter Dev Portal → Railway variables |
| `[cmd:media]` status 403 | App sem permissão de Write | Twitter Dev Portal → App Settings → App Permissions → Read and Write |
| `[cmd:tweet]` status 403 "duplicate content" | Texto idêntico a tweet recente | Editar o draft antes de aprovar: `edita N: novo texto` |
| `[cmd:tweet]` status 429 | Rate limit do Twitter atingido | Aguardar 15 minutos e tentar novamente |
| `[daily:claude]` status 401 | `ANTHROPIC_API_KEY` inválida | Regenerar em console.anthropic.com → Railway variables |
| `[daily:claude]` status 529 | Anthropic overloaded | Aguardar — cron tenta novamente no dia seguinte |
| `[cmd:file]` status 400 | `file_id` expirado (foto enviada há muito tempo) | Reenviar a foto |
| `[cmd:draft]` not found | Draft N não existe para hoje | Verificar número — só existem 1, 2, 3 |
| `[supabase:getDraft]` not found | Cron não rodou hoje ou falhou | Verificar `[daily:error]` nos logs |
| `/health` retorna 503 | App em shutdown ou crash loop | `railway logs --tail 200` para ver causa raiz |
| Webhook Telegram sem resposta | URL do webhook incorreta ou Railway offline | Re-registrar webhook (ver seção 4) |

---

## 4. Operações de manutenção

### Re-registrar webhook do Telegram
```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://SEU_RAILWAY_URL/telegram/webhook"
```

### Verificar webhook atual
```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### Ver variáveis de ambiente no Railway
```bash
railway variables
```

### Forçar restart do serviço
```bash
railway redeploy
```

### Verificar tabelas Supabase
```sql
-- Drafts de hoje
SELECT * FROM tw_daily_research WHERE date = CURRENT_DATE;

-- Últimos tweets postados
SELECT * FROM tw_posted ORDER BY posted_at DESC LIMIT 10;
```

---

## 5. Estrutura de arquivos

```
src/
  index.ts          # Express entry + cron register + /health
  daily.ts          # Cron 07:00 BRT: Claude → Telegram → Supabase
  commands.ts       # POST /telegram/webhook: 4 rotas
  types.ts          # Draft, PostedTweet, TelegramUpdate, CommandRoute
  lib/
    twitter.ts      # postTweet() + uploadMedia()
    telegram.ts     # sendMessage() + getFilePath() + downloadFile() + sendDrafts() + confirm()
    claude.ts       # generateDrafts() com system prompt completo
    supabase.ts     # getDraft() + saveTweet() + saveResearch() + updateDraft()
    logger.ts       # log(step, data) → JSON estruturado
workflows/
  archive/          # Workflows n8n originais (referência histórica)
```

---

## 6. Comandos Telegram disponíveis (topic 16)

| Comando | Formato | Ação |
|---------|---------|------|
| Aprovar texto | `aprova 1` | Posta draft 1 sem imagem |
| Aprovar com foto | Envie foto com caption `aprova 1` | Posta draft 1 com foto |
| Editar draft | `edita 2: novo texto aqui` | Atualiza draft 2 no Supabase |
| Descartar tudo | `ignore` | Descarta todos os drafts do dia |

Mensagens em outros topics são ignoradas silenciosamente.
