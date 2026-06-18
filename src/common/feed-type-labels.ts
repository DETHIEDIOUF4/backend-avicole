import { FeedType } from '@prisma/client';

export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  [FeedType.DEMARRAGE]: 'Démarrage',
  [FeedType.PREMIER_AGE]: '1er âge',
  [FeedType.DEUXIEME_AGE]: '2ème âge',
  [FeedType.PONTE]: 'Ponte',
  [FeedType.PIQUE_PONTE]: 'Pique ponte',
};

export function feedTypeLabel(feedType: FeedType): string {
  return FEED_TYPE_LABELS[feedType] ?? feedType;
}
