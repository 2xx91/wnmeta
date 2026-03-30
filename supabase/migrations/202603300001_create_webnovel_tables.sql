create table if not exists public.webnovels (
  platform text not null,
  source_id text not null,
  title text not null,
  author text,
  publisher text,
  genre text,
  view_count bigint,
  status text,
  first_serialized_at date,
  last_serialized_at date,
  current_episode integer,
  synopsis text,
  comment_count integer,
  cover_url text,
  constraint webnovels_pkey primary key (platform, source_id)
);
