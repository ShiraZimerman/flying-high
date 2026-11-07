import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { fail } from "./errors";

/*
 * Calling another server - NASA, Gemini - from ours.
 *
 * Another server can fail, answer garbage, or not answer at all. None of that
 * is our user's fault, and their status codes and messages mean nothing to
 * our page, so we never pass them on. Instead, every failure becomes an
 * UpstreamError with OUR status code and a message written for our user:
 *
 *   502  they answered, but with an error or something we can't use
 *   503  they told us to slow down (over the free tier's limit)
 *   504  they did not answer in time
 */

export class UpstreamError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;

  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.code = code;
  }
}

/**
 * `fetch`, with a time limit. Throws UpstreamError if the other server
 * cannot be reached or takes longer than `timeoutMs`. Does NOT check the
 * status code: the caller decides what each one means.
 *
 * `name` is for messages, e.g. "NASA".
 */
export async function fetchWithTimeout(
  name: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new UpstreamError(
        504,
        "upstream_timeout",
        `${name} did not answer in time. Please try again.`,
      );
    }
    console.error(`${name} could not be reached:`, error);
    throw new UpstreamError(
      502,
      "upstream_unreachable",
      `Could not reach ${name}. Please try again later.`,
    );
  }
}

/** Turns an UpstreamError into our standard error response. Re-throws anything else. */
export function failUpstream(c: Context, error: unknown) {
  if (error instanceof UpstreamError) {
    return fail(c, error.status, error.code, error.message);
  }
  throw error;
}
