# Zuuke AI — PC Build Assistant

An AI-powered PC build assistant with user authentication, daily message limits, and Stripe subscription billing.

---

## Features

- AI chat powered by Claude (Anthropic)
- User sign up / login via Supabase Auth
- Free plan: 10 messages/day
- Pro plan: $5/month unlimited messages (Stripe)
- Chat history saved locally
- Streaming AI responses

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Spartan2516/Zuuke-AI.git
cd Zuuke-AI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your `.env` file

```bash
cp .env.example .env
```

Fill in your keys in `.env`:

```
ANTHROPIC_API_KEY=your_anthropic_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
PORT=3000
```

### 4. Set up Supabase database

Run this SQL in your Supabase project → SQL Editor:

```sql
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  stripe_customer_id text,
  subscription_status text default 'free',
  subscription_id text,
  message_count_today integer default 0,
  last_message_date date
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Service role can insert profiles" on profiles for insert with check (true);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### 5. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## Testing Stripe (sandbox)

### Download Stripe CLI

- **Windows**: Download `stripe_X.X.X_windows_x86_64.zip` from [github.com/stripe/stripe-cli/releases](https://github.com/stripe/stripe-cli/releases/latest), extract and run `stripe.exe`
- **Mac**: `brew install stripe/stripe-cli/stripe`
- **Linux**: See [Stripe CLI docs](https://stripe.com/docs/stripe-cli)

### Forward webhooks locally

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Copy the `whsec_...` secret it prints and add it to your `.env` as `STRIPE_WEBHOOK_SECRET`, then restart the server.

### Test card

| Field | Value |
|-------|-------|
| Card number | `4242 4242 4242 4242` |
| Expiry | Any future date |
| CVC | Any 3 digits |
| Name/ZIP | Anything |

---

## API Keys

| Key | Where to get it |
|-----|----------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `SUPABASE_URL` + keys | Supabase project → Settings → API |
| `STRIPE_*` keys | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys |
