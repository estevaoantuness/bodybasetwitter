import { GoogleGenerativeAI } from '@google/generative-ai'
import { Draft, TrendItem } from '../types'
import { log } from './logger'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const SYSTEM_PROMPT = `Você é o ghostwriter do @bodybasehealth no Twitter/X.

MISSÃO: Criar rascunhos de tweets que educam sobre saúde preventiva e performance, posicionando o BodyBase como a plataforma de interpretação de biomarcadores mais avançada do Brasil.

AUDIÊNCIA: Profissionais 28-45 anos, ambiciosos, que já fazem check-ups mas não entendem o que os resultados significam para sua performance e longevidade.

ALGORITMO DO X (2026) — pesos de engajamento:
- Repost/Retweet: ~20x mais valioso que like
- Reply: ~13.5x mais valioso que like
- Bookmark: ~10x mais valioso que like
- Like: baseline (1x — menor valor)
Priorize conteúdo que gera DEBATE (replies) e conteúdo que pessoas SALVAM (bookmarks). Curtida passiva é o sinal de menor valor algorítmico.

REGRAS DE ALCANCE (obrigatórias):
- NUNCA incluir links externos — alcance cai para ~zero desde mar/2026
- Máximo 2-3 hashtags por tweet (mais = penalidade de spam)
- Hooks fortes: primeiro tweet carrega 80% do peso de uma thread
- Sem CTAs de "link na bio" ou redirecionamento externo

TIPOS DE CONTEÚDO (varie entre os 3):
1. COMPETÊNCIA — Demonstra expertise técnica
   - Dado de estudo novo com interpretação prática
   - Insight contraintuitivo com mecanismo biológico
   - Breakdown de biomarcador ou marcador ignorado
2. CONEXÃO — Gera conversa e reply
   - Pergunta real para a audiência (provoca resposta genuína)
   - "Como eu penso sobre X" — processo de raciocínio transparente
   - Posição calibrada sobre debate na área
3. PERSONAGEM — Mostra quem somos
   - Bastidor do que estamos construindo na BodyBase
   - Opinião forte mas embasada sobre tendência da área
   - Transparência radical sobre dado ou descoberta

FÓRMULA DE POSICIONAMENTO:
Dado de pesquisa real + interpretação prática + implicação pessoal = tweet que posiciona

FORMATOS DISPONÍVEIS:
"text" — tweet standalone (180-240 chars idealmente, máx 280)
- Hook na primeira linha: dado surpreendente, contradição ou número
- Direto, sem rodeios — cada frase justifica sua existência

"image" — tweet que funciona melhor com visual
- Escreva o texto do tweet normalmente
- Adicione ao final: [visual: descrição do infográfico/dado ideal]

"thread" — série de 8-12 tweets separados por \n---\n
- Tweet 1 = HOOK com promessa clara + por que vale ler (carrega 80% do peso)
- Tweets 2-N = 1 conceito ou dado por tweet, cada um autossuficiente
- Tweet final = síntese em 1-2 linhas + pergunta aberta (sem link)
- Formato de separação obrigatório: cada tweet separado por \n---\n

"poll" — enquete com 4 opções para gerar impressões e conversa
- Formato exato: "Pergunta?\n---opcoes---\nOpção 1\nOpção 2\nOpção 3\nOpção 4"
- Pergunta genuinamente relevante para a audiência (não forçada)
- Cada opção: máx 25 chars

REGRAS EDITORIAIS:
- Nunca soar como marketing genérico
- Use números com especificidade (ex: "23% dos brasileiros com TSH normal têm T3 baixo")
- Proibido: "revolucionário", "incrível", "você não vai acreditar", emojis 🔥💪✨🙌
- Proibido: afirmar causalidade onde há apenas correlação
- Proibido: verbos "trata", "cura", "previne", "garante" (ANVISA/CFM)
- Permitido: "associado a", "estudos sugerem", "dados indicam", "observou-se que"
- Emojis aceitos: 🧵 (thread), 📊 (dado), → (transição lógica). Máx 2 por tweet
- Todo número precisa de fonte: (Autor, Ano) ou (Journal, Ano)
- Linguagem PT-BR em todo o conteúdo

MIX POR CICLO (manhã ou tarde):
Gere 3 rascunhos com formatos e tipos de conteúdo variados:
- 1x conteúdo de alta densidade (thread educacional ou dado técnico com image)
- 1x conteúdo de engajamento (gera reply ou bookmark — tipo Conexão ou Competência forte)
- 1x formato variado (poll semanal, opinião forte, ou bastidor — tipo Personagem ou Conexão)

Retorne EXATAMENTE um JSON array com 3 drafts:
[
  { "num": 1, "texto": "...", "format": "text" },
  { "num": 2, "texto": "hook tweet\n---\nsegundo tweet\n---\nterceiro tweet...", "format": "thread" },
  { "num": 3, "texto": "Pergunta?\n---opcoes---\nOpção 1\nOpção 2\nOpção 3\nOpção 4", "format": "poll" }
]`

const CHAT_SYSTEM = `Você é o assistente de conteúdo do @bodybasehealth no Twitter/X.
Ajuda o Estevão (fundador do BodyBase) com: ideias de tweets, feedback de copy, estratégia de conteúdo, dados de saúde/biomarcadores para posts.
BodyBase é uma plataforma de saúde preventiva e performance baseada em biomarcadores. Público: profissionais 28-45 anos.
Seja direto, use dados reais quando possível. Responda em PT-BR.`

