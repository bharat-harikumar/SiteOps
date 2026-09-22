// No 0/O, 1/l/I — the admin reads this out or types it for the user.
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const LENGTH = 14;

export function generateTempPassword(): string {
  const bytes = new Uint32Array(LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => TEMP_PASSWORD_ALPHABET[n % TEMP_PASSWORD_ALPHABET.length]).join("");
}
