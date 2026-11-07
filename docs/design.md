# Design

Variant: `misere` - 3×3 board, whoever makes three in a row **loses**.

A cell is a number from 0 to 8, row by row:

```
0 | 1 | 2
3 | 4 | 5
6 | 7 | 8
```

A game is stored as the list of cells played, in order. X plays first, and the
players take turns, so the even positions in the list are X's moves and the odd
ones are O's.

## The database

Both tables have Row Level Security on and no policies, like `events`: only the
server reads and writes them.

**Table games** - one row per finished game of tic-tac-toe.

| Column    | Type        | Rules                                                  |
| --------- | ----------- | ------------------------------------------------------ |
| id        | uuid        | primary key, set by the database                       |
| owner_id  | uuid        | foreign key to auth.users, on delete cascade, not null |
| moves     | smallint[]  | not null, 5 to 9 items, every item from 0 to 8         |
| result    | text        | not null, one of `x_wins`, `o_wins`, `draw`            |
| played_at | timestamptz | not null, set by the database                          |

- `result` is always calculated by the server, by replaying `moves` with the
  functions in `shared/game/`. In misère, the player who makes a row loses, so
  `x_wins` means O made a row.
- The checks on `moves` are a backstop. They catch an obviously broken row, but
  not a cell played twice. Only the replay catches that.
- Index on `(owner_id, played_at desc)`, for "my games, newest first".

**Table apod_explanations** - one row per APOD picture that has been explained
in Hebrew. It is shared by all users: a picture is explained once, and everyone
gets the saved answer after that.

| Column     | Type        | Rules                                                      |
| ---------- | ----------- | ---------------------------------------------------------- |
| date       | date        | primary key, not before 1995-06-16 (the first APOD)        |
| title_he   | text        | not null, not empty                                        |
| summary_he | text        | not null, not empty                                        |
| tags       | text[]      | not null, 1 to 5 items, every item from the tag list below |
| model      | text        | not null, the Gemini model that wrote it                   |
| created_at | timestamptz | not null, set by the database                              |

- The date is the primary key because APOD has exactly one picture per day. That
  also stops the same picture being saved twice.
- Tags: `galaxy`, `nebula`, `star`, `cluster`, `planet`, `moon`, `sun`, `earth`,
  `comet`, `asteroid`, `black-hole`, `eclipse`, `aurora`, `spacecraft`,
  `telescope`. The same list is in a Zod schema in `shared/`, and in the schema
  sent to Gemini.

## The API

All of these need a login.

### Part 1 - Tic-tac-toe

**POST /api/games** - save a finished game.

- Receives: `{ moves }`, a list of cells, for example `[0, 4, 1, 3, 2]`. X makes
  the top row with its third move, so X loses.
- Answers: 201 with the saved game: `{ id, moves, result, played_at }`.
- Errors:
  - 400 if the body is not a list of whole numbers from 0 to 8.
  - 422 if the moves are not a game that could really have been played:
    - a cell is played twice
    - a move comes after the game has already ended
    - the moves stop before the game has ended
  - 500 if the database fails.
- Tables: writes games, with the logged-in user as owner_id and the result the
  server calculated. Any result sent by the browser is ignored.

**GET /api/games** - the logged-in user's games, newest first.

- Receives: nothing.
- Answers: 200 with `{ games: [{ id, result, played_at }] }`.
- Errors: 500 if the database fails.
- Tables: reads games, only the rows whose owner_id is the logged-in user.

### Part 2 - Space pictures

**GET /api/nasa/pictures?count=20** - random APOD pictures.

- Receives: `count` in the query, from 1 to 20. If it is missing, 20.
- Answers: 200 with
  `{ pictures: [{ date, title, explanation, media_type, image_url, copyright, hebrew }] }`.
  - `image_url` is the thumbnail when the picture is a video.
  - `hebrew` is `{ title_he, summary_he, tags }` if the picture was already
    explained, otherwise `null`. That way, a card shows a saved explanation
    without the page asking for it.
- Errors:
  - 400 if `count` is not a whole number from 1 to 20.
  - 502 if NASA answers with an error, or with something that is not the
    expected shape.
  - 504 if NASA does not answer within 10 seconds.
  - 500 if the database fails.

  NASA's own status code and message are never passed on.

- Tables: reads apod_explanations, for the dates in NASA's answer.

**POST /api/nasa/explanations** - explain one picture in Hebrew.

- Receives: `{ date }`, as `YYYY-MM-DD`. Nothing else: the title and explanation
  come from NASA, not from the browser.
- Answers: 200 with `{ date, title_he, summary_he, tags }`.
- Steps:
  1. If the date is already in apod_explanations, return the saved row without
     calling NASA or Gemini.
  2. Otherwise, get the picture for that date from NASA.
  3. Send its title and explanation to Gemini, asking for structured JSON.
  4. Check Gemini's answer with the Zod schema in `shared/`, and save it.
- Errors:
  - 400 if the date is not a valid date, is before 1995-06-16, or is in the
    future.
  - 404 if NASA has no picture for that date.
  - 502 if NASA or Gemini answers with an error, or if Gemini's answer does not
    pass the Zod schema.
  - 503 if Gemini says we are over the free tier's limit (its 429).
  - 504 if NASA or Gemini does not answer within 30 seconds.
  - 500 if the database fails.
- Tables: reads apod_explanations, and writes it when the picture is new.
  - The write is `insert ... on conflict (date) do nothing`, followed by reading
    the row back. If two users explain the same picture at the same moment, both
    get the same saved answer.
  - Nothing about the user is saved or sent to Gemini: only NASA's public title
    and explanation are sent, because Google may use what the free tier
    receives.

## One trade-off

**Saving the moves, not only the result.**

The page needs only the result and the date, so the games table could have been
just `result` and `played_at`, which is smaller and simpler.

I chose to save `moves` as well:

- It is a few bytes per game.
- It keeps the evidence for every result. If I later find a bug in the rules in
  `shared/game/`, I can replay every saved game with the fixed functions, and
  correct the results that were wrong.
- With only the result, a wrong result would be stuck in the database, with
  nothing to check it against.

The cost is that `moves` and `result` can disagree if someone edits the table by
hand. Only the server writes the table, and it always writes both from the same
replay.
