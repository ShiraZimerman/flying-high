-- Finished games of tic-tac-toe (variant: misère). See docs/design.md.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null references auth.users (id) on delete cascade,

  -- The cells played, in order, 0-8 row by row. X plays first.
  -- These checks are a backstop: they do not catch a cell played twice.
  -- The server replays every game with shared/game/ before saving it.
  moves smallint[] not null
    constraint games_moves_length check (cardinality(moves) between 5 and 9)
    constraint games_moves_cells check (moves <@ array[0, 1, 2, 3, 4, 5, 6, 7, 8]::smallint[]),

  -- Calculated by the server from the replay, never taken from the browser.
  result text not null
    constraint games_result_valid check (result in ('x_wins', 'o_wins', 'draw')),

  played_at timestamptz not null default now()
);

-- "My games, newest first" is the only query.
create index if not exists games_owner_id_played_at_idx
  on public.games (owner_id, played_at desc);

-- RLS on, no policies: only the server reads and writes this table.
alter table public.games enable row level security;
