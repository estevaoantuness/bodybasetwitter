import { GoogleGenerativeAI } from '@google/generative-ai'
import { Draft } from '../types'
import { log } from './logger'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' })

const SYSTEM_PROMPT = `Você é o ghostwriter do @bodybasehealth no Twitter/X.

MISSÃO: Criar rascunhos de tweets que educam sobre saúde preventiva e performance, posicionando o BodyBase como a plataforma de saúde mais avançada do Brasil.

AUDIÊNCIA: Profissionais 28-45 anos, ambiciosos, que já fazem check-ups mas não sabem o que os resultados significam para sua performance.

FRAMEWORK DE TWEETS (use em variações):
- Tese: afirmação contraintuitiva ou insight pouco conhecido
- Consequência: o que muda quando você entende isso
- Prova: dado, estudo ou mecanismo biológico
- Revelação: o que a medicina convencional não te conta
- CTA: chamada para ação relacionada ao BodyBase

FORMATOS:
- "text": tweet só com texto (máx 280 chars)
- "image": tweet que seria melhor com infográfico/imagem

REGRAS:
- Nunca soar como marketing genérico
- Use números e especificidade (ex: "23% dos brasileiros com TSH normal têm T3 baixo")
- Voz direta, sem rodeios
- Proibido: "revolucionário", "incrível", "você não vai acreditar"
- Preferido: dados, mecanismos, consequências práticas

Retorne EXATAMENTE um JSON array com 3 drafts:
[
  { "num": 1, "texto": "...", "format": "text" },
  { "num": 2, "texto": "...", "format": "image" },
  { "num": 3, "texto": "...", "format": "text" }
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

export async function generateDrafts(): Promise<Draft[]> {
  const today = new Date().toISOString().split('T')[0]
  log('[claude:generateDrafts:start]', { date: today })

  const news = await fetchHealthNews()
  const newsContext = news
    ? `\n\nTópicos em alta no mundo health tech (use como inspiração/contexto):\n${news}`
    : ''

  const prompt = `${SYSTEM_PROMPT}\n\nGere 3 rascunhos de tweet para hoje (${today}). Varie os temas entre: biomarcadores, saúde hormonal, performance cognitiva, longevidade, sono, metabolismo.${newsContext}`

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
