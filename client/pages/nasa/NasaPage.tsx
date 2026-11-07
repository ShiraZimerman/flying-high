import type { Picture } from "@shared/schemas/nasa";
import { Button, Card, Spinner } from "../../components";
import { useExplainPicture, usePictures } from "../../features/nasa/hooks";
import { LANG } from "../../lib/config";
import styles from "./NasaPage.module.css";

/**
 * Random pictures from NASA's Astronomy Picture of the Day, each of which
 * can be explained in Hebrew. The page only talks to our server: the NASA
 * and Gemini keys never reach the browser.
 */
export default function NasaPage() {
  const picturesQuery = usePictures();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Space pictures</h1>
          <p className={styles.subtitle}>
            Random pictures from NASA's Astronomy Picture of the Day.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void picturesQuery.refetch()}
          loading={picturesQuery.isFetching}
        >
          New pictures
        </Button>
      </header>

      {picturesQuery.isPending ? (
        <div className={styles.centered}>
          <Spinner size="lg" label="Loading pictures from NASA" />
          <p>Loading pictures from NASA…</p>
        </div>
      ) : picturesQuery.isError ? (
        <Card padding="lg" className={styles.failed}>
          <p role="alert">{picturesQuery.error.message}</p>
          <Button
            variant="secondary"
            onClick={() => void picturesQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      ) : picturesQuery.data.length === 0 ? (
        <Card padding="lg">
          <p className={styles.muted}>NASA sent no pictures this time.</p>
        </Card>
      ) : (
        <ul className={styles.grid}>
          {picturesQuery.data.map((picture, index) => (
            // Random pictures can repeat a date, so the index keeps keys unique.
            <li key={`${picture.date}-${index}`}>
              <PictureCard picture={picture} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function PictureCard({ picture }: { picture: Picture }) {
  const explain = useExplainPicture();

  return (
    <Card padding="none" className={styles.card}>
      {picture.image_url ? (
        <a
          href={picture.link_url}
          target="_blank"
          rel="noreferrer"
          className={styles.imageLink}
        >
          <img
            src={picture.image_url}
            alt={picture.alt ?? picture.title}
            loading="lazy"
            className={styles.image}
          />
          {picture.media_type === "video" ? (
            <span className={styles.badge}>Video</span>
          ) : null}
        </a>
      ) : (
        <div className={styles.noImage}>No picture to show</div>
      )}

      <div className={styles.body}>
        <h2 className={styles.title}>{picture.title}</h2>
        <p className={styles.meta}>
          <time dateTime={picture.date}>{formatDate(picture.date)}</time>
          {picture.credit ? <> · {picture.credit}</> : null}
        </p>
        <p className={styles.explanation}>{picture.explanation}</p>

        {picture.hebrew ? (
          <div className={styles.hebrew} lang="he" dir="rtl">
            <h3 className={styles.hebrewTitle}>{picture.hebrew.title_he}</h3>
            <p>{picture.hebrew.summary_he}</p>
            <ul className={styles.tags} aria-label="Tags">
              {picture.hebrew.tags.map((tag) => (
                <li key={tag} className={styles.tag} dir="ltr">
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={styles.explainRow}>
            <Button
              size="sm"
              loading={explain.isPending}
              onClick={() => explain.mutate(picture.date)}
            >
              {explain.isPending ? "Gemini is thinking…" : "Explain in Hebrew"}
            </Button>
            {explain.isError ? (
              <p className={styles.error} role="alert">
                {explain.error.message}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

function formatDate(date: string): string {
  // Noon UTC, so the day never shifts in the visitor's timezone.
  return new Intl.DateTimeFormat(LANG, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
