export const dynamic = 'force-dynamic'

import { getUserFromRequest, checkMessageLimit } from '@/lib/auth'
import { getAnthropicClient, getSystemPrompt } from '@/lib/anthropic'

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)

  // Authenticated users: enforce daily message limit
  if (user) {
    const { allowed } = await checkMessageLimit(user.id)
    if (!allowed) {
      return Response.json(
        { error: 'limit_reached', message: "You've used all 10 free messages today. Upgrade to Pro for unlimited access." },
        { status: 429 }
      )
    }
  }
  // Guest users (no auth token): allowed through — client enforces 5-message session limit

  const { messages } = await request.json()
  if (!messages?.length) {
    return Response.json({ error: 'messages required' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const anthropicStream = getAnthropicClient().messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: [{ type: 'text', text: getSystemPrompt(), cache_control: { type: 'ephemeral' } }],
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        })

        anthropicStream.on('text', (text) => send('token', { text }))
        anthropicStream.on('finalMessage', () => {
          send('done', {})
          controller.close()
        })
        anthropicStream.on('error', () => {
          send('error', { message: 'Stream error. Please try again.' })
          controller.close()
        })
      } catch {
        send('error', { message: 'Failed to get a response.' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
