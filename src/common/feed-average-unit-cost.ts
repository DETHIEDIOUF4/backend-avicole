import { FeedType } from '@prisma/client';

export type FeedPurchaseCostInput = {
  feedType: FeedType | null;
  feedQuantity: number | null;
  amount: number;
};

/** Prix moyen par sac pour chaque type, d’après les achats enregistrés. */
export function averageFeedUnitCostByType(
  purchases: FeedPurchaseCostInput[],
): Map<FeedType, number> {
  const sums = new Map<FeedType, { amount: number; quantity: number }>();
  for (const row of purchases) {
    if (!row.feedType || row.feedQuantity == null || row.feedQuantity <= 0) {
      continue;
    }
    const prev = sums.get(row.feedType) ?? { amount: 0, quantity: 0 };
    prev.amount += row.amount;
    prev.quantity += row.feedQuantity;
    sums.set(row.feedType, prev);
  }
  const result = new Map<FeedType, number>();
  for (const [feedType, { amount, quantity }] of sums) {
    result.set(feedType, quantity > 0 ? amount / quantity : 0);
  }
  return result;
}
