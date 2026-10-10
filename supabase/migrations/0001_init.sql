-- Chog Souls schema. Everything is keyed by token_id so a Chog's soul
-- (memory, relationships, state) travels with the NFT, not the wallet.

-- Cached Genesis metadata (tokenURI is shuffled, so we store per token_id).
create table if not exists chogs (
  token_id     integer primary key check (token_id between 1 and 1969),
  name         text not null,
  image        text not null,
  traits       jsonb not null,          -- { Background, Base, Skin, ... }
  personality  jsonb,                   -- derived by the personality engine
  created_at   timestamptz not null default now()
);

-- Live state per Chog; last_owner lets us detect a transfer and react.
create table if not exists chog_state (
  token_id        integer primary key references chogs(token_id),
  owner           text,                 -- lowercase address last seen on-chain
  previous_owner  text,
  owner_since     timestamptz,
  mood            text not null default 'curious',
  energy          integer not null default 100 check (energy between 0 and 100),
  xp              integer not null default 0,
  updated_at      timestamptz not null default now()
);

-- Long-term memory: chat turns, life events and rolling summaries.
create table if not exists chog_memory (
  id          bigint generated always as identity primary key,
  token_id    integer not null references chogs(token_id),
  kind        text not null check (kind in ('chat', 'event', 'summary')),
  role        text check (role in ('user', 'chog', 'system')),
  content     text not null,
  owner       text,                     -- who was holding the Chog at the time
  importance  smallint not null default 1,
  created_at  timestamptz not null default now()
);
create index if not exists chog_memory_token_idx on chog_memory (token_id, created_at desc);

-- Directed relationships: how token_id feels about other_token_id.
create table if not exists chog_relations (
  token_id        integer not null references chogs(token_id),
  other_token_id  integer not null references chogs(token_id),
  affinity        integer not null default 0 check (affinity between -100 and 100),
  grudge          text,                 -- reason, null if none
  notes           text,
  updated_at      timestamptz not null default now(),
  primary key (token_id, other_token_id),
  check (token_id <> other_token_id)
);

-- Every owner a Chog has had (from Transfer events).
create table if not exists owner_history (
  id            bigint generated always as identity primary key,
  token_id      integer not null references chogs(token_id),
  from_address  text,
  to_address    text not null,
  block_number  bigint,
  tx_hash       text,
  log_index     integer,
  created_at    timestamptz not null default now(),
  unique (tx_hash, log_index)
);
create index if not exists owner_history_token_idx on owner_history (token_id, block_number desc);

-- Town Square: public feed of Chog posts and gossip.
create table if not exists town_posts (
  id               bigint generated always as identity primary key,
  token_id         integer not null references chogs(token_id),
  about_token_id   integer references chogs(token_id),
  kind             text not null default 'post' check (kind in ('post', 'gossip', 'event', 'reaction')),
  content          text not null,
  created_at       timestamptz not null default now()
);
create index if not exists town_posts_created_idx on town_posts (created_at desc);

-- RLS: all writes go through the server (service role bypasses RLS).
-- Public (anon) can read the shared world; private memory stays server-only.
alter table chogs          enable row level security;
alter table chog_state     enable row level security;
alter table chog_memory    enable row level security;
alter table chog_relations enable row level security;
alter table owner_history  enable row level security;
alter table town_posts     enable row level security;

create policy "public read" on chogs          for select using (true);
create policy "public read" on chog_state     for select using (true);
create policy "public read" on chog_relations for select using (true);
create policy "public read" on owner_history  for select using (true);
create policy "public read" on town_posts     for select using (true);
