import express from 'express'
import { commandsRouter } from './commands'
import { registerDailyCron } from './daily'
import { registerTrendCron } from './trends'
import { registerAutoPostCron, runAutoPost } from './autopost'
import { alertSistema } from './lib/telegram'
import { log } from './lib/logger'

const PORT = process.env.PORT ?? 3000

const app = express()
app.use(express.json())

app.use('/telegram', commandsRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

// Manual trigger for auto-post
app.post('/api/auto-post', async (req, res) => {
  const type = (req.body?.type === 'curiosity' ? 'curiosity' : 'news') as 'news' | 'curiosity'
  log('[api:auto-post]', { type })
  // Fire and forget — don't block the response
  runAutoPost(type).catch(e => log('[api:auto-post:error]', { message: String(e) }))
  res.json({ status: 'triggered', type })
})

app.listen(PORT, () => {
  log('[server:start]', { port: PORT })
  registerDailyCron()
  registerTrendCron()
  registerAutoPostCron()
  // Delay alert 15s: if process crashes in a loop, it dies before alerting → no Telegram spam
  setTimeout(() => {
    alertSistema('🚀 bodybasetwitter iniciado / reiniciado.').catch(() => {})
  }, 15_000)
})
