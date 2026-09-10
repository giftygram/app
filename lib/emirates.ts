// The shop is based in Dubai — a delivery area naming a *different* emirate
// means real drive time, so Operations needs to spot it at a glance and
// dispatch it earlier than a local Dubai order. Covers both English and
// Arabic spellings since customers type addresses in either.
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
  "kalba",
  "khor fakkan",
  "khorfakkan",
  // Abu Dhabi
  "أبوظبي",
  "أبو ظبي",
  // Sharjah, and its exclaves (Kalba, Khor Fakkan) which are administered
  // as part of Sharjah but sit on the east coast, hours from Dubai
  "الشارقة",
  "شارقة",
  "كلباء",
  "خورفكان",
  // Ajman
  "عجمان",
  // Fujairah
  "الفجيرة",
  "فجيرة",
  // Ras Al Khaimah
  "رأس الخيمة",
  "راس الخيمة",
  // Umm Al Quwain
  "أم القيوين",
  "ام القيوين",
  // Al Ain
  "العين",
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
