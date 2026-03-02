import cron from 'node-cron'
import { generateDrafts } from './lib/claude'
import { fetchTweetMetrics, formatPerformanceInsights } from './lib/analytics'
import { sendDrafts, alertSistema } from './lib/telegram'
import { saveResearch, getRecentPostedTweetIds, getRecentPerformance, savePerformanceMetrics } from './lib/supabase'
import { log } from './lib/logger'

let isRunning = false

async function runDaily(slot?: 'morning' | 'evening'): Promise<void> {
  if (isRunning) {
    log('[daily:skip]', { reason: 'already_running', slot: slot ?? 'manual' })
    return
  }
  isRunning = true
  const today = new Date().toISOString().split('T')[0]
  log('[daily:start]', { date: today, slot: slot ?? 'manual' })

  try {
    // Fetch and cache performance metrics (best-effort — won't crash daily if API fails)
    let performanceContext: string | undefined
    try {
      const tweetIds = await getRecentPostedTweetIds(7)
      if (tweetIds.length > 0) {
        const freshMetrics = await fetchTweetMetrics(tweetIds)
        if (freshMetrics.length > 0) await savePerformanceMetrics(freshMetrics)
      }
      const allMetrics = await getRecentPerformance(7)
      const insights = formatPerformanceInsights(allMetrics)
      if (insights) performanceContext = insights
      log('[daily:performance]', { metricsCount: allMetrics.length })
    } catch (perfErr) {
      log('[daily:performance:skip]', { reason: perfErr instanceof Error ? perfErr.message : String(perfErr) })
    }

    const drafts = await generateDrafts(performanceContext)
    log('[daily:claude]', { count: drafts.length })

    await sendDrafts(drafts, slot)
    log('[daily:telegram]', { count: drafts.length })

    await saveResearch(today, drafts)
    log('[daily:saved]', { date: today })

    log('[daily:done]')
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[daily:error]', { message: err.message, stack: err.stack })
    await alertSistema(`[daily:error] ${err.message}`)
  } finally {
    isRunning = false
  }
}

export { runDaily }

// 10:00 UTC = 07:00 BRT | 20:00 UTC = 17:00 BRT
export function registerDailyCron(): void {
  cron.schedule('0 10 * * *', () => runDaily('morning'), { timezone: 'UTC' })
  cron.schedule('0 20 * * *', () => runDaily('evening'), { timezone: 'UTC' })
  log('[daily:cron:registered]', { schedules: ['0 10 * * * (07:00 BRT)', '0 20 * * * (17:00 BRT)'] })
}
