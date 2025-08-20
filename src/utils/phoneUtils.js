// src/lib/phoneUtils.js
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// This function will take any phone number format and return it
// in the standard E.164 format (e.g., +212661860891).
// We'll assume a default country if the number is not in international format.
// Replace 'MA' with your own country code if it's different.
export const normalizePhoneNumber = (phoneNumber, defaultCountry = 'MA') => {
  if (!phoneNumber) return null;
  const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry);
  return parsed ? parsed.format('E.164') : phoneNumber; // Fallback to original if parsing fails
};