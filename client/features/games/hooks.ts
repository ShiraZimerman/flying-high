import type {
  GameSummary,
  SavedGame,
  SaveGameInput,
} from "@shared/schemas/games";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

/* Talking to /api/games from the browser. Same shape as features/events. */

export const gameKeys = {
  all: ["games"] as const,
};

/** The logged-in user's saved games, newest first. */
export function useGames() {
  return useQuery({
    queryKey: gameKeys.all,
    queryFn: () => api<{ games: GameSummary[] }>("/api/games"),
    select: (data) => data.games,
  });
}

/** Saves a finished game. Send only the moves: the server works out the result. */
export function useSaveGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveGameInput) =>
      api<SavedGame>("/api/games", { method: "POST", body: input }),
    onSuccess: () => {
      // The list below the board is now out of date - fetch it again.
      void queryClient.invalidateQueries({ queryKey: gameKeys.all });
    },
  });
}
