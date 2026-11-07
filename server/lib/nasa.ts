import { FIRST_APOD_DATE } from "@shared/schemas/nasa";
import { z } from "zod";
import { fetchWithTimeout, UpstreamError } from "./upstream";

/*
 * NASA's Astronomy Picture of the Day, from the "APOD Basic" JSON feed on
 * science.nasa.gov (see APOD-APIs-and-RSS-info.pdf). It replaced the old
 * api.nasa.gov/planetary/apod, which in November 2026 answered most dates
 * with a "NASA Science" placeholder instead of the real picture.
 *
 * The feed needs no API key. The browser still never calls it: our server
 * does, so it decides what text Gemini reads.
 */

const FEED_URL = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";
const TIMEOUT_MS = 10_000;

/**
 * One picture, as the feed sends it. We check it rather than trust it: NASA
 * is another server, and if it ever changes shape we want a clear 502, not a
 * crash halfway through building a page.
 */
const apodSchema = z.object({
  date: z.string(),
  title: z.string(),
  media_type: z.string(),
  /** HTML, starting with "<strong>Explanation:</strong>". */
  explanation: z.string(),
  /** HTML, e.g. "<b>Image Credit &amp; Copyright:</b> <a ...>Name</a>". */
  credit: z.string().optional(),
  /** A description of the image, for people who can't see it. Often empty. */
  alt: z.string().optional(),
  /** The picture's page on science.nasa.gov. */
  permalink: z.string(),
  /** The image itself. For a video, a generic NASA thumbnail. */
  hdurl: z.string().optional(),
});

type ApodRaw = z.infer<typeof apodSchema>;

/** A picture, with NASA's HTML already turned into plain text. */
export type Apod = {
  date: string;
  title: string;
  media_type: string;
  explanation: string;
  credit: string | null;
  alt: string | null;
  link_url: string;
  image_url: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * NASA's HTML -> plain text: drops the tags and decodes entities like
 * &amp; and &#8217;. The result is only ever shown as text (React escapes
 * it) or sent to Gemini, never inserted as HTML.
 */
export function htmlToText(html: string): string {
  return (
    html
      // Line and paragraph breaks become spaces. Other tags (links, bold) sit
      // inside sentences, like "Verne<a>'s</a>", so they just disappear.
      .replace(/<br\s*\/?>|<\/p>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
        if (code[0] === "#") {
          const point =
            code[1]?.toLowerCase() === "x"
              ? parseInt(code.slice(2), 16)
              : parseInt(code.slice(1), 10);
          return Number.isFinite(point) && point <= 0x10ffff
            ? String.fromCodePoint(point)
            : entity;
        }
        return ENTITIES[code.toLowerCase()] ?? entity;
      })
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:!?)])/g, "$1")
      .trim()
  );
}

function toApod(raw: ApodRaw): Apod {
  return {
    date: raw.date,
    title: htmlToText(raw.title),
    media_type: raw.media_type,
    explanation: htmlToText(raw.explanation).replace(/^Explanation:\s*/i, ""),
    credit: raw.credit ? htmlToText(raw.credit) || null : null,
    // Older pictures have "See Explanation. Clicking on the picture will
    // download..." instead of a description, which helps nobody.
    alt:
      raw.alt?.trim() && !/^see explanation/i.test(raw.alt.trim())
        ? raw.alt.trim()
        : null,
    link_url: raw.permalink,
    image_url: raw.hdurl || null,
  };
}

/** "2024-01-31" -> "240131", the feed's "legacy APOD date code". */
function dateCode(date: string): string {
  return date.slice(2).replaceAll("-", "");
}

/** The picture for one day, or null if NASA has none for that date. */
export async function getPictureByDate(date: string): Promise<Apod | null> {
  const response = await fetchWithTimeout(
    "NASA",
    `${FEED_URL}/${dateCode(date)}`,
    {},
    TIMEOUT_MS,
  );

  // 404: no picture that day (early APOD skipped days; today may not be up
  // yet). 400: NASA did not accept the date code.
  if (response.status === 404 || response.status === 400) return null;

  if (!response.ok) {
    // Log NASA's own answer for us, but never send it to the user.
    console.error("NASA answered", response.status, await response.text());
    throw nasaFailed();
  }

  const parsed = apodSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    console.error("NASA's answer had an unexpected shape:", parsed.error);
    throw nasaFailed();
  }
  return toApod(parsed.data);
}

/**
 * Up to `count` random pictures. The feed has no "random" option, so we
 * pick random days ourselves and fetch them all at once. Days NASA has no
 * picture for are skipped, which is why it is "up to".
 */
export async function getRandomPictures(count: number): Promise<Apod[]> {
  const outcomes = await Promise.allSettled(
    randomDates(count).map((date) => getPictureByDate(date)),
  );

  const pictures = outcomes.flatMap((outcome) =>
    outcome.status === "fulfilled" && outcome.value ? [outcome.value] : [],
  );
  const failures = outcomes.flatMap((outcome) =>
    outcome.status === "rejected" ? [outcome.reason as unknown] : [],
  );

  // Some pictures are better than none. Only if NASA failed for every one
  // of them does the user get an error - the first one, e.g. a 504.
  if (pictures.length === 0 && failures.length > 0) throw failures[0];
  return pictures.sort((a, b) => b.date.localeCompare(a.date));
}

/** `count` different random days, from the first APOD to today (UTC). */
function randomDates(count: number): string[] {
  const first = Date.parse(`${FIRST_APOD_DATE}T00:00:00Z`);
  const days = Math.floor((Date.now() - first) / 86_400_000) + 1;
  const dates = new Set<string>();
  while (dates.size < Math.min(count, days)) {
    const day = Math.floor(Math.random() * days);
    dates.add(new Date(first + day * 86_400_000).toISOString().slice(0, 10));
  }
  return [...dates];
}

function nasaFailed() {
  return new UpstreamError(
    502,
    "nasa_failed",
    "NASA's picture service is not working right now. Please try again later.",
  );
}
