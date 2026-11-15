import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids come from the URL; a malformed one is simply a record that does not exist. */
export function assertUuid(id: string) {
  if (!UUID_RE.test(id)) throw new HttpError("Not found", 404);
}

export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "HttpError";
  }
}

/** Wrap a route handler so any failure becomes a JSON error instead of an HTML 500. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) return jsonError(error.message, error.status);
      console.error("API request failed", error instanceof Error ? error.message : error);
      return jsonError("Something went wrong. Please try again.", 500);
    }
  };
}
