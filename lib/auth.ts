import { createServerClient } from './supabase'
import type { User } from '@supabase/supabase-js'

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return error ? null : user
}

const FREE_LIMIT = 10

export async function checkMessageLimit(userId: string): Promise<{
  allowed: boolean
  isPro: boolean
  count: number
}> {
  const supabase = createServerClient()
  const today = new Date().toISOString().split('T')[0]

  let { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, message_count_today, last_message_date')
    .eq('id', userId)
    .single()

  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({ id: userId, subscription_status: 'free', message_count_today: 0 })
      .select()
      .single()
    profile = newProfile
  }

  if (!profile) return { allowed: false, isPro: false, count: 0 }

  if (profile.subscription_status === 'pro') {
    return { allowed: true, isPro: true, count: 0 }
  }

  const count = profile.last_message_date === today ? (profile.message_count_today || 0) : 0

  if (count >= FREE_LIMIT) {
    return { allowed: false, isPro: false, count }
  }

  await supabase
    .from('profiles')
    .update({ message_count_today: count + 1, last_message_date: today })
    .eq('id', userId)

  return { allowed: true, isPro: false, count: count + 1 }
}

export { FREE_LIMIT }
