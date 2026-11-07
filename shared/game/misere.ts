/*
 * The rules of misère tic-tac-toe: a 3×3 board, and whoever makes three in a
 * row LOSES. If the board fills up and nobody made a row, it is a draw.
 *
 * Pure functions only: no React, no database, and no function here changes
 * the game it is given - each one returns a new game instead. The page uses
 * them to play, and the server uses the same ones to check a saved game, so
 * the two can never disagree about the rules.
 *
 * A cell is a number from 0 to 8, row by row:
 *
 *     0 | 1 | 2
 *     3 | 4 | 5
 *     6 | 7 | 8
 */

export type Player = "X" | "O";
export type Cell = Player | null;

/** How a finished game ended. The same values as games.result in the database. */
export type GameResult = "x_wins" | "o_wins" | "draw";

export type Game = {
  /** Nine cells, row by row. */
  board: readonly Cell[];
  /** The cells played so far, in order. */
  moves: readonly number[];
  /** Whose turn it is. Still set after the game ends, but nobody can play. */
  next: Player;
  /** Null while the game is still going. */
  result: GameResult | null;
  /** The row that lost the game, if someone made one. */
  losingLine: readonly number[] | null;
};

/** Why a move is not allowed. */
export type MoveError = "not_a_cell" | "cell_taken" | "game_over";

/** Why a list of moves is not a whole game that could really have been played. */
export type ReplayError = MoveError | "not_finished";

export type MoveOutcome =
  { ok: true; game: Game } | { ok: false; error: MoveError };

export type ReplayOutcome =
  | { ok: true; game: Game }
  | {
      ok: false;
      error: ReplayError;
      /** The position in the list of the move that was wrong. */
      moveIndex: number;
    };

export const BOARD_SIZE = 9;

/** Every line of three: the rows, the columns, and the two diagonals. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function newGame(): Game {
  return {
    board: Array<Cell>(BOARD_SIZE).fill(null),
    moves: [],
    next: "X",
    result: null,
    losingLine: null,
  };
}

/** The line of three that `player` has made, or null. */
function lineOf(
  board: readonly Cell[],
  player: Player,
): readonly number[] | null {
  return (
    LINES.find((line) => line.every((cell) => board[cell] === player)) ?? null
  );
}

/** Plays `cell` for whoever's turn it is, and returns the game after it. */
export function play(game: Game, cell: number): MoveOutcome {
  if (game.result !== null) return { ok: false, error: "game_over" };
  if (!Number.isInteger(cell) || cell < 0 || cell >= BOARD_SIZE) {
    return { ok: false, error: "not_a_cell" };
  }
  if (game.board[cell] !== null) return { ok: false, error: "cell_taken" };

  const player = game.next;
  const board = [...game.board];
  board[cell] = player;
  const moves = [...game.moves, cell];
  const next: Player = player === "X" ? "O" : "X";

  // Misère: making a row loses, so the OTHER player wins. This is checked
  // before the draw, because the ninth move can fill the board and make a
  // row at the same time - and then it is still a row.
  const line = lineOf(board, player);
  if (line) {
    return {
      ok: true,
      game: {
        board,
        moves,
        next,
        result: player === "X" ? "o_wins" : "x_wins",
        losingLine: line,
      },
    };
  }

  const full = board.every((c) => c !== null);
  return {
    ok: true,
    game: {
      board,
      moves,
      next,
      result: full ? "draw" : null,
      losingLine: null,
    },
  };
}

/**
 * Plays a whole list of moves from an empty board. Succeeds only if every
 * move is allowed AND the game has ended by the last one - so a game that
 * could never have been played, or was not finished, is rejected.
 */
export function replay(moves: readonly number[]): ReplayOutcome {
  let game = newGame();
  for (const [moveIndex, cell] of moves.entries()) {
    const outcome = play(game, cell);
    if (!outcome.ok) return { ok: false, error: outcome.error, moveIndex };
    game = outcome.game;
  }
  if (game.result === null) {
    return { ok: false, error: "not_finished", moveIndex: moves.length };
  }
  return { ok: true, game };
}

/** For people: what went wrong with a move. */
export const MOVE_ERROR_MESSAGES: Record<ReplayError, string> = {
  not_a_cell: "That is not a cell on the board.",
  cell_taken: "That cell has already been played.",
  game_over: "The game is already over.",
  not_finished: "The game is not finished yet.",
};
