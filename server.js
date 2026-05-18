require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const Stripe = require('stripe');
const path = require('path');

const app = express();

// Raw body needed for Stripe webhook signature verification
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static(__dirname));

// ── Clients ──
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

const FREE_LIMIT = 10;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function getSystemPrompt() {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return `You are Zuuke, an expert PC building assistant. Today's date is ${today}.

Your sole focus is helping users spec, build, upgrade, and optimize PCs. You have deep knowledge of:
- All current and recent CPUs (Intel Core, AMD Ryzen), GPUs (NVIDIA RTX, AMD RX), motherboards, RAM, storage, PSUs, cases, cooling
- Compatibility rules: socket types, chipset support, RAM compatibility, PCIe versions, TDP vs PSU headroom
- Bottleneck analysis: balancing CPU and GPU for a given resolution and use case
- Use-case optimization: gaming (1080p/1440p/4K), video editing (Premiere Pro, DaVinci Resolve), 3D rendering (Blender), streaming, workstation tasks
- Budget tiers: budget ($400–700), mid-range ($800–1400), high-end ($1500–2500), enthusiast ($2500+)

When a user asks for a build:
1. Ask clarifying questions if budget or use case is unclear
2. Output a complete parts list: CPU, GPU, Motherboard, RAM (specify speed), Storage, PSU (with wattage), Case
3. State the estimated total and any savings under budget
4. Explain the key decisions (why this CPU/GPU pairing, why this RAM speed, etc.)
5. Flag any known issues or gotchas (e.g. no cooler included, needs BIOS update, etc.)
6. Offer to swap parts, adjust budget, or add peripherals

When comparing products, use clear tables or bullet comparisons.
When advising upgrades, ask what the user currently owns first.

Format responses cleanly using markdown: use **bold** for part names, headers for sections, and tables for comparisons. Keep responses focused and practical — no fluff.

Important: Always mention specific product names clearly (e.g. "RTX 4070 Super", "Ryzen 5 7600X") as these will be linked to Amazon for purchase.`;
}

// ── Auth middleware ──
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = user;
  req.token = token;
  next();
}

// ── Message limit middleware ──
async function checkLimit(req, res, next) {
  const today = new Date().toISOString().split('T')[0];
  let { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, message_count_today, last_message_date')
    .eq('id', req.user.id)
    .single();

  // Auto-create profile if it doesn't exist
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({ id: req.user.id, subscription_status: 'free', message_count_today: 0 })
      .select()
      .single();
    profile = newProfile;
  }

  if (!profile) {
    return res.status(500).json({ error: 'Could not load user profile' });
  }

  // Pro = unlimited
  if (profile.subscription_status === 'pro') {
    req.isPro = true;
    return next();
  }

  // Reset count on new day
  const count = profile.last_message_date === today ? (profile.message_count_today || 0) : 0;

  if (count >= FREE_LIMIT) {
    return res.status(429).json({
      error: 'limit_reached',
      message: `You've used all ${FREE_LIMIT} free messages today. Upgrade to Pro for unlimited access.`
    });
  }

  // Increment
  await supabase
    .from('profiles')
    .update({ message_count_today: count + 1, last_message_date: today })
    .eq('id', req.user.id);

  req.messagesUsed = count + 1;
  next();
}

// ── Routes ──
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'auth.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/about.html', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/landing.html', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));

// User status
app.get('/api/user-status', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  let { data: profile } = await supabase
    .from('profiles')
    .select('first_name, subscription_status, message_count_today, last_message_date')
    .eq('id', req.user.id)
    .single();

  if (!profile) {
    await supabase.from('profiles').insert({ id: req.user.id, subscription_status: 'free', message_count_today: 0 });
    profile = { first_name: '', subscription_status: 'free', message_count_today: 0, last_message_date: null };
  }

  const count = profile?.last_message_date === today ? (profile?.message_count_today || 0) : 0;

  // Fall back to auth metadata or email if profile name is empty
  const name = profile?.first_name
    || req.user.user_metadata?.first_name
    || req.user.email?.split('@')[0]
    || 'User';

  res.json({
    name,
    plan: profile?.subscription_status || 'free',
    messagesUsed: count,
    messagesLimit: FREE_LIMIT,
  });
});

// Chat (streaming)
app.post('/api/chat', requireAuth, checkLimit, async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [{ type: 'text', text: getSystemPrompt(), cache_control: { type: 'ephemeral' } }],
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    stream.on('text', text => send('token', { text }));
    stream.on('finalMessage', () => { send('done', {}); res.end(); });
    stream.on('error', err => {
      console.error('Stream error:', err.message);
      send('error', { message: 'Stream error. Please try again.' });
      res.end();
    });
    req.on('close', () => stream.abort?.());
  } catch (err) {
    console.error('Anthropic error:', err.message);
    send('error', { message: 'Failed to get a response.' });
    res.end();
  }
});

// Create Stripe checkout session
app.post('/api/create-checkout', requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', req.user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { supabase_id: req.user.id },
      });
      customerId = customer.id;
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Zuuke Pro',
            description: 'Unlimited AI PC build recommendations',
          },
          unit_amount: 500, // $5.00
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: `${APP_URL}/chat?upgraded=true`,
      cancel_url: `${APP_URL}/chat`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook
app.post('/api/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await supabase
      .from('profiles')
      .update({ subscription_status: 'pro', subscription_id: session.subscription })
      .eq('stripe_customer_id', session.customer);
    console.log('User upgraded to Pro:', session.customer);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await supabase
      .from('profiles')
      .update({ subscription_status: 'free', subscription_id: null })
      .eq('stripe_customer_id', sub.customer);
    console.log('User downgraded to Free:', sub.customer);
  }

  res.json({ received: true });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Zuuke AI running at http://localhost:${PORT}`));
}

module.exports = app;
