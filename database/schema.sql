create extension if not exists "uuid-ossp";

create table if not exists users (
  telegram_user_id bigint primary key,
  username text,
  first_name text,
  created_at timestamp default now()
);

create table if not exists plans (
  id text primary key,
  title text not null,
  description text,
  price_monthly int,
  price_yearly int
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  telegram_user_id bigint not null references users(telegram_user_id),
  plan_id text not null references plans(id),

  status text not null check (status in ('active','past_due','canceled','expired')),

  current_period_start timestamp,
  current_period_end timestamp,

  provider text,
  provider_subscription_id text,

  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  telegram_user_id bigint not null references users(telegram_user_id),
  provider_payment_id text,
  status text,
  amount int,
  currency text,
  period_start timestamp,
  period_end timestamp,
  created_at timestamp default now()
);

create table if not exists webhook_events (
  provider text not null,
  event_id text primary key,
  received_at timestamp default now()
);
