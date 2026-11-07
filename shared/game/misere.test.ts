import { describe, expect, it } from "vitest";
import { newGame, play, replay } from "./misere";

/*
 * The rules decide what the server accepts, so every way a game can end and
 * every way a move can be wrong has a test here.
 */

describe("play", () => {
  it("starts with X, then alternates", () => {
    const first = play(newGame(), 4);
    expect(first.ok && first.game.board[4]).toBe("X");
    const second = first.ok ? play(first.game, 0) : first;
    expect(second.ok && second.game.board[0]).toBe("O");
  });

  it("does not change the game it was given", () => {
    const game = newGame();
    play(game, 4);
    expect(game.board[4]).toBeNull();
    expect(game.moves).toEqual([]);
  });

  it("rejects a cell that is already taken", () => {
    const first = play(newGame(), 4);
    expect(first.ok && play(first.game, 4)).toEqual({
      ok: false,
      error: "cell_taken",
    });
  });

  it.each([-1, 9, 1.5, Number.NaN])(
    "rejects %s, which is not a cell",
    (cell) => {
      expect(play(newGame(), cell)).toEqual({ ok: false, error: "not_a_cell" });
    },
  );
});

describe("replay", () => {
  it("makes X lose when X makes three in a row", () => {
    // X: 0, 1, 2 (the top row). O: 4, 3.
    const outcome = replay([0, 4, 1, 3, 2]);
    expect(outcome.ok && outcome.game.result).toBe("o_wins");
    expect(outcome.ok && outcome.game.losingLine).toEqual([0, 1, 2]);
  });

  it("makes O lose when O makes three in a row", () => {
    // X: 0, 1, 5. O: 6, 4, 2 (a diagonal).
    const outcome = replay([0, 6, 1, 4, 5, 2]);
    expect(outcome.ok && outcome.game.result).toBe("x_wins");
  });

  it("is a draw when the board is full and nobody made a row", () => {
    // X: 0, 2, 3, 7, 8. O: 1, 4, 5, 6.
    const outcome = replay([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(outcome.ok && outcome.game.result).toBe("draw");
  });

  it("counts a row made with the last move as a loss, not a draw", () => {
    // X: 1, 3, 5, 7, then 4, which fills the board AND makes 1-4-7.
    // O: 0, 2, 6, 8, which is no line.
    const outcome = replay([1, 0, 3, 2, 5, 6, 7, 8, 4]);
    expect(outcome.ok && outcome.game.result).toBe("o_wins");
  });

  it("rejects a game that is not finished", () => {
    expect(replay([0, 4, 1])).toEqual({
      ok: false,
      error: "not_finished",
      moveIndex: 3,
    });
  });

  it("rejects an empty game", () => {
    expect(replay([]).ok).toBe(false);
  });

  it("rejects a move after the game has ended", () => {
    expect(replay([0, 4, 1, 3, 2, 8])).toEqual({
      ok: false,
      error: "game_over",
      moveIndex: 5,
    });
  });

  it("rejects a cell played twice", () => {
    expect(replay([0, 0, 1, 3, 2])).toEqual({
      ok: false,
      error: "cell_taken",
      moveIndex: 1,
    });
  });
});
