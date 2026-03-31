create table if not exists public.webnovel_history (
  id bigint generated always as identity primary key,
  platform text not null,
  source_id text not null,
  history_date date not null default current_date,
  view_delta bigint not null,
  comment_delta integer not null,
  constraint webnovel_history_platform_source_history_date_key
    unique (platform, source_id, history_date),
  constraint webnovel_history_webnovels_fkey
    foreign key (platform, source_id)
    references public.webnovels (platform, source_id)
    on delete cascade
);
