import { Router, Request, Response } from 'express'
import { TelegramUpdate } from './types'
import { getFilePath, downloadFile, sendMessage, confirm, alertSistema } from './lib/telegram'
import { uploadMedia, postTweet, postThread, postPoll } from './lib/twitter'
import { getDraft, saveTweet, updateDraft, getTopTrends } from './lib/supabase'
import { scoreTweet } from './lib/scorer'
import { runDaily } from './daily'
import { setAutoPublish, isAutoPublishEnabled, runTrendCycle } from './trends'
import { processMessage, resetSession } from './lib/agent'
import { log } from './lib/logger'

export const commandsRouter = Router()

commandsRouter.post('/webhook', async (req: Request, res: Response) => {
  const update = req.body as TelegramUpdate

  const msg = update.message
  if (!msg) {
    res.sendStatus(200)
    return
  }

  // Guard 1: secret token
  const secretToken = process.env.TELEGRAM_SECRET_TOKEN
  if (secretToken) {
    const incoming = req.headers['x-telegram-bot-api-secret-token']
    if (incoming !== secretToken) {
      res.sendStatus(200)
      return
    }
  }

  // Guard 2: chat ID
  const allowedChatId = parseInt(process.env.TELEGRAM_CHAT_ID!)
  if (msg.chat.id !== allowedChatId) {
    res.sendStatus(200)
    return
  }

  const chatId = msg.chat.id
  const today = new Date().toISOString().split('T')[0]

  // Respond 200 immediately so Telegram doesn't retry
  res.sendStatus(200)

  let tweetId: string | null = null

  try {
    // Photo with caption → always treated as photo approval
    if (msg.photo && msg.caption) {
      const numMatch = msg.caption.trim().match(/\d+/)
      const num = numMatch ? parseInt(numMatch[0], 10) : 1

      const lastPhoto = msg.photo[msg.photo.length - 1]
      const filePath = await getFilePath(lastPhoto.file_id)
      const buffer = await downloadFile(filePath)
      const ext = filePath.split('.').pop() ?? 'jpg'
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
      const mediaId = await uploadMedia(buffer, mimeType)
      const draft = await getDraft(num, today)
      tweetId = await postTweet(draft.texto, mediaId)
      await saveTweet(tweetId, draft.texto, 'image')
      await confirm(chatId, tweetId)
      log('[cmd:photo_approve]', { num, tweetId })
      return
    }

    const text = msg.text?.trim()
    if (!text) return

    log('[agent:incoming]', { text: text.slice(0, 80) })
    const result = await processMessage(text)

    if (result.type === 'reply') {
      const truncated = result.text.length > 4000
        ? result.text.slice(0, 4000) + '\n\n…(truncado)'
        : result.text
      await sendMessage(chatId, truncated)
      return
    }

    // Execute action
    const { data } = result

    switch (data.action) {
      case 'approve': {
        const draft = await getDraft(data.params.num, today)
        log('[cmd:approve]', { num: data.params.num, format: draft.format })

        if (draft.format === 'thread') {
          const tweets = draft.texto.split('\n---\n').filter(t => t.trim())
          tweetId = await postThread(tweets)
          await saveTweet(tweetId, draft.texto, 'thread')
        } else if (draft.format === 'poll') {
          const [question, optionsBlock] = draft.texto.split('\n---opcoes---\n')
          const options = (optionsBlock ?? '').trim().split('\n').filter(Boolean)
          tweetId = await postPoll(question.trim(), options)
          await saveTweet(tweetId, draft.texto, 'poll')
        } else {
          tweetId = await postTweet(draft.texto)
          await saveTweet(tweetId, draft.texto, draft.format)
        }

        await confirm(chatId, tweetId)
        log('[cmd:approve:done]', { tweetId })
        break
      }

      case 'edit': {
        await updateDraft(data.params.num, data.params.text, today)
        await sendMessage(chatId, `✏️ Draft ${data.params.num} atualizado:\n\n${data.params.text}`)
        log('[cmd:edit]', { num: data.params.num })
        break
      }

      case 'ignore': {
        await sendMessage(chatId, '❌ Rascunhos de hoje descartados.')
        log('[cmd:ignore]')
        break
      }

      case 'generate': {
        await sendMessage(chatId, '⏳ Gerando rascunhos...')
        log('[cmd:generate:start]')
        await runDaily()
        log('[cmd:generate:done]')
        break
      }

      case 'refresh_trends': {
        await sendMessage(chatId, '🔄 Buscando trends agora em todas as fontes...')
        log('[cmd:refresh_trends:start]')
        await runTrendCycle()
        log('[cmd:refresh_trends:done]')
        break
      }

      case 'trends': {
        const trends = await getTopTrends(3)
        if (trends.length === 0) {
          await sendMessage(chatId, '📊 Nenhuma trend detectada ainda. Aguarde o próximo ciclo (a cada 2h).')
        } else {
          const lines = trends.map((t, i) =>
            `${i + 1}. [${t.trend_type}/${t.source}] ${t.title}\n` +
            `   Relevância: ${t.relevance_score} | ${t.detected_at.slice(0, 16).replace('T', ' ')}`
          )
          await sendMessage(chatId, `🔍 <b>Top Trends — Nicho Longevidade</b>\n\n${lines.join('\n\n')}`)
        }
        log('[cmd:trends]')
        break
      }

      case 'auto_on': {
        setAutoPublish(true)
        await sendMessage(chatId, `🟢 <b>Auto-publish ATIVADO</b>\nTweets com score ≥ 80 serão publicados automaticamente. Cooldown: 90min.`)
        log('[cmd:auto_on]')
        break
      }

      case 'auto_off': {
        setAutoPublish(false)
        await sendMessage(chatId, '🔴 <b>Auto-publish DESATIVADO</b>\nModo dry-run ativo.')
        log('[cmd:auto_off]')
        break
      }

      case 'score': {
        const draft = await getDraft(data.params.num, today)
        const scored = await scoreTweet(draft.texto)
        const decision = isAutoPublishEnabled()
          ? (scored.score >= 80 ? '🚀 publicaria automaticamente' : scored.score >= 60 ? '📩 enviaria para aprovação' : '🗑 descartaria')
          : '🧪 dry-run ativo'
        await sendMessage(chatId,
          `📊 <b>Score do Draft ${data.params.num}</b>: ${scored.score}/100\n\n` +
          `Compliance ANVISA/CFM: ${scored.compliance ? '✅' : '❌'}\n` +
          `Decisão: ${decision}\n` +
          `Motivo: ${scored.reason}\n\n` +
          `<b>Breakdown:</b>\n` +
          `• Compliance: ${scored.breakdown.compliance}/25\n` +
          `• Qualidade editorial: ${scored.breakdown.quality}/25\n` +
          `• Potencial de engajamento: ${scored.breakdown.engagement}/25\n` +
          `• Relevância/timing: ${scored.breakdown.timing}/25`
        )
        log('[cmd:score]', { num: data.params.num, score: scored.score })
        break
      }

      case 'reset_chat': {
        resetSession()
        await sendMessage(chatId, '🧹 Histórico da conversa limpo.')
        log('[cmd:reset_chat]')
        break
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[cmd:error]', { message: err.message, tweetId })
    if (tweetId) {
      await alertSistema(`⚠️ TWEET ÓRFÃO: postado no Twitter (ID: ${tweetId}), mas falhou ao salvar → ${err.message}`)
    } else {
      await alertSistema(`cmd:error → ${err.message}`)
    }
  }
})
