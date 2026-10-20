import "server-only";
import { randomInt } from "crypto";

// No 0/O/1/I/L so codes can be read out and typed reliably.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 12-character one-time code (~59 bits) for invites and admin-mediated password resets. */
export function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export const MIN_PASSWORD_LENGTH = 8;
