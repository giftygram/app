// The shop is based in Dubai — a delivery area naming a *different* emirate
// means real drive time, so Operations needs to spot it at a glance and
// dispatch it earlier than a local Dubai order.
const OTHER_EMIRATE_KEYWORDS = [
  "abu dhabi",
  "abudhabi",
  "al ain",
  "sharjah",
  "ajman",
  "umm al quwain",
  "umm al-quwain",
  "ras al khaimah",
  "ras al-khaimah",
  "fujairah",
];

// "RAK" is a common standalone abbreviation for Ras Al Khaimah — matched as
// a whole word only (not a substring) so it doesn't false-positive on some
// unrelated area name that happens to contain those three letters.
const RAK_ABBREVIATION = /\brak\b/i;

export function isFarEmirate(area: string): boolean {
  const normalized = area.toLowerCase();
  if (RAK_ABBREVIATION.test(area)) return true;
  return OTHER_EMIRATE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
