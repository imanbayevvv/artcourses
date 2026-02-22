create table if not exists users (
  telegram_user_id bigint primary key,
  username         text,
  first_name       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists mock_checkouts (
  event_id         text primary key,
  telegram_user_id bigint not null,
  plan_id          text not null,
  checkout_url     text not null,
  created_at       timestamptz not null default now()
);

create table if not exists subscriptions (
  telegram_user_id    bigint primary key,
  status              text not null default 'none',
  plan_id             text,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists webhook_logs (
  id          bigserial primary key,
  provider    text,
  event_id    text,
  event_type  text,
  raw_payload jsonb,
  created_at  timestamptz not null default now()
);
