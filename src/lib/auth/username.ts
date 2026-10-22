import { z } from "zod";

/** Sign-in usernames: 3–32 characters, letters, digits, dot, underscore or hyphen; stored lowercase. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "3–32 letters, numbers, dots, underscores or hyphens");

/** Optional username from a form: empty becomes null, anything else must be valid. */
export const optionalUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v ? v : null))
  .pipe(usernameSchema.nullable());

/** Sign-in accepts an email or a username; this says which was typed. */
export function identifierLookup(raw: string): { email: string } | { username: string } {
  const value = raw.trim().toLowerCase();
  return value.includes("@") ? { email: value } : { username: value };
}
