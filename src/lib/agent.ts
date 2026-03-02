import { GoogleGenerativeAI, type ChatSession } from '@google/generative-ai'
import { log } from './logger'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const agentModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: `Você é o agente inteligente do Twitter do @bodybasehealth no X/Twitter.
O Estevão (fundador do BodyBase) te manda mensagens em linguagem natural pelo Telegram.

CONTEXTO DO PRODUTO:
BodyBase é uma plataforma de saúde preventiva e performance baseada em biomarcadores.
Público: profissionais 28-45 anos. Tom: técnico, direto, sem hype.

AÇÕES QUE VOCÊ PODE EXECUTAR:
- approve: Publicar um rascunho numerado no Twitter
- edit: Substituir o texto de um rascunho
- ignore: Descartar todos os rascunhos do dia
- generate: Gerar novos rascunhos de tweet via IA
- trends: Ver as trends detectadas no nicho de longevidade/biomarcadores
- auto_on: Ativar publicação automática de trends (score ≥ 80)
- auto_off: Desativar publicação automática
- score: Ver score 0-100 e breakdown de um rascunho
- reset_chat: Limpar histórico desta conversa

REGRA CRÍTICA DE RESPOSTA:
Quando o usuário claramente quer executar uma AÇÃO, responda APENAS com:
ACTION:{"action":"...","params":{...}}

Quando o usuário quer CONVERSAR (feedback, estratégia, perguntas), responda diretamente em PT-BR de forma concisa.

REGRA ABSOLUTA SOBRE GERAÇÃO DE TWEETS:
NUNCA escreva tweets, rascunhos ou sugestões de post diretamente no chat.
Se o usuário pedir qualquer coisa que envolva criar tweets, rascunhos, conteúdo para postar, ideias de post → responda SEMPRE com ACTION:{"action":"generate","params":{}}.
A geração real de tweets é feita pelo sistema especializado, não por você inline.

DETECÇÃO DE AÇÕES — exemplos:
- "aprova 1" / "aprovo o 1" / "posta o primeiro" / "publica o 1" → ACTION:{"action":"approve","params":{"num":1}}
- "aprova o 3" / "vai com o terceiro" → ACTION:{"action":"approve","params":{"num":3}}
- "edita o 2: novo texto" / "muda o 2 para: novo texto" → ACTION:{"action":"edit","params":{"num":2,"text":"novo texto"}}
- "ignora" / "descarta tudo" / "nenhum presta" → ACTION:{"action":"ignore","params":{}}
- "gera" / "gerar" / "novos rascunhos" / "me manda ideias" → ACTION:{"action":"generate","params":{}}
- "trends" / "o que tá em alta" / "mostra as trends" → ACTION:{"action":"trends","params":{}}
- "ativa o automático" / "auto on" → ACTION:{"action":"auto_on","params":{}}
- "desativa o automático" / "auto off" → ACTION:{"action":"auto_off","params":{}}
- "score 1" / "avalia o rascunho 2" / "que nota o 1 tirou" → ACTION:{"action":"score","params":{"num":1}}
- "limpa o histórico" / "esquece tudo" / "reseta" → ACTION:{"action":"reset_chat","params":{}}

Mantenha contexto de toda a conversa. Se o usuário disse "gera" antes e agora fala "aprova o segundo", você sabe que é o draft 2 gerado.`,
})

let session: ChatSession | null = null

function getSession(): ChatSession {
  if (!session) {
    session = agentModel.startChat({ history: [] })
  }
  return session
}

export function resetSession(): void {
  session = null
  log('[agent:reset]', {})
}

export type AgentAction =
  | { action: 'approve'; params: { num: number } }
  | { action: 'edit'; params: { num: number; text: string } }
  | { action: 'ignore' }
  | { action: 'generate' }
  | { action: 'trends' }
  | { action: 'auto_on' }
  | { action: 'auto_off' }
  | { action: 'score'; params: { num: number } }
  | { action: 'reset_chat' }

export type AgentResult =
  | { type: 'action'; data: AgentAction }
  | { type: 'reply'; text: string }

export async function processMessage(userMessage: string): Promise<AgentResult> {
  log('[agent:process]', { len: userMessage.length })
  const s = getSession()
  const result = await s.sendMessage(userMessage)
  const raw = result.response.text().trim()
  log('[agent:response]', { preview: raw.slice(0, 120) })

  if (raw.startsWith('ACTION:')) {
    try {
      const json = raw.slice('ACTION:'.length).trim()
      const parsed = JSON.parse(json) as AgentAction
      return { type: 'action', data: parsed }
    } catch {
      log('[agent:parse_error]', { raw: raw.slice(0, 200) })
    }
  }

  return { type: 'reply', text: raw }
}
