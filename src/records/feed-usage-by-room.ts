import { FeedType, RoomType } from '@prisma/client';
import { averageFeedUnitCostByType, type FeedPurchaseCostInput } from '../common/feed-average-unit-cost';
import { feedTypeLabel } from '../common/feed-type-labels';

export type FeedConsumptionMovement = {
  roomId: string;
  occurredAt: Date;
  feedType: FeedType | null;
  quantity: number;
  notes: string | null;
};

export type RoomInfo = {
  id: string;
  name: string;
  type: RoomType;
};

export type FeedUsageDetailRow = {
  date: Date;
  feedType: FeedType;
  quantity: number;
  unitCost: number;
  lineCost: number;
  notes?: string | null;
};

export type FeedUsageTotalByType = {
  feedType: FeedType;
  quantity: number;
  cost: number;
};

export type RoomFeedUsageSection = {
  roomId: string;
  roomName: string;
  roomTypeLabel: string;
  detailRows: FeedUsageDetailRow[];
  totalsByType: FeedUsageTotalByType[];
  totalSacs: number;
  totalCost: number;
};

export function buildRoomFeedUsageSections(
  rooms: RoomInfo[],
  movements: FeedConsumptionMovement[],
  purchases: FeedPurchaseCostInput[],
): RoomFeedUsageSection[] {
  const unitCostByType = averageFeedUnitCostByType(purchases);
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  const byRoom = new Map<string, FeedUsageDetailRow[]>();
  for (const move of movements) {
    if (!move.roomId || !move.feedType) continue;
    const unitCost = unitCostByType.get(move.feedType) ?? 0;
    const lineCost = unitCost * move.quantity;
    const rows = byRoom.get(move.roomId) ?? [];
    rows.push({
      date: move.occurredAt,
      feedType: move.feedType,
      quantity: move.quantity,
      unitCost,
      lineCost,
      notes: move.notes,
    });
    byRoom.set(move.roomId, rows);
  }

  const sections: RoomFeedUsageSection[] = [];
  for (const room of rooms) {
    const detailRows = (byRoom.get(room.id) ?? []).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    const totalsMap = new Map<FeedType, { quantity: number; cost: number }>();
    for (const row of detailRows) {
      const prev = totalsMap.get(row.feedType) ?? { quantity: 0, cost: 0 };
      prev.quantity += row.quantity;
      prev.cost += row.lineCost;
      totalsMap.set(row.feedType, prev);
    }
    const totalsByType = [...totalsMap.entries()]
      .map(([feedType, totals]) => ({
        feedType,
        quantity: totals.quantity,
        cost: totals.cost,
      }))
      .sort((a, b) => feedTypeLabel(a.feedType).localeCompare(feedTypeLabel(b.feedType)));

    sections.push({
      roomId: room.id,
      roomName: room.name,
      roomTypeLabel: room.type === RoomType.PULLET ? 'Poulettes' : 'Pondeuses',
      detailRows,
      totalsByType,
      totalSacs: detailRows.reduce((sum, row) => sum + row.quantity, 0),
      totalCost: detailRows.reduce((sum, row) => sum + row.lineCost, 0),
    });
  }

  return sections.sort((a, b) => a.roomName.localeCompare(b.roomName, 'fr'));
}
