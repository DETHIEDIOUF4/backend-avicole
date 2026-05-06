import { BadRequestException } from '@nestjs/common';

/** Inclusive calendar range for stats; stock snapshots use movements up to end of `to` day. */
export type StatsDateRangeFilter = {
  from: Date;
  /** Last calendar day (UTC midnight), for @db.Date fields */
  toDay: Date;
  /** Upper bound for DateTime fields (e.g. stock occurredAt) */
  toEndInclusive: Date;
};

export function parseStatsDateRange(fromStr?: string, toStr?: string): StatsDateRangeFilter | null {
  const fromRaw = fromStr?.trim();
  const toRaw = toStr?.trim();
  if (!fromRaw && !toRaw) {
    return null;
  }
  if (!fromRaw || !toRaw) {
    throw new BadRequestException(
      'Utilisez les deux paramètres from et to (format YYYY-MM-DD), ou aucun.',
    );
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(fromRaw) || !iso.test(toRaw)) {
    throw new BadRequestException('Format de date invalide : utilisez YYYY-MM-DD.');
  }
  const from = utcMidnight(fromRaw);
  const toDay = utcMidnight(toRaw);
  const toEndInclusive = utcEndOfDay(toRaw);
  if (from.getTime() > toDay.getTime()) {
    throw new BadRequestException(
      'La date de début doit être antérieure ou égale à la date de fin.',
    );
  }
  return { from, toDay, toEndInclusive };
}

export function statsPeriodPayload(range: StatsDateRangeFilter) {
  return {
    from: range.from.toISOString().slice(0, 10),
    to: range.toDay.toISOString().slice(0, 10),
  };
}

function utcMidnight(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcEndOfDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}
