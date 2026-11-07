import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../env";
import { htmlToText } from "../lib/nasa";
import { nasa } from "./nasa";

/*
 * NASA and Gemini are other servers, and they fail. These tests replace both
 * with fakes (through `fetch`) and check that our server answers with its
 * own clear errors - and never pays Gemini twice for the same picture.
 */

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "test",
  NASA_API_KEY: "unused",
  GEMINI_API_KEY: "gemini-key",
};

/** The apod_explanations table, as a Map from date to row. */
const table = new Map<string, Record<string, unknown>>();

vi.mock("../lib/supabase", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, date: string) => ({
          maybeSingle: async () => ({
            data: table.get(date) ?? null,
            error: null,
          }),
          single: async () => ({ data: table.get(date) ?? null, error: null }),
        }),
        in: async (_column: string, dates: string[]) => ({
          data: dates.flatMap((date) => table.get(date) ?? []),
          error: null,
        }),
      }),
      upsert: async (row: Record<string, unknown> & { date: string }) => {
        if (!table.has(row.date)) table.set(row.date, row);
        return { error: null };
      },
    }),
  }),
}));

const app = new Hono<AppEnv>()
  .use(async (c, next) => {
    c.set("user", { id: "user-1", email: "a@test.dev" });
    await next();
  })
  .route("/api/nasa", nasa);

/** One picture, the way NASA's APOD Basic feed sends it. */
const apod = {
  date: "2024-01-31",
  post_id: 1231386,
  title: "Camera Orion Rising",
  permalink: "https://science.nasa.gov/image-article/apod-2024-january-31/",
  media_type: "image",
  explanation:
    '<strong>Explanation:</strong> What does <a href="https://x">Orion</a> rising look like?',
  credit:
    '<b> Image Credit &amp; Copyright: </b> <a href="https://x">Marcin Ślipko</a>',
  alt: "A snowy landscape.",
  url: "https://science.nasa.gov/image-article/apod-2024-january-31/",
  hdurl: "https://assets.science.nasa.gov/orion.jpg",
};

const hebrew = {
  title_he: "אוריון עולה",
  summary_he: "קבוצת הכוכבים אוריון עולה בשמיים. רואים בה ערפיליות אדומות.",
  tags: ["star", "nebula"],
};

function geminiAnswer(json: unknown) {
  return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
  });
}

/** What the fake NASA answers, for any date. Tests replace it. */
let nasaAnswer: () => Response | Promise<Response>;
/** What the fake Gemini answers. Tests replace it. */
let geminiAnswerFn: () => Response;
const calls: { url: string; body?: string }[] = [];

beforeEach(() => {
  table.clear();
  calls.length = 0;
  nasaAnswer = () => Response.json(apod);
  geminiAnswerFn = () => geminiAnswer(hebrew);
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body as string | undefined });
    if (url.startsWith("https://science.nasa.gov/")) return nasaAnswer();
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      return geminiAnswerFn();
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const nasaCalls = () => calls.filter((c) => c.url.includes("science.nasa.gov"));
const geminiCalls = () => calls.filter((c) => c.url.includes("googleapis"));

function explain(date: string) {
  return app.request(
    "/api/nasa/explanations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    },
    env,
  );
}

describe("htmlToText", () => {
  it("drops tags and decodes entities", () => {
    expect(htmlToText(apod.credit)).toBe(
      "Image Credit & Copyright: Marcin Ślipko",
    );
    expect(htmlToText("It&#8217;s a <i>comet</i> .")).toBe("It’s a comet.");
  });
});

describe("GET /api/nasa/pictures", () => {
  it("asks NASA for `count` random days, as plain text, with saved Hebrew", async () => {
    table.set(apod.date, { date: apod.date, ...hebrew });

    const response = await app.request("/api/nasa/pictures?count=1", {}, env);
    const body = (await response.json()) as { pictures: unknown[] };
    expect(response.status).toBe(200);
    expect(nasaCalls()).toHaveLength(1);
    expect(body.pictures[0]).toEqual({
      date: apod.date,
      title: "Camera Orion Rising",
      media_type: "image",
      explanation: "What does Orion rising look like?",
      credit: "Image Credit & Copyright: Marcin Ślipko",
      alt: "A snowy landscape.",
      link_url: apod.permalink,
      image_url: apod.hdurl,
      hebrew,
    });
  });

  it("skips days NASA has no picture for", async () => {
    nasaAnswer = () => new Response("{}", { status: 404 });
    const response = await app.request("/api/nasa/pictures?count=5", {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pictures: [] });
  });

  it("answers 502, not NASA's own status, when NASA fails", async () => {
    nasaAnswer = () => new Response("Forbidden", { status: 403 });
    const response = await app.request("/api/nasa/pictures", {}, env);
    expect(response.status).toBe(502);
  });

  it("answers 502 when NASA's answer has an unexpected shape", async () => {
    nasaAnswer = () => Response.json({ hello: "world" });
    const response = await app.request("/api/nasa/pictures", {}, env);
    expect(response.status).toBe(502);
  });

  it("answers 504 when NASA does not answer in time", async () => {
    nasaAnswer = () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    };
    const response = await app.request("/api/nasa/pictures", {}, env);
    expect(response.status).toBe(504);
  });

  it("answers 400 for a count over 20", async () => {
    const response = await app.request("/api/nasa/pictures?count=21", {}, env);
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });
});

describe("POST /api/nasa/explanations", () => {
  it("asks NASA, then Gemini, and saves the answer", async () => {
    const response = await explain(apod.date);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(hebrew);
    expect(table.get(apod.date)).toMatchObject(hebrew);

    expect(nasaCalls()[0]?.url).toMatch(/\/apod-basic\/240131$/);
    // Gemini got NASA's text, as plain text - not anything from the browser.
    expect(geminiCalls()[0]?.body).toContain(
      "What does Orion rising look like?",
    );
  });

  it("never pays twice: a saved picture calls neither NASA nor Gemini", async () => {
    table.set(apod.date, { date: apod.date, ...hebrew });
    const response = await explain(apod.date);
    expect(response.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("answers 502 and saves nothing when Gemini's answer breaks the schema", async () => {
    geminiAnswerFn = () => geminiAnswer({ ...hebrew, tags: ["hacked"] });
    const response = await explain(apod.date);
    expect(response.status).toBe(502);
    expect(table.size).toBe(0);
  });

  it("answers 503 when Gemini is over its limit", async () => {
    geminiAnswerFn = () => new Response("{}", { status: 429 });
    expect((await explain(apod.date)).status).toBe(503);
  });

  it("answers 404 when NASA has no picture for the date", async () => {
    nasaAnswer = () => new Response("{}", { status: 404 });
    expect((await explain(apod.date)).status).toBe(404);
    expect(geminiCalls()).toEqual([]);
  });

  it("answers 400 for a date before APOD began", async () => {
    expect((await explain("1990-01-01")).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
