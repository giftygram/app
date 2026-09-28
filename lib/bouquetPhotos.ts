/**
 * Pairing an order's lines with the photos Operations took of them.
 *
 * Two shapes have to work at once. Orders placed since line items existed
 * have one photo per line, each carrying its orderItemId. Older orders have
 * a single bouquet photo and no lines at all, so they collapse to one
 * unnamed entry — which is exactly what every screen showed before.
 *
 * Photos are expected newest-first (the app's usual `orderBy: createdAt
 * desc`), so the first match for a line is its most recent retake.
 */

type PhotoRow = { id: string; type: string; url: string; orderItemId: string | null };
type ItemRow = { id: string; position: number; name: string; quantity: number; referenceImageUrl: string | null };

export type BouquetSlot = {
  /** Null for a legacy order with no lines. */
  itemId: string | null;
  /** Null when there's nothing more specific to call it than "the bouquet". */
  name: string | null;
  quantity: number;
  referenceImageUrl: string | null;
  photoUrl: string | null;
};

export function bouquetSlots(order: {
  referenceImageUrl?: string | null;
  items?: ItemRow[];
  photos: PhotoRow[];
}): BouquetSlot[] {
  const bouquet = order.photos.filter((p) => p.type === "BOUQUET");
  const items = [...(order.items ?? [])].sort((a, b) => a.position - b.position);

  if (items.length === 0) {
    // No lines recorded: one slot, filled by whatever bouquet photo exists.
    return [
      {
        itemId: null,
        name: null,
        quantity: 1,
        referenceImageUrl: order.referenceImageUrl ?? null,
        photoUrl: bouquet[0]?.url ?? null,
      },
    ];
  }

  return items.map((item) => ({
    itemId: item.id,
    name: item.name,
    quantity: item.quantity,
    referenceImageUrl: item.referenceImageUrl,
    photoUrl: bouquet.find((p) => p.orderItemId === item.id)?.url ?? null,
  }));
}

/** Every photo the customer should see, in line order. */
export function bouquetPhotoUrls(order: Parameters<typeof bouquetSlots>[0]): string[] {
  return bouquetSlots(order)
    .map((slot) => slot.photoUrl)
    .filter((url): url is string => Boolean(url));
}

/**
 * Whether the order is fully photographed — the condition for it becoming
 * READY, since that's when the customer is emailed and shown the photos. A
 * four-item order emailed after one photo would show three gaps.
 */
export function allBouquetsPhotographed(order: Parameters<typeof bouquetSlots>[0]) {
  return bouquetSlots(order).every((slot) => slot.photoUrl !== null);
}
