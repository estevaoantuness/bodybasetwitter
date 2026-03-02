import { TwitterApi } from 'twitter-api-v2'
import { TweetPerformance } from '../types'
import { log } from './logger'

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
})

export async function fetchTweetMetrics(tweetIds: string[]): Promise<TweetPerformance[]> {
  if (tweetIds.length === 0) return []

  try {
    const res = await client.v2.tweets(tweetIds, {
      'tweet.fields': ['public_metrics'],
    })
    if (!res.data) return []

    const now = new Date().toISOString()
    return res.data.map(tweet => {
      const m = (tweet.public_metrics ?? {}) as Record<string, number>
      const impressions = m['impression_count'] ?? 0
      const likes = m['like_count'] ?? 0
      const retweets = m['retweet_count'] ?? 0
      const replies = m['reply_count'] ?? 0
      const bookmarks = m['bookmark_count'] ?? 0
      // X 2026 algorithm weights: RT=20x, Reply=13.5x, Bookmark=10x, Like=1x
      const weighted = (retweets * 20) + (replies * 13.5) + (bookmarks * 10) + likes
      const engagement_rate = impressions > 0 ? weighted / impressions : 0

      return { tweet_id: tweet.id, checked_at: now, impressions, likes, retweets, replies, bookmarks, engagement_rate }
    })
  } catch (e) {
    // Analytics are best-effort: API tier may not support these endpoints
    log('[analytics:fetchMetrics:error]', { message: e instanceof Error ? e.message : String(e) })
    return []
  }
}

export function formatPerformanceInsights(metrics: TweetPerformance[]): string {
  if (metrics.length === 0) return ''

  const sorted = [...metrics].sort((a, b) => b.engagement_rate - a.engagement_rate)
  const best = sorted[0]
  const avg = metrics.reduce((s, m) => s + m.engagement_rate, 0) / metrics.length

  const lines = [
    `\n\nINSIGHTS DE PERFORMANCE (últimos ${metrics.length} tweets — calibre formato e estilo com base nisso):`,
    `- Engajamento médio ponderado: ${avg.toFixed(2)} (RT×20 + reply×13.5 + bookmark×10 + like) / impressões`,
    `- Melhor resultado: ${best.retweets} RTs | ${best.replies} replies | ${best.bookmarks} bookmarks | ${best.impressions} impressões`,
  ]

  const bookmarkDominated = metrics.filter(m => m.bookmarks > m.retweets * 2).length
  const replyDominated = metrics.filter(m => m.replies > m.retweets).length

  if (bookmarkDominated > metrics.length / 3) {
    lines.push('- Tendência: conteúdo técnico denso gera mais bookmarks. Priorize threads educacionais densas.')
  }
  if (replyDominated > metrics.length / 3) {
    lines.push('- Tendência: perguntas e posições calibradas geram mais debate. Considere mais conteúdo de Conexão.')
  }

  return lines.join('\n')
}
