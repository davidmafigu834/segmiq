import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Human-friendly temporary password for admin-provisioned logins. */
export function generateTemporaryPassword(length = 12): string {
  return randomBytes(Math.ceil(length * 0.75))
    .toString("base64url")
    .slice(0, length);
}
