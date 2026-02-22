-- =============================================================
-- ArtCourses – complete idempotent schema bootstrap
-- Run: npm run db:setup   (from apps/api/)
-- =============================================================

-- ── plans ─────────────────────────────────────────────────────
create table if not exists plans (
  id          text primary key,
  title       text not null,
  description text,
  price_monthly  integer,
  price_yearly   integer,
  created_at  timestamptz not null default now()
);

-- ── users ─────────────────────────────────────────────────────
create table if not exists users (
  id               serial primary key,
  telegram_user_id bigint unique not null,
  username         text,
  first_name       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── subscriptions ─────────────────────────────────────────────
create table if not exists subscriptions (
  id                       serial primary key,
  telegram_user_id         bigint not null,
  plan_id                  text references plans(id),
  status                   text not null default 'none',
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  provider                 text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ── mock_checkouts ────────────────────────────────────────────
create table if not exists mock_checkouts (
  id               serial primary key,
  event_id         text unique not null,
  telegram_user_id bigint not null,
  plan_id          text not null,
  checkout_url     text not null,
  status           text not null default 'created',
  created_at       timestamptz not null default now()
);

-- ── payments ──────────────────────────────────────────────────
create table if not exists payments (
  id                   serial primary key,
  telegram_user_id     bigint not null,
  provider_payment_id  text,
  status               text not null,
  amount               integer not null default 0,
  currency             text not null default 'KZT',
  period_start         timestamptz,
  period_end           timestamptz,
  created_at           timestamptz not null default now()
);

-- ── webhook_logs ──────────────────────────────────────────────
create table if not exists webhook_logs (
  id              bigserial primary key,
  provider        text,
  event_id        text,
  event_type      text,
  raw_payload     jsonb,
  processed_ok    boolean,
  error_text      text,
  created_at      timestamptz not null default now()
);

-- ── webhook_events (idempotency guard) ────────────────────────
create table if not exists webhook_events (
  provider   text not null,
  event_id   text not null,
  created_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- ── seed plans ────────────────────────────────────────────────
insert into plans (id, title, price_monthly, price_yearly, description)
values
  ('monthly',   'Ежемесячно',    9900,  null,  null),
  ('quarterly', 'Ежеквартально', 8910,  null,  null),
  ('yearly',    'Ежегодно',      null,  89100, null)
on conflict (id) do nothing;
