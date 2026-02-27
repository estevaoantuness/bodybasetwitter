# Patches de Aprendizado — Loop tw-02 e tw-03

Adicionar estes nós após importar os workflows no n8n.
Requerem que as tabelas SQL em `schema/twitter-tables.sql` já existam no Supabase.

---

## PATCH A — tw-02-daily-research: Salvar sessão no Supabase

**Onde adicionar:** após o nó que envia os rascunhos para o Telegram (final do flow).

**Nó a adicionar:**

```json
{
  "id": "node-save-research-session",
  "name": "Save Research to Supabase",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "POST",
    "url": "={{ $vars.SUPABASE_URL + '/rest/v1/tw_daily_research' }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "apikey", "value": "={{ $vars.SUPABASE_KEY }}" },
        { "name": "Authorization", "value": "=Bearer {{ $vars.SUPABASE_KEY }}" },
        { "name": "Content-Type", "value": "application/json" },
        { "name": "Prefer", "value": "return=minimal,resolution=merge-duplicates" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ research_date: $('Get Today\\'s Date').first().json.hoje, trending_topics: $('Merge Searches').all().map(i => i.json), research_summary: $('Generate Tweets').first().json.choices[0].message.content.substring(0, 500), generated_drafts: [] }) }}",
    "options": { "response": { "response": { "neverError": true } } }
  }
}
```

**Variáveis necessárias no n8n:** `SUPABASE_URL`, `SUPABASE_KEY`

---

## PATCH B — tw-03-telegram-commands: Logar tweet postado no Supabase

**Onde adicionar:** após o nó `Post Tweet` no caso `photo_approve` e `text_approve` (nos 2 branches de aprovação), quando o tweet for postado com sucesso.

**Nó a adicionar (após checar tweet_id existe):**

```json
{
  "id": "node-log-tweet-posted",
  "name": "Log Tweet to Supabase",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "POST",
    "url": "={{ $vars.SUPABASE_URL + '/rest/v1/tw_posted' }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "apikey", "value": "={{ $vars.SUPABASE_KEY }}" },
        { "name": "Authorization", "value": "=Bearer {{ $vars.SUPABASE_KEY }}" },
        { "name": "Content-Type", "value": "application/json" },
        { "name": "Prefer", "value": "return=minimal,resolution=ignore-duplicates" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ tweet_id: $('Post Tweet').first().json.data.id, tweet_text: $('Parse & Route').first().json.tweetText, format: $('Parse & Route').first().json.tweetFormat || 'desconhecido', scheduled_slot: $('Parse & Route').first().json.scheduledSlot || 'manual', research_date: $('Parse & Route').first().json.hoje, approved_at: new Date().toISOString() }) }}",
    "options": { "response": { "response": { "neverError": true } } }
  }
}
```

**Nota:** O nó `Parse & Route` em tw-03 deve ser atualizado para extrair e passar `tweetText`, `tweetFormat` e `scheduledSlot` do contexto do rascunho original. Se o Clawd não tiver esses dados no momento da aprovação, usar `'desconhecido'` como fallback — o tw-04 ainda consegue rastrear por `tweet_id`.

---

## Variáveis de Ambiente (n8n → Settings → Variables)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `SUPABASE_URL` | URL do projeto Supabase | `https://xyz.supabase.co` |
| `SUPABASE_KEY` | Anon Key (ou Service Role para writes) | `eyJ...` |
| `TELEGRAM_CHAT_ID` | ID do grupo Clawd HQ | `-100xxxxxxxxx` |
| `TELEGRAM_BOT_TOKEN` | Token do bot (se não usar credentials) | `123:ABC...` |

---

## Prioridade de implementação

1. **Schema SQL** — rodar no Supabase SQL Editor PRIMEIRO
2. **Variáveis n8n** — SUPABASE_URL e SUPABASE_KEY
3. **tw-04** — importar e ativar (começa a funcionar assim que tweets existirem em tw_posted)
4. **Patch B (tw-03)** — adicionar Log Tweet após post bem-sucedido
5. **Patch A (tw-02)** — salvar sessão de pesquisa (menos urgente)
