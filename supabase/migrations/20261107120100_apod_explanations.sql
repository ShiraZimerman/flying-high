-- Hebrew explanations of APOD pictures, written by Gemini. See docs/design.md.
--
-- Shared by all users: a picture is explained once, and everyone gets the
-- saved answer after that, so we never pay Gemini twice for the same picture.

create table if not exists public.apod_explanations (
  -- APOD has exactly one picture per day, so the date identifies it.
  date date primary key
    constraint apod_explanations_date_valid check (date >= date '1995-06-16'),

  title_he text not null
    constraint apod_explanations_title_not_empty check (btrim(title_he) <> ''),
  summary_he text not null
    constraint apod_explanations_summary_not_empty check (btrim(summary_he) <> ''),

  -- Keep this list the same as APOD_TAGS in shared/schemas/nasa.ts.
  tags text[] not null
    constraint apod_explanations_tags_count check (cardinality(tags) between 1 and 5)
    constraint apod_explanations_tags_known check (tags <@ array[
      'galaxy', 'nebula', 'star', 'cluster', 'planet', 'moon', 'sun', 'earth',
      'comet', 'asteroid', 'black-hole', 'eclipse', 'aurora', 'spacecraft',
      'telescope'
    ]::text[]),

  -- Which Gemini model wrote it.
  model text not null,

  created_at timestamptz not null default now()
);

-- RLS on, no policies: only the server reads and writes this table.
alter table public.apod_explanations enable row level security;
