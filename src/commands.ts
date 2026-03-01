import { Router, Request, Response } from 'express'
import { TelegramUpdate, CommandRoute } from './types'
import { getFilePath, downloadFile, sendMessage, confirm, alertSistema } from './lib/telegram'
import { uploadMedia, postTweet } from './lib/twitter'
import { getDraft, saveTweet, updateDraft } from './lib/supabase'
import { chat } from './lib/claude'
import { runDaily } from './daily'
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

  // "gera"
  if (/^gera$/i.test(text)) {
    return { type: 'gera' }
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

  const chatId = msg.chat.id
  const today = new Date().toISOString().split('T')[0]
  const route = parseRoute(msg)
  log('[cmd:received]', { route: route.type, chatId })

  // Respond 200 immediately so Telegram doesn't retry
  res.sendStatus(200)

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

        const tweetId = await postTweet(draft.texto, mediaId)
        log('[cmd:tweet]', { tweetId })

        await saveTweet(tweetId, draft.texto, 'image')
        await confirm(chatId, tweetId)
        log('[cmd:confirm]', { tweetId })
        break
      }

      case 'text_approve': {
        const draft = await getDraft(route.num, today)
        log('[cmd:draft]', { num: route.num, texto: draft.texto.slice(0, 50) })

        const tweetId = await postTweet(draft.texto)
        log('[cmd:tweet]', { tweetId })

        await saveTweet(tweetId, draft.texto, 'text')
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
        log('[cmd:gera:start]')
        await runDaily()
        log('[cmd:gera:done]')
        break
      }

      case 'unknown': {
        const userText = msg.text?.trim()
        if (userText) {
          log('[cmd:chat]', { text: userText.slice(0, 50) })
          const reply = await chat(userText)
          await sendMessage(chatId, reply)
        }
        break
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    log('[cmd:error]', { route: route.type, message: err.message })
    await alertSistema(`cmd:${route.type} → ${err.message}`)
  }
})
