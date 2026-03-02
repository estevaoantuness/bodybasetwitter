export interface Draft {
  num: number
  texto: string
  format: 'text' | 'image' | 'thread' | 'poll'
  date: string // YYYY-MM-DD
}

export interface PostedTweet {
  tweet_id: string
  texto: string
  format: string
  posted_at: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  from?: { id: number; username?: string }
  chat: { id: number }
  message_thread_id?: number
  text?: string
  photo?: TelegramPhotoSize[]
  caption?: string
  date: number
}

export interface TelegramPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

export interface TrendItem {
  id?: string
  source: 'reddit' | 'biorxiv' | 'perplexity' | 'pubmed'
  trend_type: 'velocity' | 'context'
  title: string
  url?: string
  relevance_score: number
  detected_at: string
  used: boolean
}

export interface TweetPerformance {
  tweet_id: string
  checked_at: string
  impressions: number
  likes: number
  retweets: number
  replies: number
  bookmarks: number
  engagement_rate: number
}

export type CommandRoute =
  | { type: 'photo_approve'; num: number; fileId: string }
  | { type: 'text_approve'; num: number }
  | { type: 'edit'; num: number; newText: string }
  | { type: 'ignore' }
  | { type: 'gera' }
  | { type: 'trends' }
  | { type: 'auto_on' }
  | { type: 'auto_off' }
  | { type: 'score'; num: number }
  | { type: 'limpar' }
  | { type: 'unknown' }
