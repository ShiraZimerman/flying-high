import { z } from "zod";

/*
 * What the browser sends and gets back for saved games. Only the SHAPE is
 * checked here; whether the moves are a real game is decided by replaying
 * them with shared/game/misere.ts on the server.
 */

/** POST /api/games. Just the moves - the server works out the result itself. */
export const saveGameSchema = z.object({
  moves: z.array(
    z
      .number("Each move must be a number")
      .int("Each move must be a whole number")
      .min(0, "Each move must be a cell from 0 to 8")
      .max(8, "Each move must be a cell from 0 to 8"),
    "Please send the list of moves",
  ),
});

export const gameResultSchema = z.enum(["x_wins", "o_wins", "draw"]);

/** A saved game, as POST /api/games answers it. */
export const gameSchema = z.object({
  id: z.string(),
  moves: z.array(z.number()),
  result: gameResultSchema,
  played_at: z.string(),
});

/** One row of GET /api/games. */
export const gameSummarySchema = gameSchema.omit({ moves: true });

export type SaveGameInput = z.infer<typeof saveGameSchema>;
export type SavedGame = z.infer<typeof gameSchema>;
export type GameSummary = z.infer<typeof gameSummarySchema>;
