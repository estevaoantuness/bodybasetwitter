import { createClient } from '@supabase/supabase-js'
import { Draft } from '../types'
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
