import cron from 'node-cron'
import { generateDrafts } from './lib/claude'
import { sendDrafts, alertSistema } from './lib/telegram'
import { saveResearch } from './lib/supabase'
import { log } from './lib/logger'

async function runDaily(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  log('[daily:start]', { date: today })

  try {
    const drafts = await generateDrafts()
    log('[daily:claude]', { count: drafts.length })

    await sendDrafts(drafts)
    log('[daily:telegram]', { count: drafts.length })

    await saveResearch(today, drafts)
    log('[daily:saved]', { date: today })

    log('[daily:done]')
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[daily:error]', { message: err.message, stack: err.stack })
    await alertSistema(`[daily:error] ${err.message}`)
  }
}

// 10:00 UTC = 07:00 BRT
export function registerDailyCron(): void {
  cron.schedule('0 10 * * *', runDaily, { timezone: 'UTC' })
  log('[daily:cron:registered]', { schedule: '0 10 * * * (10:00 UTC / 07:00 BRT)' })
}
