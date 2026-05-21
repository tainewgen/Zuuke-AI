export const dynamic = 'force-dynamic'

import { getUserFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import Stripe from 'stripe'

const APP_URL = process.env.APP_URL || 'http://localhost:3000'

export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id as string | undefined

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Zuuke Pro',
              description: 'Unlimited AI PC build recommendations',
            },
            unit_amount: 500,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/chat?upgraded=true`,
      cancel_url: `${APP_URL}/chat`,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    console.error('Stripe error:', (err as Error).message)
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
