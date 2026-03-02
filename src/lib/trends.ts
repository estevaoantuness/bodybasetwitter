import { TrendItem } from '../types'
import { log } from './logger'

async function fetchReddit(): Promise<TrendItem[]> {
  // Rotate between hot and new, and between subreddits, to avoid same posts every cycle
  const hour = new Date().getUTCHours()
  const sort = hour % 4 === 0 ? 'new' : 'hot'
  const subreddits = [
    'longevity+longevity_research',
    'biohacking+Biohackers',
    'nutrition+ScientificNutrition',
    'medicine+biology',
  ]
  const sub = subreddits[Math.floor(hour / 6) % subreddits.length]

  try {
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/.json?limit=20&sort=${sort}&t=day`,
      { headers: { 'User-Agent': 'bodybasetwitter/1.0' }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return []

    const data = await res.json() as {
      data: { children: { data: { title: string; score: number; permalink: string; created_utc: number } }[] }
    }
    const now = new Date().toISOString()
    const minScore = sort === 'new' ? 5 : 30

    return data.data.children
      .filter(p => p.data.score > minScore)
      .slice(0, 5)
      .map(p => ({
        source: 'reddit' as const,
        trend_type: 'velocity' as const,
        title: p.data.title,
        url: `https://reddit.com${p.data.permalink}`,
        relevance_score: 0,
        detected_at: now,
        used: false,
      }))
  } catch (e) {
    log('[trends:reddit:error]', { message: e instanceof Error ? e.message : String(e) })
    return []
  }
}

async function fetchBioRxiv(): Promise<TrendItem[]> {
  try {
    const categories = ['physiology', 'biochemistry', 'genetics']
    const cat = categories[new Date().getUTCHours() % categories.length]
    const res = await fetch(
      `https://connect.biorxiv.org/biorxiv_xml.php?subject=${cat}`,
      { headers: { 'User-Agent': 'bodybasetwitter/1.0' }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return []

    const xml = await res.text()
    const now = new Date().toISOString()
    const keywords = /longevity|aging|ageing|biomarker|metabolism|hormone|glucose|insulin|inflammation|telomere|epigenetic/i

    const titles = [...xml.matchAll(/<title>(.+?)<\/title>/g)]
      .slice(1)
      .map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').trim())
      .filter(t => keywords.test(t))
      .slice(0, 4)

    return titles.map(title => ({
      source: 'biorxiv' as const,
      trend_type: 'context' as const,
      title,
      relevance_score: 0,
      detected_at: now,
      used: false,
    }))
  } catch (e) {
    log('[trends:biorxiv:error]', { message: e instanceof Error ? e.message : String(e) })
    return []
  }
}

async function fetchPubMed(): Promise<TrendItem[]> {
  try {
    const terms = ['longevity biomarkers', 'GLP-1 aging', 'rapamycin longevity', 'wearable health metrics']
    const term = terms[new Date().getHours() % terms.length]
    const res = await fetch(
      `https://pubmed.ncbi.nlm.nih.gov/rss/search/?term=${encodeURIComponent(term)}&limit=6&format=abstract`,
      { headers: { 'User-Agent': 'bodybasetwitter/1.0' }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return []

    const xml = await res.text()
    const now = new Date().toISOString()

    // Try CDATA format first, fallback to plain title tags
    const cdataMatches = [...xml.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>/g)]
    const plainMatches = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].slice(1)
    const matches = cdataMatches.length > 0 ? cdataMatches : plainMatches

    return matches
      .slice(0, 4)
      .map(m => ({
        source: 'pubmed' as const,
        trend_type: 'context' as const,
        title: (m[1] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
        relevance_score: 0,
        detected_at: now,
        used: false,
      }))
      .filter(t => t.title.length > 10)
  } catch (e) {
    log('[trends:pubmed:error]', { message: e instanceof Error ? e.message : String(e) })
    return []
  }
}

async function fetchPerplexity(): Promise<TrendItem[]> {
  const key = process.env.PERPLEXITY_API_KEY
  if (!key) return []

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: 'List 3 top trending topics RIGHT NOW about longevity, biomarkers, GLP-1, rapamycin, wearables, or health optimization on Twitter/social media. Return ONLY a JSON array: [{"title": "brief description of what\'s trending", "url": "source_url_or_empty_string"}]. No explanation, no markdown.',
        }],
      }),
    })
    if (!res.ok) return []

    const data = await res.json() as { choices: [{ message: { content: string } }] }
    const content = data.choices[0]?.message?.content ?? ''
    const now = new Date().toISOString()

    const jsonMatch = content.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0]) as { title: string; url?: string }[]

    return parsed.slice(0, 3).map(item => ({
      source: 'perplexity' as const,
      trend_type: 'velocity' as const,
      title: item.title,
      url: item.url || undefined,
      relevance_score: 0,
      detected_at: now,
      used: false,
    }))
  } catch (e) {
    log('[trends:perplexity:error]', { message: e instanceof Error ? e.message : String(e) })
    return []
  }
}

export async function fetchAllTrends(): Promise<TrendItem[]> {
  const [reddit, pubmed, biorxiv, perplexity] = await Promise.all([
    fetchReddit(),
    fetchPubMed(),
    fetchBioRxiv(),
    fetchPerplexity(),
  ])

  const all = [...perplexity, ...reddit, ...pubmed, ...biorxiv]
  log('[trends:fetched]', {
    total: all.length,
    velocity: all.filter(t => t.trend_type === 'velocity').length,
    context: all.filter(t => t.trend_type === 'context').length,
    sources: [...new Set(all.map(t => t.source))],
  })
  return all
}
