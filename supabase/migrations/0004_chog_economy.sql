-- $CHOG economy: feeds split with the owner, paid extra chats, commissioned roasts.

-- Every on-chain $CHOG payment we've credited, so a transaction can never be
-- claimed twice (for any purpose).
create table if not exists chog_payments (
  tx_hash     text primary key,
  from_addr   text not null,
  purpose     text not null check (purpose in ('feed', 'chats', 'roast')),
  amount      numeric not null,          -- whole $CHOG in this tx
  token_id    integer references chogs(token_id),
  created_at  timestamptz not null default now()
);
alter table chog_payments enable row level security;
create policy "public read" on chog_payments for select using (true);

-- Feeds now record how much went to the Chog's owner.
alter table chog_feeds add column if not exists owner_addr text;
alter table chog_feeds add column if not exists owner_amount numeric not null default 0;

-- Extra chats bought with $CHOG, per wallet.
create table if not exists chat_credits (
  actor       text primary key,
  credits     integer not null default 0 check (credits >= 0),
  updated_at  timestamptz not null default now()
);
alter table chat_credits enable row level security;

-- Commissioned roasts and the victim's one free comeback.
alter table town_posts add column if not exists commissioned_by text;
alter table town_posts add column if not exists reply_to bigint references town_posts(id);
alter table town_posts add column if not exists comeback_used boolean not null default false;
