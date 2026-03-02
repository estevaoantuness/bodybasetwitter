import cron from 'node-cron'
import { fetchAllTrends } from './lib/trends'
import { scoreTrendRelevance, scoreTweet } from './lib/scorer'
import {
  saveTrend,
  getTopTrends,
  markTrendUsed,
  getLastPostedAt,
  saveTweet as saveTweetDB,
} from './lib/supabase'
import { generateDraftFromTrend } from './lib/claude'
import { postTweet, postThread } from './lib/twitter'
import { sendMessage, alertSistema } from './lib/telegram'
import { log } from './lib/logger'
import { TrendItem } from './types'

// Auto-publish starts OFF (dry-run). Must be explicitly enabled via Telegram command.
let autoPublishEnabled = false

export function setAutoPublish(enabled: boolean): void {
  autoPublishEnabled = enabled
  log('[trends:auto_publish:set]', { enabled })
}

export function isAutoPublishEnabled(): boolean {
  return autoPublishEnabled
}

const SCORE_AUTO_PUBLISH = 80    // auto-post if score >= this
const SCORE_NOTIFY = 60          // send to Telegram if score >= this
const COOLDOWN_MINUTES = 90      // min minutes between auto-posts

export async function runTrendCycle(): Promise<void> {
  log('[trends:cycle:start]', {})
  const chatId = process.env.TELEGRAM_CHAT_ID!

  try {
    // 1. Fetch trends from all sources in parallel
    const rawTrends = await fetchAllTrends()
    if (rawTrends.length === 0) {
      log('[trends:cycle:no_trends]', {})
      return
    }

    // 2. Score relevance via LLM (single batch call)
    const titles = rawTrends.map(t => t.title)
    const scores = await scoreTrendRelevance(titles)
    const scoredTrends = rawTrends.map((t, i) => ({ ...t, relevance_score: scores[i] ?? 50 }))

    // 3. Keep top 3 with relevance > 40 and save to Supabase
    const topTrends = scoredTrends
      .filter(t => t.relevance_score > 40)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 3)

    const savedIds: Record<number, string | undefined> = {}
    for (let i = 0; i < topTrends.length; i++) {
      savedIds[i] = await saveTrend(topTrends[i])
    }
    log('[trends:cycle:saved]', { count: topTrends.length })

    // 4. Report to Telegram regardless of scores
    if (topTrends.length > 0) {
      const lines = topTrends.map((t, i) =>
        `${i + 1}. [${t.trend_type}/${t.source}] ${t.title}\n   Relevância: ${t.relevance_score}`
      )
      await sendMessage(chatId, `🔍 <b>Trends detectadas</b>\n\n${lines.join('\n\n')}`)
    }

    // 5. If top trend is hot enough (>70), generate a draft and evaluate for publish
    const hotTrend = topTrends.find(t => t.relevance_score > 70)
    if (hotTrend) {
      const hotIndex = topTrends.indexOf(hotTrend)
      const trendWithId = { ...hotTrend, id: savedIds[hotIndex] }
      await processTrendForPublish(trendWithId, chatId)
    }

    log('[trends:cycle:done]', {})
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[trends:cycle:error]', { message: err.message })
    await alertSistema(`[trends:error] ${err.message}`)
  }
}

async function processTrendForPublish(trend: TrendItem, chatId: string): Promise<void> {
  log('[trends:generate:start]', { title: trend.title.slice(0, 80) })

  try {
    const draft = await generateDraftFromTrend(trend)
    const scoreResult = await scoreTweet(draft.texto)
    log('[trends:scored]', { score: scoreResult.score, compliance: scoreResult.compliance })

    // Hard block: ANVISA/CFM non-compliant
    if (!scoreResult.compliance) {
      log('[trends:rejected:compliance]', {})
      await sendMessage(
        chatId,
        `⚠️ Draft de trend rejeitado por compliance ANVISA/CFM\nScore: ${scoreResult.score}\nMotivo: ${scoreResult.reason}`
      )
      return
    }

    if (scoreResult.score >= SCORE_AUTO_PUBLISH) {
      if (!autoPublishEnabled) {
        // DRY-RUN: log and notify but don't post
        log('[trends:dry_run:would_publish]', { score: scoreResult.score })
        await sendMessage(
          chatId,
          `🧪 <b>[DRY-RUN] Score ${scoreResult.score} ≥ ${SCORE_AUTO_PUBLISH}</b> — auto-publish desativado\n` +
          `Razão: ${scoreResult.reason}\n\n<b>Draft:</b>\n${draft.texto.slice(0, 600)}\n\n` +
          `Use <code>auto on</code> para ativar publicação automática.`
        )
        return
      }

      // Check cooldown
      const lastPostedAt = await getLastPostedAt()
      if (lastPostedAt) {
        const minutesSinceLast = (Date.now() - new Date(lastPostedAt).getTime()) / 60_000
        if (minutesSinceLast < COOLDOWN_MINUTES) {
          log('[trends:cooldown]', { minutesSinceLast: Math.round(minutesSinceLast) })
          await sendMessage(
            chatId,
            `⏱ Trend boa (score ${scoreResult.score}) mas cooldown ativo ` +
            `(${Math.round(minutesSinceLast)}/${COOLDOWN_MINUTES} min desde último post)`
          )
          return
        }
      }

      // AUTO-PUBLISH
      const tweets = draft.texto.split('\n---\n').filter(t => t.trim())
      const tweetId = draft.format === 'thread' && tweets.length > 1
        ? await postThread(tweets)
        : await postTweet(draft.texto)

      await saveTweetDB(tweetId, draft.texto, draft.format)
      if (trend.id) await markTrendUsed(trend.id)

      log('[trends:auto_published]', { tweetId, score: scoreResult.score })
      await sendMessage(
        chatId,
        `🚀 <b>Auto-publicado!</b> (score ${scoreResult.score})\n` +
        `https://twitter.com/bodybasehealth/status/${tweetId}`
      )

    } else if (scoreResult.score >= SCORE_NOTIFY) {
      // Send to Telegram for human approval — trend expires fast
      await sendMessage(
        chatId,
        `⚡ <b>Trend p/ aprovação</b> (score ${scoreResult.score} — expira rápido!)\n\n` +
        `📰 <b>Trend:</b> ${trend.title}\n\n` +
        `📝 <b>Draft completo:</b>\n${draft.texto.slice(0, 1000)}\n\n` +
        `Motivo: ${scoreResult.reason}\n\n` +
        `Breakdown: compliance ${scoreResult.breakdown.compliance}/25 | ` +
        `qualidade ${scoreResult.breakdown.quality}/25 | ` +
        `engajamento ${scoreResult.breakdown.engagement}/25 | ` +
        `timing ${scoreResult.breakdown.timing}/25`
      )
    } else {
      log('[trends:discarded]', { score: scoreResult.score, reason: scoreResult.reason })
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[trends:generate:error]', { message: err.message })
    await alertSistema(`[trends:generate:error] ${err.message}`)
  }
}

export function registerTrendCron(): void {
  // Every 2 hours UTC
  cron.schedule('0 */2 * * *', () => runTrendCycle(), { timezone: 'UTC' })
  log('[trends:cron:registered]', { schedule: '0 */2 * * * (every 2h UTC)' })
}
