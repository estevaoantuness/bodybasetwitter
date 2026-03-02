import { GoogleGenerativeAI } from '@google/generative-ai'
import { log } from './logger'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export interface ScoreResult {
  score: number         // 0-100
  compliance: boolean   // ANVISA/CFM compliant
  reason: string        // brief justification
  breakdown: {
    compliance: number  // 0-25
    quality: number     // 0-25
    engagement: number  // 0-25
    timing: number      // 0-25
  }
}

const SCORER_PROMPT = `Você é auditor de qualidade de tweets do @bodybasehealth (saúde preventiva, biomarcadores, longevidade).

Avalie o tweet abaixo em 4 dimensões (0-25 pts cada, total 0-100):

1. COMPLIANCE (0-25): Cumpre ANVISA/CFM? Sem verbos proibidos (trata, cura, previne, garante)? Não afirma causalidade onde é correlação? Usa linguagem aprovada (associado a, estudos sugerem, dados indicam)?

2. QUALIDADE EDITORIAL (0-25): Hook forte? Dados específicos com fonte? Sem jargão não explicado? Sem emojis proibidos (🔥💪✨🙌)? Sem palavras proibidas (revolucionário, incrível)?

3. POTENCIAL DE ENGAJAMENTO (0-25): Provoca debate genuíno (replies)? Pessoas vão salvar (bookmarks)? Contraintuitivo? Gera reflexão real?

4. RELEVÂNCIA/TIMING (0-25): Relevante para o nicho longevidade/biomarcadores? Oportuno para o momento?

Retorne SOMENTE JSON válido (sem markdown, sem explicação):
{"score":<0-100>,"compliance":<true|false>,"reason":"<1 frase concisa>","breakdown":{"compliance":<0-25>,"quality":<0-25>,"engagement":<0-25>,"timing":<0-25>}}`

export async function scoreTweet(texto: string): Promise<ScoreResult> {
  log('[scorer:start]', { len: texto.length })

  const result = await model.generateContent(`${SCORER_PROMPT}\n\nTWEET:\n${texto.slice(0, 2000)}`)
  const raw = result.response.text()

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`[scorer] no JSON in response: ${raw.slice(0, 100)}`)

  const parsed = JSON.parse(jsonMatch[0]) as ScoreResult
  log('[scorer:done]', { score: parsed.score, compliance: parsed.compliance })
  return parsed
}

const RELEVANCE_PROMPT = `Avalie a relevância de cada título para o nicho @bodybasehealth (longevidade, biomarcadores, performance).

Critérios de pontuação (0-100):
- 80-100: Diretamente sobre GLP-1, rapamycin, biomarcadores, longevidade, wearables, saúde preventiva, performance cognitiva
- 50-79: Saúde geral, nutrição, sono, hormônios, metabolismo, pesquisa médica relevante
- 0-49: Irrelevante ou muito genérico para o nicho

Títulos:
{TITLES}

Retorne SOMENTE um JSON array de números (um por título, mesma ordem): [score1, score2, ...]`

export async function scoreTrendRelevance(titles: string[]): Promise<number[]> {
  if (titles.length === 0) return []

  try {
    const prompt = RELEVANCE_PROMPT.replace('{TITLES}', titles.map((t, i) => `${i + 1}. ${t}`).join('\n'))
    const result = await model.generateContent(prompt)
    const raw = result.response.text()

    const jsonMatch = raw.match(/\[\s*[\d\s,]+\]/)
    if (!jsonMatch) return titles.map(() => 50)

    const scores = JSON.parse(jsonMatch[0]) as number[]
    // Ensure we have a score for every title
    return titles.map((_, i) => scores[i] ?? 50)
  } catch {
    log('[scorer:relevance:error]', {})
    return titles.map(() => 50)
  }
}
