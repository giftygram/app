/**
 * The internal note, deliberately set apart from every other field.
 *
 * This is where instructions that change what actually gets made live —
 * "add 1 red heart shape helium balloon", "this one is free" — and as one
 * more grey row among eight others it was being read straight past. Dark
 * red, bold, a size up from the fields around it, and inside its own
 * bordered box so the eye catches it before it reads anything.
 *
 * Same wording and colour as the printed operations card, so whoever
 * checks the screen and whoever works from the print see the same thing.
 */
export function InternalNote({ value, label = "Internal note" }: { value: string; label?: string }) {
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-red-700">⚠ {label}</p>
      <p className="mt-1 whitespace-pre-line text-base font-bold leading-snug text-red-700">
        {value}
      </p>
    </div>
  );
}
