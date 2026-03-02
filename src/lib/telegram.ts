import { log } from './logger'

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendMessage(chatId: number | string, text: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[telegram:sendMessage] ${res.status} ${err}`)
  }
  log('[telegram:sendMessage]', { chatId })
}

export async function alertSistema(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID!
  await sendMessage(chatId, `🚨 <b>bodybasetwitter alert</b>\n\n${message}`)
}

export async function sendDrafts(
  drafts: Array<{ num: number; texto: string; format: string }>,
  slot?: 'morning' | 'evening'
): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID!
  const header = slot === 'morning' ? '🌅 <b>Rascunhos da manhã</b>'
    : slot === 'evening' ? '🌆 <b>Rascunhos da tarde</b>'
    : '📝 <b>Novos rascunhos</b>'
  await sendMessage(chatId, header)
  for (const draft of drafts) {
    let formatTag: string
    let preview: string

    if (draft.format === 'thread') {
      const tweets = draft.texto.split('\n---\n').filter(t => t.trim())
      const hook = tweets[0] ?? ''
      formatTag = `🧵 [thread · ${tweets.length} tweets]`
      preview = `<b>Hook:</b>\n${hook}\n\n<i>+ ${tweets.length - 1} tweets na thread</i>`
    } else if (draft.format === 'poll') {
      const [question, optionsBlock] = draft.texto.split('\n---opcoes---\n')
      const options = (optionsBlock ?? '').trim().split('\n').filter(Boolean)
      formatTag = '📊 [poll]'
      preview = `<b>Pergunta:</b> ${question}\n${options.map(o => `• ${o}`).join('\n')}`
    } else if (draft.format === 'image') {
      formatTag = '🖼 [com imagem]'
      preview = draft.texto
    } else {
      formatTag = '📝 [texto]'
      preview = draft.texto
    }

    const msg = `${formatTag} <b>Draft ${draft.num}</b>\n\n${preview}\n\n` +
      `Para aprovar: <code>aprova ${draft.num}</code>\n` +
      `Para aprovar com foto: envie a foto com caption <code>aprova ${draft.num}</code>\n` +
      `Para editar: <code>edita ${draft.num}: novo texto aqui</code>`
    await sendMessage(chatId, msg)
  }
}

export async function confirm(chatId: number | string, tweetId: string): Promise<void> {
  await sendMessage(chatId, `✅ Tweet postado!\nhttps://twitter.com/bodybasehealth/status/${tweetId}`)
}

export async function getFilePath(fileId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/getFile?file_id=${fileId}`)
  if (!res.ok) {
    throw new Error(`[telegram:getFilePath] ${res.status}`)
  }
  const data = (await res.json()) as { ok: boolean; result?: { file_path: string }; description?: string }
  if (!data.ok || !data.result) {
    throw new Error(`[telegram:getFilePath] api error: ${data.description ?? 'unknown'}`)
  }
  log('[telegram:getFilePath]', { file_path: data.result.file_path })
  return data.result.file_path
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  const url = `${BASE_URL.replace('/bot', '/file/bot')}/${filePath}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`[telegram:downloadFile] ${res.status}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  log('[telegram:downloadFile]', { bytes: arrayBuffer.byteLength })
  return Buffer.from(arrayBuffer)
}
