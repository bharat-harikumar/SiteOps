import { ERROR_CODES } from '@/lib/errors/codes';

// User-facing copy keyed by the API's stable error code. Keeps developer/DB
// strings (validation internals, constraint names, GoTrue text) out of toasts —
// copy is controllable, localizable, and never leaks system detail (Part 6).
const FRIENDLY_COPY: Record<string, string> = {
  [ERROR_CODES.VALIDATION_ERROR]: 'Please check the form and try again.',
  [ERROR_CODES.INVALID_REQUEST]: 'That request could not be processed.',
  [ERROR_CODES.MISSING_FIELD]: 'Some required information is missing.',
  [ERROR_CODES.RATE_LIMITED]: 'Too many attempts — please wait a moment and try again.',
  [ERROR_CODES.UNAUTHORIZED]: 'Your session has expired. Please sign in again.',
  [ERROR_CODES.FORBIDDEN]: "You don't have permission to do that.",
  [ERROR_CODES.NOT_FOUND]: 'We couldn’t find what you were looking for.',
  [ERROR_CODES.RESOURCE_NOT_FOUND]: 'We couldn’t find what you were looking for.',
  [ERROR_CODES.CONFLICT]: 'That action conflicts with the current state — please refresh and retry.',
  [ERROR_CODES.INTERNAL_ERROR]: 'Something went wrong — please try again.',
  [ERROR_CODES.DATABASE_ERROR]: 'Something went wrong — please try again.',
  [ERROR_CODES.UNKNOWN_ERROR]: 'Something went wrong — please try again.',
};

export const GENERIC_ERROR_COPY = 'Something went wrong — please try again.';

// Only these codes carry a message written for the user: every VALIDATION_ERROR
// and CONFLICT the API sends is curated copy ("Invalid Work Stage: …", "Another
// item with this name already exists"), never a DB or framework string. Every
// other code (server faults, auth, not-found) keeps the fixed copy above.
const SERVER_MESSAGE_CODES = new Set<string>([ERROR_CODES.VALIDATION_ERROR, ERROR_CODES.CONFLICT]);
const MAX_SERVER_MESSAGE_LENGTH = 120;
// Messages that say nothing more than the fixed copy, or are the client's own
// fallback when the server sent none (it embeds the HTTP status).
const NON_SPECIFIC_MESSAGES = /^(one or more fields are invalid|request failed)/i;

function specificServerMessage(code: string | undefined, message: string | undefined) {
  if (!code || !SERVER_MESSAGE_CODES.has(code) || !message) return null;
  const text = message.trim();
  if (!text || text.length > MAX_SERVER_MESSAGE_LENGTH || NON_SPECIFIC_MESSAGES.test(text)) return null;
  return text;
}

// Resolve user-facing copy from a code. For validation/conflict errors a short,
// specific server message wins, so the user learns what to fix; otherwise the
// friendly copy, then the generic message. Never a status code or a raw backend
// string from any other code.
export function friendlyErrorMessage(code?: string, serverMessage?: string): string {
  const specific = specificServerMessage(code, serverMessage);
  if (specific) return specific;
  if (code && code in FRIENDLY_COPY) return FRIENDLY_COPY[code];
  return GENERIC_ERROR_COPY;
}
