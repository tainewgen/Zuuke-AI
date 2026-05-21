export const dynamic = 'force-dynamic'

import { getUserFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { FREE_LIMIT } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const today = new Date().toISOString().split('T')[0]

  let { data: profile } = await supabase
    .from('profiles')
    .select('first_name, subscription_status, message_count_today, last_message_date')
    .eq('id', user.id)
    .single()

  if (!profile) {
    await supabase.from('profiles').insert({ id: user.id, subscription_status: 'free', message_count_today: 0 })
    profile = { first_name: '', subscription_status: 'free', message_count_today: 0, last_message_date: null }
  }

  const count = profile?.last_message_date === today ? (profile?.message_count_today || 0) : 0
  const name =
    profile?.first_name ||
    (user.user_metadata as Record<string, string>)?.first_name ||
    user.email?.split('@')[0] ||
    'User'

  return Response.json({
    name,
    plan: profile?.subscription_status || 'free',
    messagesUsed: count,
    messagesLimit: FREE_LIMIT,
  })
}
