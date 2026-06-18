import { FeedType, StockDirection, StockItemType } from '@prisma/client';

export const FEED_STOCK_ALERT_THRESHOLD = 50;

type FeedStockMove = {
  direction: StockDirection;
  quantity: number;
  feedType: FeedType | null;
};

/** Stock global par type de sac (mouvements FEED sans salle). */
export function aggregateGlobalFeedStock(
  moves: FeedStockMove[],
): Record<string, number> {
  return moves.reduce<Record<string, number>>((acc, move) => {
    if (!move.feedType) {
      return acc;
    }
    const sign = move.direction === StockDirection.IN ? 1 : -1;
    acc[move.feedType] = (acc[move.feedType] ?? 0) + sign * move.quantity;
    return acc;
  }, {});
}

export function feedTypesBelowThreshold(
  stockByFeedType: Record<string, number>,
  threshold = FEED_STOCK_ALERT_THRESHOLD,
): FeedType[] {
  return (Object.values(FeedType) as FeedType[]).filter(
    (type) => (stockByFeedType[type] ?? 0) < threshold,
  );
}
