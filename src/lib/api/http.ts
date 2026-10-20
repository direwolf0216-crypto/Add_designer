import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/** Throw from route/service code to return a specific status with a client-safe message. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = () => new HttpError(401, "Unauthorized");
export const forbidden = (message = "Forbidden") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const tooManyRequests = (message = "Too many requests. Please try again later.") => new HttpError(429, message);

/** Map any thrown value to a JSON response without leaking internals. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      error.details !== undefined ? { error: error.message, details: error.details } : { error: error.message },
      { status: error.status }
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid request", details: z.flattenError(error).fieldErrors }, { status: 422 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error.code === "P2002") return NextResponse.json({ error: "A record with these details already exists" }, { status: 409 });
    if (error.code === "P2003") return NextResponse.json({ error: "This record is still referenced by other data" }, { status: 409 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

type RouteContext<P> = { params: Promise<P> };

/**
 * Wrap a route handler so thrown HttpError / ZodError / Prisma errors become consistent JSON responses.
 *
 *   export const GET = route(async (req, { params }) => { ... return NextResponse.json(data) })
 */
export function route<P = Record<string, string>>(
  handler: (req: Request, ctx: RouteContext<P>) => Promise<Response>
) {
  return async (req: Request, ctx: RouteContext<P>) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Parse and validate a JSON body. Requires a JSON content type so cross-site form posts are rejected. */
export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  return schema.parse(await req.json());
}

/** Read an integer query param clamped to [min, max]. */
export function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(url.searchParams.get(name) ?? "", 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

/** Uniform shape for paginated list endpoints. */
export function listResponse<T>(items: T[], total: number, page: number, pageSize: number) {
  return NextResponse.json({ items, total, page, pageSize });
}
