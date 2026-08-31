import { ExpenseCategory, FeedType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { feedTypeLabel } from '../common/feed-type-labels';

export type ExpensesReportRow = {
  date: Date;
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
  feedType?: FeedType | null;
  feedQuantity?: number | null;
};

export type ExpensesReportInput = {
  farmName: string;
  roomName: string;
  roomTypeLabel: string;
  rows: ExpensesReportRow[];
  generatedAt?: Date;
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.FEED]: 'Aliment',
  [ExpenseCategory.VACCINE]: 'Vaccin',
  [ExpenseCategory.APPROVISIONNEMENT]: 'Approvisionnement',
  [ExpenseCategory.OTHER]: 'Autre',
};

function formatDateFr(value: Date): string {
  return value.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function expenseCategoryLabel(row: ExpensesReportRow): string {
  const base = CATEGORY_LABELS[row.category] ?? row.category;
  if (row.category === ExpenseCategory.FEED && row.feedType) {
    const sacs =
      row.feedQuantity != null && row.feedQuantity > 0
        ? ` (${formatNumber(row.feedQuantity)} ${row.feedQuantity === 1 ? 'sac' : 'sacs'})`
        : '';
    return `${base} — ${feedTypeLabel(row.feedType)}${sacs}`;
  }
  if (row.category !== ExpenseCategory.APPROVISIONNEMENT) {
    return base;
  }
  const d = row.description?.trim();
  if (!d) return base;
  const m = d.match(/^Appro\s+de\s+(\d+\s+(?:poulettes?|pondeuses?))\s*\(/i);
  if (m) return `${base} — ${m[1]}`;
  return `${base} — ${d}`;
}

function wrapRowHeight(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  width: number,
  minHeight: number,
): number {
  const h = doc.heightOfString(text, { width });
  return Math.max(minHeight, h + 10);
}

export function buildExpensesReportPdf(input: ExpensesReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generatedAt = input.generatedAt ?? new Date();
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const total = input.rows.reduce((sum, row) => sum + row.amount, 0);

    doc.rect(0, 0, doc.page.width, 96).fill('#2f5235');
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold');
    doc.text(input.farmName, 48, 26, { width: pageWidth });
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('Relevé des dépenses', 48, 52);
    doc.fontSize(10).font('Helvetica');
    doc.text('Historique complet des charges de la salle', 48, 72);

    doc.fillColor('#1e2a18').fontSize(11).font('Helvetica-Bold');
    doc.text('Identification de la salle', 48, 114);
    doc.font('Helvetica').fontSize(10).fillColor('#3d4a34');
    doc.text(`Salle : ${input.roomName}`, 48, 132);
    doc.text(`Type de volaille : ${input.roomTypeLabel}`, 48, 148);
    doc.text(`Édité le : ${formatDateFr(generatedAt)}`, 48, 164);

    const tableTop = 192;
    const colDate = 48;
    const colCategory = 108;
    const colDesc = 228;
    const colAmount = pageWidth + 48 - 88;
    const colDateWidth = 52;
    const colCategoryWidth = 112;
    const colDescWidth = colAmount - colDesc - 8;
    const colAmountWidth = pageWidth + 48 - colAmount;

    doc.fillColor('#2f5235').rect(48, tableTop, pageWidth, 24).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    doc.text('Date', colDate + 4, tableTop + 8);
    doc.text('Catégorie', colCategory + 4, tableTop + 8);
    doc.text('Description', colDesc + 4, tableTop + 8);
    doc.text('Montant', colAmount + 4, tableTop + 8, { width: colAmountWidth - 8, align: 'right' });

    let y = tableTop + 24;
    doc.font('Helvetica').fontSize(8).fillColor('#1e2a18');

    if (input.rows.length === 0) {
      doc.fillColor('#3d4a34').text(
        'Aucune dépense enregistrée pour cette salle pour le moment.',
        48,
        y + 10,
        { width: pageWidth },
      );
    } else {
      input.rows.forEach((row, index) => {
        const categoryLabel = expenseCategoryLabel(row);
        const description = row.description?.trim() || '—';
        const rowHeight = Math.max(
          wrapRowHeight(doc, categoryLabel, colCategoryWidth - 8, 20),
          wrapRowHeight(doc, description, colDescWidth - 8, 20),
          20,
        );

        if (y + rowHeight > doc.page.height - 96) {
          doc.addPage();
          y = 48;
        }

        const bg = index % 2 === 0 ? '#f4f7f2' : '#ffffff';
        doc.fillColor(bg).rect(48, y, pageWidth, rowHeight).fill();
        doc.fillColor('#1e2a18');
        doc.text(formatDateFr(row.date), colDate + 4, y + 6, { width: colDateWidth - 6 });
        doc.text(categoryLabel, colCategory + 4, y + 6, { width: colCategoryWidth - 8 });
        doc.text(description, colDesc + 4, y + 6, { width: colDescWidth - 8 });
        doc.text(formatMoney(row.amount), colAmount + 4, y + 6, {
          width: colAmountWidth - 8,
          align: 'right',
        });
        y += rowHeight;
      });

      y += 12;
      doc.fillColor('#e8efe4').rect(48, y, pageWidth, 28).fill();
      doc.fillColor('#1e2a18').font('Helvetica-Bold').fontSize(10);
      doc.text('Total des dépenses', colDesc + 4, y + 9);
      doc.text(formatMoney(total), colAmount + 4, y + 9, {
        width: colAmountWidth - 8,
        align: 'right',
      });
      y += 36;
      doc.font('Helvetica').fontSize(9).fillColor('#3d4a34');
      doc.text(`${input.rows.length} dépense(s) enregistrée(s) pour cette salle.`, 48, y);
    }

    doc.fontSize(8).fillColor('#6b7a62');
    doc.text(
      'Ce document récapitule les dépenses liées à la salle (hors achats aliment globaux).',
      48,
      doc.page.height - 56,
      { width: pageWidth, align: 'center' },
    );

    doc.end();
  });
}

export function expensesReportFilename(roomName: string, at = new Date()): string {
  const slug = roomName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const day = at.toISOString().slice(0, 10);
  return `depenses-${slug || 'salle'}-${day}.pdf`;
}
