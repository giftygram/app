// The shop is based in Dubai — a delivery area naming a *different* emirate
// means real drive time, so Operations needs to spot it at a glance and
// dispatch it earlier than a local Dubai order. Matches full names only
// (no short codes like "RAK") to avoid false-positives on unrelated area
// names that happen to contain the same letters.
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

export function isFarEmirate(area: string): boolean {
  const normalized = area.toLowerCase();
  return OTHER_EMIRATE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
