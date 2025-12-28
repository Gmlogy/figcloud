// src/lib/phoneUtils.js
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalize ONLY when the number is explicitly international.
 * - If it starts with '+', normalize to E.164.
 * - If it starts with '00', convert to '+' then normalize.
 * - Otherwise (no '+'), return the number as-is (no country guessing).
 *
 * This prevents "+212" being auto-added for numbers like "665".
 */
export const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;

  const raw = String(phoneNumber).trim();
  if (!raw) return null;

  // Keep short codes / service codes untouched (optional but safe)
  // Examples: 665, 5555, *123#, #31#, etc.
  if (/^[0-9*#]{1,10}$/.test(raw)) return raw;

  // Convert 00-prefixed international numbers to +
  // Example: 00212661860891 -> +212661860891
  let candidate = raw;
  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  }

  // Only normalize if user explicitly provided an international format
  if (!candidate.startsWith("+")) {
    return raw; // ✅ no default country guessing
  }

  const parsed = parsePhoneNumberFromString(candidate);
  return parsed ? parsed.format("E.164") : raw;
};

/**
 * If you still want a "best effort" formatter for display (optional),
 * keep it conservative. This keeps local numbers unchanged.
 */
export const formatPhoneForDisplay = (phoneNumber) => {
  if (!phoneNumber) return "";
  return String(phoneNumber).trim();
};
