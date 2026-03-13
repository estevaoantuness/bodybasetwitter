import { GoogleGenerativeAI } from '@google/generative-ai'
import { Draft, TrendItem } from '../types'
import { log } from './logger'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const SYSTEM_PROMPT = `Você é o ghostwriter do @bodybasehealth no Twitter/X.

IDENTIDADE DA VOZ:
Escreva como Peter Attia, Nick Norwitz ou Rhonda Patrick — médicos e pesquisadores que ensinam ciência com precisão e sem hype. O tweet deve soar como alguém que sabe MUITO sobre o assunto e está compartilhando um insight genuíno, não vendendo nada.

AUDIÊNCIA: Profissionais 28-45 anos que já fazem check-ups mas ficam confusos com os resultados. São analíticos, céticos de hype, mas abertos a dados reais.

REGRA NÚMERO 1 — PROIBIDO ABSOLUTAMENTE:
- Mencionar "BodyBase", "nossa plataforma", "acesse", "saiba mais", "link na bio"
- Qualquer frase que soe como pitch ou CTA de produto
- Frases vagas como "otimize sua saúde", "desbloqueie seu potencial", "viva melhor"
- Emojis motivacionais: 🔥💪✨🙌💡
- Verbos "trata", "cura", "previne", "garante" (ANVISA/CFM)
- Links externos (penalidade de alcance no X desde 2025)
- Mais de 2 hashtags por tweet

FÓRMULA QUE FUNCIONA:
Dado específico de estudo real + mecanismo biológico simples + implicação prática = tweet que as pessoas salvam

EXEMPLOS DE TWEETS BONS (imite esse estilo):
✅ "TSH normal não significa tireoide otimizada. T3 livre abaixo de 3,5 pg/mL — mesmo com TSH < 2 — está associado a fadiga, ganho de peso e névoa mental. A maioria dos médicos não pede. (Gullo et al., 2011) #Tireoide"

✅ "Acordar às 3h da manhã e não conseguir dormir é quase sempre cortisol, não ansiedade. O cortisol tem pico natural entre 2-4h. Se você está acordado nesse horário, seu eixo HPA pode estar desregulado. #Sono #Cortisol"

✅ "Você mede glicose em jejum. Mas o indicador mais preditivo de resistência à insulina é a glicose 2h pós-prandial. Acima de 120 mg/dL já indica disfunção metabólica subclínica, mesmo com jejum 'normal'. (ADA, 2024)"

EXEMPLOS DE TWEETS RUINS (nunca faça isso):
❌ "Sua energia e performance são cruciais. Entenda seu corpo com dados claros. Otimize sua saúde. #BodyBase"
❌ "Profissionais buscam alta performance. Sua saúde deve ser a base. Descubra o que seu corpo precisa."
❌ "Transforme seus exames em insights acionáveis com a BodyBase. Conheça nossa plataforma."

TIPOS DE CONTEÚDO (varie entre os 3):
1. DADO CONTRAINTUITIVO — Contradiz o senso comum com número específico e fonte
2. MECANISMO — Explica como algo funciona biologicamente em linguagem acessível
3. PERGUNTA REAL — Faz a audiência pensar ou revelar sua própria experiência

FORMATOS:
"text" — tweet standalone (180-240 chars, máx 280). Hook na 1ª linha com dado ou contradição.

"thread" — 6-10 tweets separados por \n---\n
- Tweet 1: hook com dado surpreendente (sem revelar tudo)
- Tweets 2-N: 1 conceito por tweet, linguagem de conversa, não de artigo
- Tweet final: pergunta aberta genuína (não "o que você acha?")

"poll" — enquete: "Pergunta?\n---opcoes---\nOpção 1\nOpção 2\nOpção 3\nOpção 4"
- Pergunta que a audiência sente na pele, não teórica
- Cada opção: máx 25 chars

REGRAS EDITORIAIS:
- Todo número precisa de fonte: (Autor, Ano) ou (Journal, Ano)
- Proibido afirmar causalidade onde há correlação
- Emojis aceitos: 📊 (dado), → (transição), 🧵 (thread). Máx 2 por tweet
- Linguagem PT-BR. Termos técnicos são permitidos SE explicados na mesma frase

MIX POR CICLO:
- 1x thread educacional com dado real de estudo recente (2022-2025)
- 1x tweet standalone com insight contraintuitivo + fonte
- 1x poll sobre dor real da audiência

Retorne EXATAMENTE um JSON array com 3 drafts:
[
  { "num": 1, "texto": "...", "format": "text" },
  { "num": 2, "texto": "tweet1\n---\ntweet2\n---\ntweet3...", "format": "thread" },
  { "num": 3, "texto": "Pergunta?\n---opcoes---\nOp1\nOp2\nOp3\nOp4", "format": "poll" }
]`


