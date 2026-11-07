import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../env";
import { games } from "./games";

/*
 * The server never trusts the browser. These tests send it games a real page
 * would never send, and check what it saves. There is no real database: the
 * Supabase client is replaced by a fake that records what was inserted.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

const inserted: Record<string, unknown>[] = [];
const filters: [string, unknown][] = [];

vi.mock("../lib/supabase", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({
              data: { id: "game-1", played_at: "2026-11-07T12:00:00Z", ...row },
              error: null,
            }),
          }),
        };
      },
      select: () => ({
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return { order: async () => ({ data: [], error: null }) };
        },
      }),
    }),
  }),
}));

// The routes, with a stand-in for the login middleware.
const app = new Hono<AppEnv>()
  .use(async (c, next) => {
    c.set("user", { id: USER_ID, email: "a@test.dev" });
    await next();
  })
  .route("/api/games", games);

function save(body: unknown) {
  return app.request("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  inserted.length = 0;
  filters.length = 0;
});

describe("POST /api/games", () => {
  it("saves a real game with the result the server calculated", async () => {
    const response = await save({ moves: [0, 4, 1, 3, 2] });
    expect(response.status).toBe(201);
    expect(inserted).toEqual([
      { owner_id: USER_ID, moves: [0, 4, 1, 3, 2], result: "o_wins" },
    ]);
  });

  it("ignores a result and an owner sent by the browser", async () => {
    await save({
      moves: [0, 4, 1, 3, 2],
      result: "x_wins",
      owner_id: "someone",
    });
    expect(inserted[0]).toMatchObject({ owner_id: USER_ID, result: "o_wins" });
  });

  it("answers 422 for a game 'won' in 2 moves, and saves nothing", async () => {
    const response = await save({ moves: [4, 0] });
    expect(response.status).toBe(422);
    expect(inserted).toEqual([]);
  });

  it("answers 422 for a cell played twice", async () => {
    const response = await save({ moves: [0, 0, 1, 3, 2] });
    expect(response.status).toBe(422);
  });

  it("answers 400 for moves that are not cells", async () => {
    expect((await save({ moves: [0, 9] })).status).toBe(400);
    expect((await save({ moves: "0,4,1" })).status).toBe(400);
    expect(inserted).toEqual([]);
  });
});

describe("GET /api/games", () => {
  it("only asks for the logged-in user's games", async () => {
    const response = await app.request("/api/games");
    expect(response.status).toBe(200);
    expect(filters).toEqual([["owner_id", USER_ID]]);
  });
});
