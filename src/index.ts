import express from 'express'
import { commandsRouter } from './commands'
import { registerDailyCron } from './daily'
import { alertSistema } from './lib/telegram'
import { log } from './lib/logger'

const PORT = process.env.PORT ?? 3000

const app = express()
app.use(express.json())

app.use('/telegram', commandsRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

app.listen(PORT, () => {
  log('[server:start]', { port: PORT })
  registerDailyCron()
  // Delay alert 15s: if process crashes in a loop, it dies before alerting → no Telegram spam
  setTimeout(() => {
    alertSistema('🚀 bodybasetwitter iniciado / reiniciado.').catch(() => {})
  }, 15_000)
})
