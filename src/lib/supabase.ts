import { createClient } from '@supabase/supabase-js'
import { Draft, TrendItem, TweetPerformance } from '../types'
import { log } from './logger'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getDraft(num: number, date: string): Promise<Draft> {
  const { data, error } = await supabase
    .from('tw_daily_research')
    .select('drafts')
    .eq('date', date)
    .single()

  if (error || !data) {
    throw new Error(`[supabase:getDraft] not found — date=${date}, num=${num}`)
  }

  if (!Array.isArray(data.drafts)) {
    throw new Error(`[supabase:getDraft] drafts column is not an array — date=${date}`)
  }
  const drafts = data.drafts as Draft[]
  const draft = drafts.find((d) => d.num === num)
  if (!draft) {
    throw new Error(`[supabase:getDraft] draft ${num} not found in date=${date}`)
  }

  log('[supabase:getDraft]', { num, date })
  return draft
}

export async function saveTweet(tweetId: string, texto: string, format: string): Promise<void> {
  const { error } = await supabase.from('tw_posted').insert({
    tweet_id: tweetId,
    texto,
    format,
    posted_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(`[supabase:saveTweet] ${error.message}`)
  }

  log('[supabase:saveTweet]', { tweet_id: tweetId })
}

export async function saveResearch(date: string, drafts: Draft[]): Promise<void> {
  const { error } = await supabase.from('tw_daily_research').upsert({
    date,
    drafts,
    created_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(`[supabase:saveResearch] ${error.message}`)
  }

  log('[supabase:saveResearch]', { date, count: drafts.length })
}

export async function checkResearch(date: string): Promise<boolean> {
  const { data } = await supabase
    .from('tw_daily_research')
    .select('date')
    .eq('date', date)
    .maybeSingle()
  return data !== null
}

export async function updateDraft(num: number, newText: string, date: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('tw_daily_research')
    .select('drafts')
    .eq('date', date)
    .single()

  if (fetchError || !data) {
    throw new Error(`[supabase:updateDraft] not found — date=${date}`)
  }

  if (!Array.isArray(data.drafts)) {
    throw new Error(`[supabase:updateDraft] drafts column is not an array — date=${date}`)
  }
  const drafts = data.drafts as Draft[]
  const idx = drafts.findIndex((d) => d.num === num)
  if (idx === -1) {
    throw new Error(`[supabase:updateDraft] draft ${num} not found`)
  }

  drafts[idx] = { ...drafts[idx], texto: newText }

  const { error: updateError } = await supabase
    .from('tw_daily_research')
    .update({ drafts })
    .eq('date', date)

  if (updateError) {
    throw new Error(`[supabase:updateDraft] ${updateError.message}`)
  }

  log('[supabase:updateDraft]', { num, date })
}

export async function saveTrend(item: Omit<TrendItem, 'id'>): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('tw_trends')
    .insert({
      source: item.source,
      trend_type: item.trend_type,
      title: item.title,
      url: item.url ?? null,
      relevance_score: item.relevance_score,
      detected_at: item.detected_at,
      used: item.used,
    })
    .select('id')
    .single()

  if (error) {
    log('[supabase:saveTrend:error]', { message: error.message })
    return undefined
  }
  log('[supabase:saveTrend]', { id: data?.id })
  return data?.id as string | undefined
}

export async function getTopTrends(limit = 3): Promise<TrendItem[]> {
  const { data, error } = await supabase
    .from('tw_trends')
    .select('*')
    .order('relevance_score', { ascending: false })
    .order('detected_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as TrendItem[]
}

export async function markTrendUsed(id: string): Promise<void> {
  await supabase.from('tw_trends').update({ used: true }).eq('id', id)
  log('[supabase:markTrendUsed]', { id })
}

export async function savePerformanceMetrics(metrics: TweetPerformance[]): Promise<void> {
  if (metrics.length === 0) return
  const { error } = await supabase.from('tw_performance').upsert(metrics)
  if (error) {
    log('[supabase:savePerformance:error]', { message: error.message })
  } else {
    log('[supabase:savePerformance]', { count: metrics.length })
  }
}

export async function getRecentPostedTweetIds(days = 7): Promise<string[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data } = await supabase
    .from('tw_posted')
    .select('tweet_id')
    .gte('posted_at', since)
  return (data ?? []).map(r => r.tweet_id as string)
}

export async function getRecentPerformance(days = 7): Promise<TweetPerformance[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data } = await supabase
    .from('tw_performance')
    .select('*')
    .gte('checked_at', since)
  return (data ?? []) as TweetPerformance[]
}

export async function getLastPostedAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from('tw_posted')
    .select('posted_at')
    .order('posted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    log('[supabase:getLastPostedAt:error]', { message: error.message })
  }
  return (data?.posted_at as string | undefined) ?? null
}
