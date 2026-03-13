import cron from 'node-cron'
import { generateAutoPostDraft } from './lib/claude'
import { scoreTweet } from './lib/scorer'
import { postTweet, uploadMedia } from './lib/twitter'
import { saveTweet, getLastPostedAt } from './lib/supabase'
import { sendMessage, alertSistema } from './lib/telegram'
import { log } from './lib/logger'

const MIN_SCORE = 70
const COOLDOWN_MS = 90 * 60 * 1000 // 90 minutes between auto-posts

async function fetchImage(prompt: string): Promise<Buffer> {
  // Pollinations AI with Flux model for photorealistic quality
  const baseUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=675&nologo=true&model=flux`
  log('[autopost:image:fetch]', { prompt: prompt.slice(0, 80) })

  // Retry up to 2 times (Pollinations can be flaky)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const url = attempt === 1 ? baseUrl : `${baseUrl}&seed=${Date.now()}`
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) {
        log('[autopost:image:retry]', { attempt, status: res.status })
        if (attempt === 2) throw new Error(`[autopost:image] fetch failed: ${res.status}`)
        continue
      }

      const arrayBuffer = await res.arrayBuffer()
      if (arrayBuffer.byteLength < 5000) {
        log('[autopost:image:retry]', { attempt, reason: 'small', bytes: arrayBuffer.byteLength })
        if (attempt === 2) throw new Error(`[autopost:image] suspiciously small image: ${arrayBuffer.byteLength} bytes`)
        continue
      }
      log('[autopost:image:done]', { bytes: arrayBuffer.byteLength, attempt })
      return Buffer.from(arrayBuffer)
    } catch (e) {
      if (attempt === 2) throw e
      log('[autopost:image:retry]', { attempt, error: String(e).slice(0, 100) })
    }
  }
  throw new Error('[autopost:image] all attempts failed')
}

async function sendNotification(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID!
  await sendMessage(chatId, text)
}

export async function runAutoPost(type: 'news' | 'curiosity'): Promise<void> {
  log('[autopost:start]', { type })

  try {
    // Cooldown check — don't spam Twitter
    const lastPosted = await getLastPostedAt()
    if (lastPosted) {
      const elapsed = Date.now() - new Date(lastPosted).getTime()
      if (elapsed < COOLDOWN_MS) {
        const minutesLeft = Math.ceil((COOLDOWN_MS - elapsed) / 60000)
        log('[autopost:cooldown]', { minutesLeft })
        await sendNotification(`⏳ Auto-post adiado (cooldown ${minutesLeft}min restantes)`)
        return
      }
    }

    // Generate draft
    const draft = await generateAutoPostDraft(type)
    if (!draft.texto || draft.texto.length < 30) {
      log('[autopost:empty]', { type })
      await sendNotification(`⚠️ Auto-post falhou: draft vazio (${type})`)
      return
    }
    log('[autopost:generated]', { type, len: draft.texto.length })

    // Score it
    const scoreResult = await scoreTweet(draft.texto)
    log('[autopost:scored]', { score: scoreResult.score, compliance: scoreResult.compliance })

    // Hard block on non-compliance
    if (!scoreResult.compliance) {
      log('[autopost:blocked]', { reason: 'compliance', score: scoreResult.score })
      await sendNotification(
        `🚫 Auto-post BLOQUEADO (compliance)\n\n` +
        `Tipo: ${type === 'news' ? '📰 Notícias' : '🔬 Curiosidade'}\n` +
        `Score: ${scoreResult.score}/100\n` +
        `Motivo: ${scoreResult.reason}\n\n` +
        `<i>${draft.texto.slice(0, 200)}</i>`
      )
      return
    }

    // Skip low-scoring drafts
    if (scoreResult.score < MIN_SCORE) {
      log('[autopost:skipped]', { score: scoreResult.score })
      await sendNotification(
        `⏭ Auto-post descartado (score ${scoreResult.score}/100)\n\n` +
        `Tipo: ${type === 'news' ? '📰 Notícias' : '🔬 Curiosidade'}\n` +
        `Motivo: ${scoreResult.reason}\n\n` +
        `<i>${draft.texto.slice(0, 200)}</i>`
      )
      return
    }

    // Generate and upload image
    let mediaId: string | undefined
    try {
      const imageBuffer = await fetchImage(draft.imagePrompt)
      mediaId = await uploadMedia(imageBuffer, 'image/jpeg')
      log('[autopost:image:uploaded]', { mediaId })
    } catch (imgErr) {
      // Image failure is non-fatal — post without image
      log('[autopost:image:error]', { message: imgErr instanceof Error ? imgErr.message : String(imgErr) })
    }

    // Post!
    const tweetId = await postTweet(draft.texto, mediaId)
    await saveTweet(tweetId, draft.texto, mediaId ? 'image' : 'text')

    const typeLabel = type === 'news' ? '📰 Notícias científicas' : '🔬 Curiosidade'
    const imageLabel = mediaId ? '🖼 com imagem' : '📝 sem imagem'
    await sendNotification(
      `✅ Auto-post publicado!\n\n` +
      `${typeLabel} · ${imageLabel}\n` +
      `Score: ${scoreResult.score}/100\n\n` +
      `${draft.texto}\n\n` +
      `https://twitter.com/bodybasehealth/status/${tweetId}`
    )

    log('[autopost:done]', { tweetId, type, score: scoreResult.score, hasImage: !!mediaId })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[autopost:error]', { type, message: err.message, stack: err.stack })
    await alertSistema(`[autopost:error] ${type}: ${err.message}`)
  }
}

export function registerAutoPostCron(): void {
  // 12:30 UTC = 09:30 BRT — morning science news
  cron.schedule('30 12 * * *', () => runAutoPost('news'), { timezone: 'UTC' })
  // 19:30 UTC = 16:30 BRT — afternoon curiosities
  cron.schedule('30 19 * * *', () => runAutoPost('curiosity'), { timezone: 'UTC' })
  log('[autopost:cron:registered]', {
    schedules: ['09:30 BRT (news)', '16:30 BRT (curiosity)'],
  })
}