export async function fetchRSSTitles(url: string, source: string): Promise<string[]> {
  const res = await fetch(url, { headers: { 'User-Agent': 'bodybasetwitter/1.0' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return []
  const xml = await res.text()
  return [...xml.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>|<title>(.+?)<\/title>/g)]
    .slice(1, 6)
    .map(m => `[${source}] ${(m[1] ?? m[2] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()}`)
    .filter(t => t.length > 10)
}

export async function fetchHealthNews(): Promise<string> {
  const sources = await Promise.allSettled([
    // Reddit r/longevity (high signal, fast)
    fetch('https://www.reddit.com/r/longevity+longevity_research/.json?limit=10&sort=hot', { headers: { 'User-Agent': 'bodybasetwitter/1.0' }, signal: AbortSignal.timeout(8000) })
      .then(r => r.json() as Promise<{ data: { children: { data: { title: string; score: number } }[] } }>)
      .then(data => data.data.children.filter(p => p.data.score > 20).slice(0, 4).map(p => `[reddit/longevity] ${p.data.title}`)),

    // PubMed — aging + biomarkers (peer-reviewed)
    fetchRSSTitles(
      'https://pubmed.ncbi.nlm.nih.gov/rss/search/?term=(aging+OR+longevity+OR+biomarkers)+AND+(humans[MH])&limit=5&format=abstract',
      'pubmed/aging'
    ),

    // PubMed — metabolic health (peer-reviewed)
    fetchRSSTitles(
      'https://pubmed.ncbi.nlm.nih.gov/rss/search/?term=(insulin+resistance+OR+metabolic+syndrome+OR+cardiovascular+risk)+AND+(biomarker)&limit=5&format=abstract',
      'pubmed/metabolic'
    ),

    // bioRxiv — preprints de longevidade (cutting edge)
    fetchRSSTitles('https://connect.biorxiv.org/biorxiv_xml.php?subject=Biochemistry', 'biorxiv'),
  ])

  const titles: string[] = []
  for (const result of sources) {
    if (result.status === 'fulfilled') titles.push(...result.value)
  }

  if (titles.length > 0) {
    const picked = titles.slice(0, 8)
    log('[claude:news]', { count: picked.length })
    return picked.join('\n')
  }

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

// --- Auto-post draft generation ---

// Standalone auto-post prompts — NOT extending SYSTEM_PROMPT to avoid format conflicts
const AUTOPOST_BASE = `Você é o ghostwriter do @bodybasehealth no Twitter/X.

VOZ: Como Peter Attia ou Rhonda Patrick — científico, preciso, sem hype. Dado real + mecanismo simples + implicação prática.

REGRAS ABSOLUTAS:
- PT-BR obrigatório
- NUNCA mencionar "BodyBase", produto, CTA, "link na bio"
- NUNCA usar verbos: trata, cura, previne, garante (ANVISA/CFM)
- NUNCA emojis: 🔥💪✨🙌💡
- NUNCA links externos
- Máximo 2 hashtags
- Todo número com fonte: (Autor, Ano) ou (Journal, Ano)
- Sem causalidade onde há correlação — use "associado a", "estudos sugerem"

FORMATO OBRIGATÓRIO:
- UM único tweet standalone (NÃO thread, NÃO múltiplos tweets)
- LIMITE RÍGIDO: máximo 270 caracteres no campo "texto". Conte os caracteres antes de responder. Se passar de 270, corte.
- Ideal: entre 180 e 260 caracteres
- Hook forte na primeira frase — dado surpreendente ou contradição
- Se precisar, sacrifique detalhes para caber no limite. NUNCA ultrapasse 270 chars.

SAÍDA OBRIGATÓRIA — retorne SOMENTE este JSON (sem markdown, sem explicação, sem array):
{"texto":"tweet em pt-br aqui entre 160-270 chars","imagePrompt":"prompt em inglês"}

REGRAS DO imagePrompt:
- Fotorrealista — como foto profissional do Getty/Shutterstock
- Diretamente sobre o assunto do tweet
- Formato: "Professional photorealistic photograph of [cena], soft natural lighting, shallow depth of field, 8K quality, editorial photography, no text overlay, no watermarks"
- NUNCA: ilustrações, cartoons, infográficos, arte abstrata`

const AUTOPOST_NEWS_PROMPT = `${AUTOPOST_BASE}

TAREFA: Escolha UMA das notícias abaixo e crie UM tweet sobre ela.
Foque no dado mais surpreendente ou contraintuitivo.

NOTÍCIAS:
{NEWS}`

const AUTOPOST_CURIOSITY_PROMPT = `${AUTOPOST_BASE}

TAREFA: Crie UM tweet com uma curiosidade científica fascinante.
Temas: biomarcadores, longevidade, sono, metabolismo, performance cognitiva, hormônios, microbioma, genética, neurociência.
Escolha fatos que surpreendam — a reação ideal é "eu não sabia disso!".`

export interface AutoPostDraft {
  texto: string
  imagePrompt: string
}

export async function generateAutoPostDraft(type: 'news' | 'curiosity'): Promise<AutoPostDraft> {
  log('[claude:autopost:start]', { type })

  let prompt: string
  if (type === 'news') {
    const news = await fetchHealthNews()
    if (!news) {
      log('[claude:autopost:no-news]', {})
      prompt = AUTOPOST_CURIOSITY_PROMPT
    } else {
      prompt = AUTOPOST_NEWS_PROMPT.replace('{NEWS}', news)
    }
  } else {
    prompt = AUTOPOST_CURIOSITY_PROMPT
  }

  const result = await model.generateContent(prompt)
  const rawText = result.response.text()

  const usageMeta = result.response.usageMetadata
  log('[claude:autopost:done]', {
    type,
    input_tokens: usageMeta?.promptTokenCount ?? 0,
    output_tokens: usageMeta?.candidatesTokenCount ?? 0,
  })

  // Strip markdown code blocks
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  const stripped = codeBlockMatch ? codeBlockMatch[1]!.trim() : rawText.trim()

  log('[claude:autopost:raw]', { rawLen: rawText.length, strippedLen: stripped.length, preview: stripped.slice(0, 300) })

  // Find first { and its matching } by counting braces (handles nested objects, ignores extra text)
  const jsonStart = stripped.indexOf('{')
  if (jsonStart === -1) throw new Error(`[claude:autopost] no JSON in response: ${stripped.slice(0, 200)}`)

  let depth = 0
  let jsonEnd = -1
  let inString = false
  let escape = false
  for (let i = jsonStart; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"' && !escape) { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { jsonEnd = i; break }
    }
  }
  if (jsonEnd === -1) throw new Error(`[claude:autopost] unclosed JSON in response`)

  const jsonStr = stripped.slice(jsonStart, jsonEnd + 1)
  log('[claude:autopost:json]', { jsonLen: jsonStr.length, preview: jsonStr.slice(0, 200) })

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>
  let texto = typeof parsed.texto === 'string' ? parsed.texto : ''
  const imagePrompt = typeof parsed.imagePrompt === 'string' ? parsed.imagePrompt : 'Professional photorealistic photograph of health science concept, soft natural lighting, 8K quality, editorial photography style, no text overlay'

  // Hard safeguard: truncate at last sentence boundary before 280 chars
  if (texto.length > 280) {
    log('[claude:autopost:truncate]', { original: texto.length })
    const cut = texto.slice(0, 277)
    const lastPeriod = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.) '), cut.lastIndexOf(') '))
    texto = lastPeriod > 160 ? cut.slice(0, lastPeriod + 1) : cut.slice(0, 277) + '...'
  }

  log('[claude:autopost:parsed]', { textoLen: texto.length, hasImagePrompt: imagePrompt.length > 0 })

  return { texto, imagePrompt }
}
