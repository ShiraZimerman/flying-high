import { describe, expect, it } from "vitest";
import { explainPictureSchema, hebrewExplanationSchema } from "./nasa";

/*
 * hebrewExplanationSchema is what stands between Gemini and the database.
 * These tests are answers Gemini could really give.
 */

const valid = {
  title_he: "ערפילית אוריון",
  summary_he: "זה ענן ענק של גז ואבק בחלל. בתוכו נולדים כוכבים חדשים.",
  tags: ["nebula", "star"],
};

describe("hebrewExplanationSchema", () => {
  it("accepts a Hebrew title, summary and known tags", () => {
    expect(hebrewExplanationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a tag that is not on the list", () => {
    const result = hebrewExplanationSchema.safeParse({
      ...valid,
      tags: ["hacked"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects no tags, and more than 5", () => {
    expect(
      hebrewExplanationSchema.safeParse({ ...valid, tags: [] }).success,
    ).toBe(false);
    const six = ["galaxy", "nebula", "star", "cluster", "planet", "moon"];
    expect(
      hebrewExplanationSchema.safeParse({ ...valid, tags: six }).success,
    ).toBe(false);
  });

  it("rejects a repeated tag", () => {
    const result = hebrewExplanationSchema.safeParse({
      ...valid,
      tags: ["star", "star"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a summary that is not in Hebrew", () => {
    const result = hebrewExplanationSchema.safeParse({
      ...valid,
      summary_he: "A big cloud of gas.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing field", () => {
    const missing = { title_he: valid.title_he, tags: valid.tags };
    expect(hebrewExplanationSchema.safeParse(missing).success).toBe(false);
  });
});

describe("explainPictureSchema", () => {
  it("accepts a real APOD date", () => {
    expect(explainPictureSchema.safeParse({ date: "2024-01-31" }).success).toBe(
      true,
    );
  });

  it.each(["1995-06-15", "2999-01-01", "2024-02-30", "yesterday"])(
    "rejects %s",
    (date) => {
      expect(explainPictureSchema.safeParse({ date }).success).toBe(false);
    },
  );
});
