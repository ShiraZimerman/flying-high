import { z } from "zod";

/*
 * Space pictures from NASA's APOD, and their Hebrew explanations from Gemini.
 *
 * hebrewExplanationSchema is the important one: the server checks every
 * answer from Gemini against it before saving, because an LLM does not
 * always do what it is told - even when asked for structured JSON.
 */

/** The day of the first Astronomy Picture of the Day. */
export const FIRST_APOD_DATE = "1995-06-16";

/** The tags Gemini may choose from. Keep in step with the apod_explanations migration. */
export const APOD_TAGS = [
  "galaxy",
  "nebula",
  "star",
  "cluster",
  "planet",
  "moon",
  "sun",
  "earth",
  "comet",
  "asteroid",
  "black-hole",
  "eclipse",
  "aurora",
  "spacecraft",
  "telescope",
] as const;

/** At least one Hebrew letter. */
const HEBREW = /[א-ת]/;

export const hebrewExplanationSchema = z.object({
  title_he: z
    .string()
    .trim()
    .min(1, "The Hebrew title is empty")
    .max(200, "The Hebrew title is too long")
    .regex(HEBREW, "The title is not in Hebrew"),
  summary_he: z
    .string()
    .trim()
    .min(1, "The summary is empty")
    .max(1000, "The summary is too long")
    .regex(HEBREW, "The summary is not in Hebrew"),
  tags: z
    .array(z.enum(APOD_TAGS, "Unknown tag"))
    .min(1, "There must be at least one tag")
    .max(5, "There can be at most 5 tags")
    .refine((tags) => new Set(tags).size === tags.length, "A tag is repeated"),
});

/** POST /api/nasa/explanations. Only the date: the text comes from NASA itself. */
export const explainPictureSchema = z.object({
  date: z.iso
    .date("The date must look like 2024-01-31")
    .refine((date) => date >= FIRST_APOD_DATE, "APOD started on 1995-06-16")
    .refine(
      // Today in UTC. NASA is in the US, so its "today" can be a day behind:
      // the server answers 404 for a date NASA has no picture for yet.
      (date) => date <= new Date().toISOString().slice(0, 10),
      "That date is in the future",
    ),
});

/** GET /api/nasa/pictures?count=20 */
export const picturesQuerySchema = z.object({
  count: z.coerce
    .number("count must be a number")
    .int("count must be a whole number")
    .min(1, "count must be from 1 to 20")
    .max(20, "count must be from 1 to 20")
    .default(20),
});

export const explanationSchema = hebrewExplanationSchema.extend({
  date: z.string(),
});

/** One card on the /nasa page. */
export const pictureSchema = z.object({
  date: z.string(),
  title: z.string(),
  explanation: z.string(),
  media_type: z.string(),
  /** The image, or the thumbnail of a video. Null if there is nothing to show. */
  image_url: z.string().nullable(),
  /** A description of the image for screen readers, when NASA has one. */
  alt: z.string().nullable(),
  /** The picture's page on science.nasa.gov, with the full picture or video. */
  link_url: z.string(),
  /** Who made it, e.g. "Image Credit & Copyright: Marcin Ślipko". */
  credit: z.string().nullable(),
  hebrew: hebrewExplanationSchema.nullable(),
});

export type ApodTag = (typeof APOD_TAGS)[number];
export type HebrewExplanation = z.infer<typeof hebrewExplanationSchema>;
export type Explanation = z.infer<typeof explanationSchema>;
export type Picture = z.infer<typeof pictureSchema>;
