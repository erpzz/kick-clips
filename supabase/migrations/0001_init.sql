-- 0001_init.sql  – KickClips MVP schema
-- This lives inside /supabase/migrations and is applied with:
--   npx supabase db push --remote

/* ========== reference tables ========== */

create table public.categories (
  id              int    primary key,
  name            text   
  slug            text 
  parent_category text
);

create table public.users (
  id       bigint primary key,
  username text   
  slug     text  
);

create table public.channels (
  id              bigint primary key,
  username        text   
  slug            text   
  profile_picture text,
  user_id         bigint references public.users(id) on delete set null
);

/* ========== main fact table ========== */

create table public.clips (
  -- identity
  id             text   primary key,
  livestream_id  bigint,
  title          text,

  -- relationships
  category_id    int     references public.categories(id),
  channel_id     bigint  references public.channels(id),

  -- media urls
  clip_url       text,
  thumbnail_url  text,
  video_url      text,

  -- meta
  privacy        text,
  duration       int,            -- seconds, nullable
  started_at     timestamptz,
  created_at     timestamptz default now(),
  vod_starts_at  int,
  is_mature      boolean,

  -- counters (nullable so missing fields won’t break)
  view_count     int,
  likes_count    int,

  -- scoring
  score          numeric not null default 0,
  is_stake_ad    boolean not null default false,

  -- raw JSON backup
  raw_payload    jsonb  not null
);

/* ========== indexes ========== */

-- feed: highest score first, newest first
create index clips_feed_idx
  on public.clips (score desc, created_at desc);
