/**
 * Turns every `.card` currently on the page into one multi-page A6 PDF.
 *
 * A saved PDF prints with none of the browser's own header/footer (URL,
 * date, page count) that `window.print()` is subject to on most
 * browsers/printers — that chrome comes from the print pipeline itself, not
 * from this page, and can't be suppressed from a webpage. Rendering each
 * card to a canvas and assembling a real PDF sidesteps that pipeline
 * entirely: opening or printing the saved file never invokes it.
 *
 * Used for a single order and for a whole day's run, so both come out at
 * identical quality and page size.
 */
const CARD_WIDTH_MM = 105;
const CARD_HEIGHT_MM = 148;

export async function cardsToPdf(
  filename: string,
  onProgress?: (done: number, total: number) => void
) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
  if (cards.length === 0) return;

  const doc = new jsPDF({
    unit: "mm",
    format: [CARD_WIDTH_MM, CARD_HEIGHT_MM],
    orientation: "portrait",
  });

  for (let i = 0; i < cards.length; i++) {
    const canvas = await html2canvas(cards[i], {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    if (i > 0) doc.addPage([CARD_WIDTH_MM, CARD_HEIGHT_MM], "portrait");
    doc.addImage(dataUrl, "JPEG", 0, 0, CARD_WIDTH_MM, CARD_HEIGHT_MM);

    // A day's run can be a hundred canvases; dropping each one's backing
    // store as we go keeps peak memory flat instead of holding them all.
    canvas.width = 0;
    canvas.height = 0;

    onProgress?.(i + 1, cards.length);
    // Yield to the browser so the progress label actually repaints and the
    // tab doesn't look frozen through a long batch.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  doc.save(filename);
}
