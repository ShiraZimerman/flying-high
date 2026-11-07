import { newGame, play, type Game, type GameResult } from "@shared/game/misere";
import { useState } from "react";
import { Button, Card, Spinner } from "../../components";
import { useGames, useSaveGame } from "../../features/games/hooks";
import { LANG } from "../../lib/config";
import { cx } from "../../lib/cx";
import styles from "./TicTacToePage.module.css";

/**
 * Misère tic-tac-toe for two players on one screen. The rules live in
 * shared/game/misere.ts - this page only draws the game and passes clicks to
 * `play()`. When a game ends, it sends the moves to the server, which
 * replays them with the same rules and saves the result it calculates.
 */
export default function TicTacToePage() {
  const [game, setGame] = useState<Game>(newGame);
  const saveGame = useSaveGame();

  function handleClick(cell: number) {
    const outcome = play(game, cell);
    if (!outcome.ok) return; // The button was disabled; nothing to do.
    setGame(outcome.game);
    // Saved here, in the click, rather than in an effect - so a game is
    // saved exactly once, the moment it ends.
    if (outcome.game.result !== null) {
      saveGame.mutate({ moves: [...outcome.game.moves] });
    }
  }

  function startNewGame() {
    setGame(newGame());
    saveGame.reset();
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Tic-tac-toe</h1>
        <p className={styles.rules}>
          Misère: whoever makes three in a row <strong>loses</strong>.
        </p>
      </header>

      <div className={styles.game}>
        <p className={styles.status} aria-live="polite">
          {statusText(game)}
        </p>

        <div className={styles.board} role="group" aria-label="Board">
          {game.board.map((cell, index) => (
            <button
              key={index}
              type="button"
              className={cx(
                styles.cell,
                cell === "X" && styles.x,
                cell === "O" && styles.o,
                game.losingLine?.includes(index) && styles.losing,
              )}
              disabled={cell !== null || game.result !== null}
              onClick={() => handleClick(index)}
              aria-label={`Cell ${index + 1}, ${cell ?? "empty"}`}
            >
              {cell}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <Button
            variant={game.result ? "primary" : "secondary"}
            onClick={startNewGame}
          >
            New game
          </Button>
          <SaveStatus
            save={saveGame}
            onRetry={() => saveGame.mutate({ moves: [...game.moves] })}
          />
        </div>
      </div>

      <section className={styles.history}>
        <h2>Your games</h2>
        <GameList />
      </section>
    </main>
  );
}

function statusText(game: Game): string {
  switch (game.result) {
    case null:
      return `${game.next}'s turn`;
    case "x_wins":
      return "O made three in a row, so X wins!";
    case "o_wins":
      return "X made three in a row, so O wins!";
    case "draw":
      return "Nobody made a row. It's a draw!";
  }
}

function SaveStatus({
  save,
  onRetry,
}: {
  save: ReturnType<typeof useSaveGame>;
  onRetry: () => void;
}) {
  if (save.isPending) {
    return (
      <span className={styles.saveNote}>
        <Spinner size="sm" label="Saving" /> Saving the game…
      </span>
    );
  }
  if (save.isError) {
    return (
      <span className={styles.saveError} role="alert">
        Could not save the game: {save.error.message}{" "}
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      </span>
    );
  }
  if (save.isSuccess) {
    return <span className={styles.saveNote}>Saved.</span>;
  }
  return null;
}

const RESULT_LABELS: Record<GameResult, string> = {
  x_wins: "X won",
  o_wins: "O won",
  draw: "Draw",
};

function GameList() {
  const gamesQuery = useGames();

  if (gamesQuery.isPending) {
    return (
      <div className={styles.centered}>
        <Spinner label="Loading your games" />
      </div>
    );
  }
  if (gamesQuery.isError) {
    return (
      <Card padding="lg">
        <p role="alert">Could not load your games.</p>
        <Button variant="secondary" onClick={() => void gamesQuery.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (gamesQuery.data.length === 0) {
    return (
      <p className={styles.empty}>
        No games yet. Finish one and it shows up here.
      </p>
    );
  }

  return (
    <ol className={styles.list}>
      {gamesQuery.data.map((saved) => (
        <li key={saved.id} className={styles.listItem}>
          <span className={cx(styles.result, styles[saved.result])}>
            {RESULT_LABELS[saved.result]}
          </span>
          <time dateTime={saved.played_at} className={styles.playedAt}>
            {formatPlayedAt(saved.played_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function formatPlayedAt(iso: string): string {
  return new Intl.DateTimeFormat(LANG, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
