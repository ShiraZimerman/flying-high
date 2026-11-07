import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card } from "../../components";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import styles from "./HomePage.module.css";
import skyline from "./jerusalem-skyline.webp";

type Me = { id: string; email: string };

/** The three parts of the assignment, one card each. */
const PARTS = [
  {
    number: 1,
    to: "/tic-tac-toe",
    title: "Tic-tac-toe",
    description:
      "Misère tic-tac-toe for two players on one screen: whoever makes three in a row loses. The server replays every saved game to check it.",
    needsLogin: true,
  },
  {
    number: 2,
    to: "/nasa",
    title: "Space pictures",
    description:
      "Random pictures from NASA's Astronomy Picture of the Day, explained in Hebrew by an AI - and saved, so each picture is only explained once.",
    needsLogin: true,
  },
  {
    number: 3,
    to: "/design",
    title: "Design",
    description:
      'Our designer\'s mobile design for "Copy That", built from Figma and made responsive together, from a phone up to a wide desktop.',
    needsLogin: false,
  },
];

/**
 * The home page: a way into each part of the assignment.
 *
 * Once you are logged in, it also shows that the server agrees who you are:
 * /api/me checks your token before answering.
 */
export default function HomePage() {
  const { user } = useAuth();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/api/me"),
    // Only ask once we know somebody is logged in.
    enabled: Boolean(user),
  });

  return (
    <main>
      {/* Jerusalem from the Mount of Olives, by Mustang Joe (CC0, public
      domain), from Wikimedia Commons. */}
      <header
        className={styles.hero}
        style={{ backgroundImage: `url(${skyline})` }}
      >
        <h1 className={styles.title}>Flying High</h1>
        <p className={styles.intro}>
          Product Jam, exercise 2: a game, an API and an AI, and a design built
          with a designer.
        </p>
      </header>

      <ul className={styles.parts}>
        {PARTS.map((part) => (
          <li key={part.to}>
            <Link to={part.to} className={styles.partLink}>
              <Card className={styles.part}>
                <p className={styles.partNumber}>Part {part.number}</p>
                <h2 className={styles.partTitle}>{part.title}</h2>
                <p className={styles.partDescription}>{part.description}</p>
                {part.needsLogin && !user ? (
                  <p className={styles.partNote}>You need to log in first.</p>
                ) : null}
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {user ? (
        <>
          <p className={styles.status}>
            The server knows you as:{" "}
            <strong>
              {meQuery.isPending
                ? "Checking..."
                : meQuery.isError
                  ? "Error"
                  : meQuery.data.email}
            </strong>
          </p>
          {/* The kit's worked example, used in answers.md question 1. */}
          <p>
            <Link to="/events">My events</Link>
          </p>
        </>
      ) : (
        <p className={styles.status}>
          <Link to="/signin">Log in</Link> to play and to see the space
          pictures.
        </p>
      )}

      <div className={styles.logos}>
        <img src="/huji.svg" alt="HUJI Logo" width="80" height="80" />
        <img src="/bezalel.svg" alt="Bezalel Logo" width="80" height="80" />
      </div>
    </main>
  );
}
