import { z } from "zod";

// One password rule for account creation, admin reset and self-service change,
// shared by the Zod schemas and the client forms so they cannot drift.
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // bcrypt hard-caps at 72 bytes

export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= PASSWORD_MIN;
}
