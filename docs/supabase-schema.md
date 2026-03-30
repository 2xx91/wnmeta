# Supabase Schema

`supabase/migrations/202603300001_create_webnovel_tables.sql` adds one table:

- `public.webnovels`

## `public.webnovels`

One row per platform work.

- `platform`: `K` or `N`
- `source_id`: platform-native ID
  - KakaoPage: `series_id`
  - Naver Series: `productNo`
- `title`
- `author`
- `publisher`
- `genre`: display string to query quickly
- `view_count`
- `status`
- `first_serialized_at`
- `last_serialized_at`
- `current_episode`
- `synopsis`
- `comment_count`
- `cover_url`

Uniqueness is enforced by `(platform, source_id)`.

## Upsert Pattern

```sql
insert into public.webnovels (
  platform,
  source_id,
  title,
  author,
  publisher,
  genre,
  view_count,
  status,
  first_serialized_at,
  last_serialized_at,
  current_episode,
  synopsis,
  comment_count,
  cover_url
)
values (
  'K',
  '68933296',
  '과거로 간 태블릿',
  '그라시아S',
  '예시 출판사',
  '현판',
  470,
  '완결',
  '2026-03-30',
  '2026-03-30',
  247,
  '...',
  0,
  'https://example.com/cover.jpg'
)
on conflict (platform, source_id)
do update
set
  title = excluded.title,
  author = excluded.author,
  publisher = excluded.publisher,
  genre = excluded.genre,
  view_count = excluded.view_count,
  status = excluded.status,
  first_serialized_at = excluded.first_serialized_at,
  last_serialized_at = excluded.last_serialized_at,
  current_episode = excluded.current_episode,
  synopsis = excluded.synopsis,
  comment_count = excluded.comment_count,
  cover_url = excluded.cover_url;
```

## Notes

- `source_id` is `text` on purpose, so platform-specific IDs can be stored without schema changes.
- `first_serialized_at` and `last_serialized_at` are stored as `date`.
- `status` uses `연재`, `완결`, `중단`.
