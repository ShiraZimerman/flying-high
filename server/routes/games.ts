import { MOVE_ERROR_MESSAGES, replay } from "@shared/game/misere";
import { saveGameSchema } from "@shared/schemas/games";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { fail, validate } from "../lib/errors";
import { createAdminClient } from "../lib/supabase";

/*
 * Saved games of tic-tac-toe. See docs/design.md.
 *
 * The server never trusts the browser: it receives only the moves, replays
 * them with the same rules the page plays with, and saves the result IT
 * calculated. A game that could never have been played is not saved.
 */

export const games = new Hono<AppEnv>()

  // GET /api/games - the logged-in user's games, newest first.
  .get("/", async (c) => {
    const { data, error } = await createAdminClient(c.env)
      .from("games")
      .select("id, result, played_at")
      // Only this user's games. Without this line, everyone would see
      // everyone's games: the server's key ignores Row Level Security.
      .eq("owner_id", c.get("user").id)
      .order("played_at", { ascending: false });

    if (error) {
      console.error("list games failed:", error);
      return fail(c, 500, "database_error", "Could not load your games.");
    }
    return c.json({ games: data });
  })

  // POST /api/games - save a finished game. Responds 201 with the saved game.
  .post("/", validate("json", saveGameSchema), async (c) => {
    const { moves } = c.req.valid("json");

    const outcome = replay(moves);
    if (!outcome.ok) {
      // 422, not 400: the request is well-formed JSON with the right shape,
      // but what it describes is not a game that could have been played.
      return fail(
        c,
        422,
        "invalid_game",
        `Move ${outcome.moveIndex + 1}: ${MOVE_ERROR_MESSAGES[outcome.error]}`,
      );
    }

    const { data, error } = await createAdminClient(c.env)
      .from("games")
      .insert({
        // From the verified token, never from the request body.
        owner_id: c.get("user").id,
        moves,
        // From our replay. The browser does not even send a result.
        result: outcome.game.result,
      })
      .select("id, moves, result, played_at")
      .single();

    if (error) {
      console.error("save game failed:", error);
      return fail(c, 500, "database_error", "Could not save the game.");
    }
    return c.json(data, 201);
  });
