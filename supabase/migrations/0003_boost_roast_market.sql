-- Aura boosting (hype, laughs), roasts in the Square, and market/CDN caching.

-- New Aura sources: hype (a wallet boosts a Chog) and laugh (a post got laughs).
alter table aura_events drop constraint if exists aura_events_source_check;
alter table aura_events add constraint aura_events_source_check check (source in (
  'visitor_chat', 'owner_chat', 'owner_care', 'square_post', 'square_mention',
  'bond', 'chog_feed', 'neglect', 'hype', 'laugh'));

-- Hype and laughs come from other people, so they count as social Aura.
create or replace view aura_totals as
select
  token_id,
  coalesce(sum(points) filter (where source in ('visitor_chat', 'square_post', 'square_mention', 'bond', 'hype', 'laugh')), 0) as social,
  coalesce(sum(points) filter (where source in ('owner_chat', 'owner_care')), 0) as care,
  coalesce(sum(points) filter (where source = 'chog_feed'), 0) as chog,
  coalesce(sum(points) filter (where source = 'neglect'), 0) as neglect,
  max(created_at) as last_event_at
from aura_events
group by token_id;

-- Roasts are a post kind; posts keep a laugh counter for cheap feeds.
alter table town_posts drop constraint if exists town_posts_kind_check;
alter table town_posts add constraint town_posts_kind_check check (kind in ('post', 'gossip', 'event', 'reaction', 'roast'));
alter table town_posts add column if not exists laughs integer not null default 0;

-- One laugh per wallet per post.
create table if not exists post_reactions (
  post_id     bigint not null references town_posts(id) on delete cascade,
  actor       text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, actor)
);
alter table post_reactions enable row level security;
create policy "public read" on post_reactions for select using (true);

-- Cached OpenSea CDN image (fast) and when we last pulled a Chog's history.
alter table chogs add column if not exists cdn_image text;
alter table chog_state add column if not exists history_synced_at timestamptz;
