import {
  explainPictureSchema,
  picturesQuerySchema,
  type Explanation,
  type HebrewExplanation,
  type Picture,
} from "@shared/schemas/nasa";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { fail, validate } from "../lib/errors";
import { explainInHebrew, GEMINI_MODEL } from "../lib/gemini";
import { getPictureByDate, getRandomPictures } from "../lib/nasa";
import { createAdminClient } from "../lib/supabase";
import { failUpstream } from "../lib/upstream";

/*
 * Space pictures from NASA, explained in Hebrew by Gemini. See docs/design.md.
 *
 * The browser only ever talks to these routes. The Gemini key stays on the
 * server, and so does the decision of what text Gemini reads: the browser
 * sends a date, and we fetch that day's text from NASA ourselves.
 */

const EXPLANATION_COLUMNS = "date, title_he, summary_he, tags";

export const nasa = new Hono<AppEnv>()

  // GET /api/nasa/pictures?count=20 - random pictures, with any saved
  // Hebrew explanation already attached.
  .get("/pictures", validate("query", picturesQuerySchema), async (c) => {
    const { count } = c.req.valid("query");

    let apods;
    try {
      apods = await getRandomPictures(count);
    } catch (error) {
      return failUpstream(c, error);
    }

    const { data: saved, error } = await createAdminClient(c.env)
      .from("apod_explanations")
      .select(EXPLANATION_COLUMNS)
      .in(
        "date",
        apods.map((apod) => apod.date),
      );

    if (error) {
      console.error("load explanations failed:", error);
      return fail(c, 500, "database_error", "Could not load the pictures.");
    }

    const hebrewByDate = new Map<string, HebrewExplanation>(
      saved.map(({ date, ...hebrew }) => [date, hebrew as HebrewExplanation]),
    );

    const pictures: Picture[] = apods.map((apod) => ({
      ...apod,
      hebrew: hebrewByDate.get(apod.date) ?? null,
    }));

    return c.json({ pictures });
  })

  // POST /api/nasa/explanations - explain one picture in Hebrew. Saved
  // answers are returned as they are, so we never pay Gemini twice.
  .post("/explanations", validate("json", explainPictureSchema), async (c) => {
    const { date } = c.req.valid("json");
    const supabase = createAdminClient(c.env);

    const existing = await supabase
      .from("apod_explanations")
      .select(EXPLANATION_COLUMNS)
      .eq("date", date)
      .maybeSingle();

    if (existing.error) {
      console.error("load explanation failed:", existing.error);
      return fail(c, 500, "database_error", "Could not load the explanation.");
    }
    if (existing.data) return c.json(existing.data satisfies Explanation);

    let hebrew;
    try {
      // The text comes from NASA, not from the browser, so a user cannot
      // make Gemini "explain" text of their own and save it for everyone.
      const apod = await getPictureByDate(date);
      if (!apod) {
        return fail(c, 404, "not_found", "NASA has no picture for that date.");
      }
      hebrew = await explainInHebrew(c.env.GEMINI_API_KEY, {
        title: apod.title,
        explanation: apod.explanation,
      });
    } catch (error) {
      return failUpstream(c, error);
    }

    // If someone else saved this date while we were waiting for Gemini,
    // keep theirs: skip the insert, then read back whichever row is saved.
    const insert = await supabase
      .from("apod_explanations")
      .upsert(
        { date, ...hebrew, model: GEMINI_MODEL },
        { onConflict: "date", ignoreDuplicates: true },
      );

    if (insert.error) {
      console.error("save explanation failed:", insert.error);
      return fail(c, 500, "database_error", "Could not save the explanation.");
    }

    const { data, error } = await supabase
      .from("apod_explanations")
      .select(EXPLANATION_COLUMNS)
      .eq("date", date)
      .single();

    if (error) {
      console.error("reload explanation failed:", error);
      return fail(c, 500, "database_error", "Could not load the explanation.");
    }
    return c.json(data satisfies Explanation);
  });
