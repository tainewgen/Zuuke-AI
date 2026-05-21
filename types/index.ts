export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
}

export interface Chat {
  id: string
  title: string
  timestamp: Date
  messages: Message[]
}

export interface UserStatus {
  name: string
  plan: 'free' | 'pro'
  messagesUsed: number
  messagesLimit: number
}
