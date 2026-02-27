import express from 'express'
import { commandsRouter } from './commands'
import { registerDailyCron } from './daily'
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
})
