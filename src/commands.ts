import { Router, Request, Response } from 'express'
import { TelegramUpdate, CommandRoute } from './types'
import { getFilePath, downloadFile, sendMessage, confirm, alertSistema } from './lib/telegram'
import { uploadMedia, postTweet, postThread, postPoll } from './lib/twitter'
import { getDraft, saveTweet, updateDraft, getTopTrends } from './lib/supabase'
import { chat, resetChat } from './lib/claude'
import { scoreTweet } from './lib/scorer'
import { runDaily } from './daily'
import { setAutoPublish, isAutoPublishEnabled } from './trends'
import { log } from './lib/logger'

export const commandsRouter = Router()

function parseRoute(msg: NonNullable<TelegramUpdate['message']>): CommandRoute {
  // Photo with caption "aprova N"
  if (msg.photo && msg.caption) {
    const match = msg.caption.trim().match(/^aprova\s+(\d+)$/i)
    if (match) {
      const lastPhoto = msg.photo[msg.photo.length - 1]
      return { type: 'photo_approve', num: parseInt(match[1], 10), fileId: lastPhoto.file_id }
    }
  }

  const text = msg.text?.trim() ?? ''

  // "aprova N"
  const approveMatch = text.match(/^aprova\s+(\d+)$/i)
  if (approveMatch) {
    return { type: 'text_approve', num: parseInt(approveMatch[1], 10) }
  }

  // "edita N: novo texto"
  const editMatch = text.match(/^edita\s+(\d+):\s*(.+)$/is)
  if (editMatch) {
    return { type: 'edit', num: parseInt(editMatch[1], 10), newText: editMatch[2].trim() }
  }

  // "ignore"
  if (/^ignore$/i.test(text)) {
    return { type: 'ignore' }
  }

  // "gera" / "gerar"
  if (/^gerar?$/i.test(text)) {
    return { type: 'gera' }
  }

  // "limpar" — reset chat history
  if (/^limpar$/i.test(text)) {
    return { type: 'limpar' }
  }

  // "trends"
  if (/^trends$/i.test(text)) {
    return { type: 'trends' }
  }

  // "auto on" / "auto off"
  const autoMatch = text.match(/^auto\s+(on|off)$/i)
  if (autoMatch) {
    return autoMatch[1].toLowerCase() === 'on' ? { type: 'auto_on' } : { type: 'auto_off' }
  }

  // "score N"
  const scoreMatch = text.match(/^score\s+(\d+)$/i)
  if (scoreMatch) {
    return { type: 'score', num: parseInt(scoreMatch[1], 10) }
  }

  return { type: 'unknown' }
}

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
  const route = parseRoute(msg)
  log('[cmd:received]', { route: route.type, chatId })

  // Respond 200 immediately so Telegram doesn't retry
  res.sendStatus(200)

  // tweetId declared here so catch can detect orphan tweets
  let tweetId: string | null = null

  try {
    switch (route.type) {
      case 'photo_approve': {
        const filePath = await getFilePath(route.fileId)
        log('[cmd:file]', { filePath })

        const buffer = await downloadFile(filePath)
        log('[cmd:download]', { bytes: buffer.length })

        const ext = filePath.split('.').pop() ?? 'jpg'
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
        const mediaId = await uploadMedia(buffer, mimeType)
        log('[cmd:media]', { mediaId })

        const draft = await getDraft(route.num, today)
        log('[cmd:draft]', { num: route.num, texto: draft.texto.slice(0, 50) })

        tweetId = await postTweet(draft.texto, mediaId)
        log('[cmd:tweet]', { tweetId })

        await saveTweet(tweetId, draft.texto, 'image')
        await confirm(chatId, tweetId)
        log('[cmd:confirm]', { tweetId })
        break
      }

      case 'text_approve': {
        const draft = await getDraft(route.num, today)
        log('[cmd:draft]', { num: route.num, format: draft.format, texto: draft.texto.slice(0, 50) })

        if (draft.format === 'thread') {
          const tweets = draft.texto.split('\n---\n').filter(t => t.trim())
          tweetId = await postThread(tweets)
          log('[cmd:thread]', { tweetId, count: tweets.length })
          await saveTweet(tweetId, draft.texto, 'thread')
        } else if (draft.format === 'poll') {
          const [question, optionsBlock] = draft.texto.split('\n---opcoes---\n')
          const options = (optionsBlock ?? '').trim().split('\n').filter(Boolean)
          tweetId = await postPoll(question.trim(), options)
          log('[cmd:poll]', { tweetId })
          await saveTweet(tweetId, draft.texto, 'poll')
        } else {
          tweetId = await postTweet(draft.texto)
          log('[cmd:tweet]', { tweetId })
          await saveTweet(tweetId, draft.texto, draft.format)
        }

        await confirm(chatId, tweetId)
        log('[cmd:confirm]', { tweetId })
        break
      }

      case 'edit': {
        await updateDraft(route.num, route.newText, today)
        await sendMessage(chatId, `✏️ Draft ${route.num} atualizado:\n\n${route.newText}`)
        log('[cmd:edit]', { num: route.num })
        break
      }

      case 'ignore': {
        await sendMessage(chatId, '❌ Rascunhos de hoje descartados.')
        log('[cmd:ignore]')
        break
      }

      case 'gera': {
        await sendMessage(chatId, '⏳ Gerando rascunhos...')
        log('[cmd:gera:start]', {})
        await runDaily()
        log('[cmd:gera:done]')
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
        log('[cmd:trends]', {})
        break
      }

      case 'auto_on': {
        setAutoPublish(true)
        await sendMessage(
          chatId,
          `🟢 <b>Auto-publish ATIVADO</b>\nTweets com score ≥ 80 e compliance OK serão publicados automaticamente.\nCooldown: 90 min entre posts.`
        )
        log('[cmd:auto_on]', {})
        break
      }

      case 'auto_off': {
        setAutoPublish(false)
        await sendMessage(chatId, '🔴 <b>Auto-publish DESATIVADO</b>\nModo dry-run ativo — nenhum tweet será publicado automaticamente.')
        log('[cmd:auto_off]', {})
        break
      }

      case 'score': {
        const draft = await getDraft(route.num, today)
        const result = await scoreTweet(draft.texto)
        const statusEmoji = isAutoPublishEnabled()
          ? (result.score >= 80 ? '🚀 publicaria automaticamente' : result.score >= 60 ? '📩 enviaria para aprovação' : '🗑 descartaria')
          : '🧪 dry-run ativo'
        const msg =
          `📊 <b>Score do Draft ${route.num}</b>: ${result.score}/100\n\n` +
          `Compliance ANVISA/CFM: ${result.compliance ? '✅' : '❌'}\n` +
          `Decisão: ${statusEmoji}\n` +
          `Motivo: ${result.reason}\n\n` +
          `<b>Breakdown:</b>\n` +
          `• Compliance: ${result.breakdown.compliance}/25\n` +
          `• Qualidade editorial: ${result.breakdown.quality}/25\n` +
          `• Potencial de engajamento: ${result.breakdown.engagement}/25\n` +
          `• Relevância/timing: ${result.breakdown.timing}/25`
        await sendMessage(chatId, msg)
        log('[cmd:score]', { num: route.num, score: result.score })
        break
      }

      case 'limpar': {
        resetChat()
        await sendMessage(chatId, '🧹 Histórico da conversa limpo.')
        log('[cmd:limpar]', {})
        break
      }

      case 'unknown': {
        const userText = msg.text?.trim()
        if (userText) {
          log('[cmd:chat]', { text: userText.slice(0, 50) })
          const reply = await chat(userText)
          const truncated = reply.length > 4000 ? reply.slice(0, 4000) + '\n\n…(resposta truncada)' : reply
          await sendMessage(chatId, truncated)
        }
        break
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[cmd:error]', { route: route.type, message: err.message, tweetId })
    if (tweetId) {
      await alertSistema(`⚠️ TWEET ÓRFÃO: postado no Twitter (ID: ${tweetId}), mas falhou ao salvar no Supabase → ${err.message}`)
    } else {
      await alertSistema(`cmd:${route.type} → ${err.message}`)
    }
  }
})
