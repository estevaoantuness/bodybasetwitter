import { TwitterApi } from 'twitter-api-v2'
import { log } from './logger'

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
})

export async function postTweet(text: string, mediaId?: string): Promise<string> {
  const params: Parameters<typeof client.v2.tweet>[0] = { text }
  if (mediaId) {
    params.media = { media_ids: [mediaId] }
  }
  const result = await client.v2.tweet(params)
  log('[twitter:postTweet]', { tweet_id: result.data.id })
  return result.data.id
}

export async function postThread(tweets: string[]): Promise<string> {
  let lastId: string | undefined
  let firstId = ''
  for (const text of tweets) {
    const params: Parameters<typeof client.v2.tweet>[0] = { text }
    if (lastId) {
      params.reply = { in_reply_to_tweet_id: lastId }
    }
    const result = await client.v2.tweet(params)
    if (!firstId) firstId = result.data.id
    lastId = result.data.id
    log('[twitter:postThread:tweet]', { tweet_id: result.data.id })
  }
  log('[twitter:postThread:done]', { first_id: firstId, count: tweets.length })
  return firstId
}

export async function postPoll(question: string, options: string[]): Promise<string> {
  const result = await client.v2.tweet({
    text: question,
    poll: { options: options.slice(0, 4), duration_minutes: 1440 },
  })
  log('[twitter:postPoll]', { tweet_id: result.data.id })
  return result.data.id
}

export async function uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
  const mediaId = await client.v1.uploadMedia(buffer, { mimeType })
  log('[twitter:uploadMedia]', { mediaId })
  return mediaId
}
