-- Aura: a Chog's earned reputation. It belongs to the token, so it is part
-- of what a buyer gets. Every point is an event, so the history is auditable.

create table if not exists aura_events (
  id          bigint generated always as identity primary key,
  token_id    integer not null references chogs(token_id),
  source      text not null check (source in (
                'visitor_chat', 'owner_chat', 'owner_care', 'square_post',
                'square_mention', 'bond', 'chog_feed', 'neglect')),
  points      numeric not null,
  actor       text,                     -- wallet / visitor id / token id that caused it
  dedupe_key  text unique,              -- stops the same event counting twice
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists aura_events_token_idx on aura_events (token_id, created_at desc);
create index if not exists aura_events_source_day_idx on aura_events (token_id, source, created_at);

-- Loyalty is per owner: it resets on sale, Aura does not.
alter table chog_state add column if not exists loyalty integer not null default 0 check (loyalty between 0 and 100);
alter table chog_state add column if not exists last_care_at timestamptz;

-- $CHOG feeds, one row per verified on-chain transfer.
create table if not exists chog_feeds (
  tx_hash     text primary key,
  token_id    integer not null references chogs(token_id),
  from_addr   text not null,
  amount      numeric not null,         -- whole $CHOG (18 decimals already applied)
  created_at  timestamptz not null default now()
);

-- Current Aura per Chog, by bucket. Social and care are earned; chog is bought.
create or replace view aura_totals as
select
  token_id,
  coalesce(sum(points) filter (where source in ('visitor_chat', 'square_post', 'square_mention', 'bond')), 0) as social,
  coalesce(sum(points) filter (where source in ('owner_chat', 'owner_care')), 0) as care,
  coalesce(sum(points) filter (where source = 'chog_feed'), 0) as chog,
  coalesce(sum(points) filter (where source = 'neglect'), 0) as neglect,
  max(created_at) as last_event_at
from aura_events
group by token_id;

alter table aura_events enable row level security;
alter table chog_feeds  enable row level security;
create policy "public read" on aura_events for select using (true);
create policy "public read" on chog_feeds  for select using (true);
