/**
 * Whether text is predominantly Arabic script. Used to pick one font and
 * writing direction for an entire card message rather than mixing per
 * character — the browser's own Unicode BiDi algorithm already places
 * embedded punctuation/emoji correctly once `dir` matches the dominant
 * script, so there's no need to hand-detect those separately.
 */
const ARABIC_RANGES =
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN_RANGES = /[A-Za-z]/g;

export function isArabicText(text: string): boolean {
  const arabicChars = text.match(ARABIC_RANGES);
  const latinChars = text.match(LATIN_RANGES);
  return (arabicChars?.length ?? 0) > (latinChars?.length ?? 0);
}