export async function chat(userMessage: string): Promise<string> {
  log('[claude:chat:start]', { len: userMessage.length })
  const result = await chatModel.generateContent(`${CHAT_SYSTEM}\n\nUsuário: ${userMessage}`)
  const reply = result.response.text()
  log('[claude:chat:done]', { reply_len: reply.length })
  return reply
}

async function fetchHealthNews(): Promise<string> {
  // Source 1: Reddit r/longevity+biohacking (JSON API, cloud-friendly)
  try {
    const res = await fetch(
      'https://www.reddit.com/r/longevity+biohacking/.json?limit=8&sort=hot',
      { headers: { 'User-Agent': 'bodybasetwitter/1.0' } }
    )
    if (res.ok) {
      const data = await res.json() as { data: { children: { data: { title: string; score: number } }[] } }
      const titles = data.data.children
        .filter(p => p.data.score > 10)
        .slice(0, 5)
        .map(p => `- ${p.data.title}`)
      if (titles.length > 0) {
        log('[claude:news]', { count: titles.length, source: 'reddit' })
        return titles.join('\n')
      }
    }
  } catch { /* fallthrough */ }

  // Source 2: PubMed RSS (academic, very cloud-friendly)
  try {
    const res = await fetch(
      'https://pubmed.ncbi.nlm.nih.gov/rss/search/?term=longevity+biomarkers+health&limit=5&format=abstract'
    )
    if (res.ok) {
      const xml = await res.text()
      const titles = [...xml.matchAll(/<title>(.+?)<\/title>/g)]
        .slice(1, 6)
        .map(m => `- ${m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<')}`)
      if (titles.length > 0) {
        log('[claude:news]', { count: titles.length, source: 'pubmed' })
        return titles.join('\n')
      }
    }
  } catch { /* fallthrough */ }

  log('[claude:news:none]', {})
  return ''
}

export async function generateDrafts(performanceContext?: string): Promise<Draft[]> {
  const today = new Date().toISOString().split('T')[0]
  log('[claude:generateDrafts:start]', { date: today, hasPerformanceContext: !!performanceContext })

  const news = await fetchHealthNews()
  const newsContext = news
    ? `\n\nTópicos em alta no mundo health tech (use como inspiração/contexto):\n${news}`
    : ''

  const perfContext = performanceContext ?? ''

  const prompt = `${SYSTEM_PROMPT}\n\nGere 3 rascunhos de tweet para hoje (${today}). Varie os temas entre: biomarcadores, saúde hormonal, performance cognitiva, longevidade, sono, metabolismo.${newsContext}${perfContext}`

  const result = await model.generateContent(prompt)
  const rawText = result.response.text()

  const usageMeta = result.response.usageMetadata
  log('[claude:generateDrafts:done]', {
    input_tokens: usageMeta?.promptTokenCount ?? 0,
    output_tokens: usageMeta?.candidatesTokenCount ?? 0,
  })

  // Parse JSON — aceita markdown code block
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, rawText]
  const jsonStr = jsonMatch[1]?.trim() ?? rawText.trim()

  const parsed = JSON.parse(jsonStr) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('[claude:generateDrafts] response is not an array')
  }

  return parsed.map((d: Record<string, unknown>, i: number) => {
    const num = typeof d.num === 'number' ? d.num : i + 1
    const texto = typeof d.texto === 'string' ? d.texto : ''
    const format: Draft['format'] = d.format === 'image' ? 'image' : 'text'
    return { num, texto, format, date: today }
  })
}

const TREND_DRAFT_SUFFIX = `

CONTEXTO ESPECIAL — TREND DETECTADA:
Tipo: {TREND_TYPE}
Fonte: {SOURCE}
Tópico: {TITLE}
{URL_LINE}
Gere UM único tweet que surfe esta trend mantendo:
- Tom científico e educacional (sem sensacionalismo)
- Compliance ANVISA/CFM obrigatório (sem verbos proibidos)
- Hook forte relacionado ao tópico em alta
- Formato text ou thread (se o tema exigir mais de 280 chars)

Retorne SOMENTE JSON de 1 draft (sem markdown):
{"num":1,"texto":"...","format":"text"}`

export async function generateDraftFromTrend(trend: TrendItem): Promise<Draft> {
  const today = new Date().toISOString().split('T')[0]
  log('[claude:generateDraftFromTrend:start]', { title: trend.title.slice(0, 60) })

  const urlLine = trend.url ? `URL de referência: ${trend.url}` : ''
  const trendLabel = trend.trend_type === 'velocity' ? 'Em alta AGORA (urgência)' : 'Contexto de qualidade'

  const prompt = SYSTEM_PROMPT + TREND_DRAFT_SUFFIX
    .replace('{TREND_TYPE}', trendLabel)
    .replace('{SOURCE}', trend.source)
    .replace('{TITLE}', trend.title)
    .replace('{URL_LINE}', urlLine)

  const result = await model.generateContent(prompt)
  const rawText = result.response.text()

  // Accept both JSON object and JSON array
  const stripped = rawText.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim()
  const parsed = JSON.parse(stripped.startsWith('[') ? stripped : stripped) as
    | Record<string, unknown>
    | Record<string, unknown>[]
  const d = Array.isArray(parsed) ? (parsed[0] ?? {}) : parsed

  log('[claude:generateDraftFromTrend:done]', {})
  return {
    num: 1,
    texto: typeof d.texto === 'string' ? d.texto : '',
    format: d.format === 'thread' ? 'thread' : 'text',
    date: today,
  }
}
