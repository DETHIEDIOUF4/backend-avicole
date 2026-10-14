import { FeedType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { feedTypeLabel } from '../common/feed-type-labels';

export type FeedPurchaseReportRow = {
  date: Date;
  feedType: FeedType | null;
  feedQuantity: number | null;
  amount: number;
  description?: string | null;
};

export type FeedPurchaseTotalByType = {
  feedType: FeedType;
  quantity: number;
};

export type FeedPurchasesReportInput = {
  farmName: string;
  rows: FeedPurchaseReportRow[];
  totalsByType: FeedPurchaseTotalByType[];
  generatedAt?: Date;
};

function formatDateFr(value: Date): string {
  return value.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(value: number): string {
  return `${Math.round(value)} FCFA`;
}

function formatNumber(value: number): string {
  return String(Math.round(value));
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

export function buildFeedPurchasesReportPdf(input: FeedPurchasesReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generatedAt = input.generatedAt ?? new Date();
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalAmount = input.rows.reduce((sum, row) => sum + row.amount, 0);
    const totalSacs = input.rows.reduce((sum, row) => sum + (row.feedQuantity ?? 0), 0);

    doc.rect(0, 0, doc.page.width, 96).fill('#2f5235');
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold');
    doc.text(input.farmName, 48, 26, { width: pageWidth });
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('Relevé des achats aliment', 48, 52);
    doc.fontSize(10).font('Helvetica');
    doc.text('Stock global (entrepôt) — quantités et montants', 48, 72);

    doc.fillColor('#1e2a18').fontSize(11).font('Helvetica-Bold');
    doc.text('Synthèse', 48, 114);
    doc.font('Helvetica').fontSize(10).fillColor('#3d4a34');
    doc.text(`Édité le : ${formatDateFr(generatedAt)}`, 48, 132);
    doc.text(`Total sacs achetés : ${formatNumber(totalSacs)}`, 48, 148);
    doc.text(`Total dépenses aliment : ${formatMoney(totalAmount)}`, 48, 164);

    let y = 188;
    if (input.totalsByType.length > 0) {
      doc.fillColor('#1e2a18').fontSize(10).font('Helvetica-Bold');
      doc.text('Totaux par type de sac', 48, y);
      y += 18;
      const colType = 48;
      const colQty = pageWidth + 48 - 100;
      const colQtyWidth = 52;
      doc.fillColor('#2f5235').rect(48, y, pageWidth, 22).fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      doc.text('Type de sac', colType + 6, y + 7);
      doc.text('Sacs', colQty + 6, y + 7, { width: colQtyWidth - 8, align: 'right' });
      y += 22;
      doc.font('Helvetica').fontSize(9).fillColor('#1e2a18');
      input.totalsByType.forEach((row, index) => {
        const bg = index % 2 === 0 ? '#f4f7f2' : '#ffffff';
        doc.fillColor(bg).rect(48, y, pageWidth, 20).fill();
        doc.fillColor('#1e2a18');
        doc.text(feedTypeLabel(row.feedType), colType + 6, y + 5);
        doc.text(formatNumber(row.quantity), colQty + 6, y + 5, {
          width: colQtyWidth - 8,
          align: 'right',
        });
        y += 20;
      });
      y += 14;
    }

    const tableTop = y;
    doc.fillColor('#1e2a18').fontSize(10).font('Helvetica-Bold');
    doc.text('Détail des achats', 48, tableTop);
    y = tableTop + 18;

    const colDate = 48;
    const colType = 98;
    const colQty = 198;
    const colAmount = 248;
    const colNote = 318;
    const colDateW = 46;
    const colTypeW = 96;
    const colQtyW = 46;
    const colAmountW = 66;
    const colNoteW = pageWidth + 48 - colNote;

    doc.fillColor('#2f5235').rect(48, y, pageWidth, 24).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
    doc.text('Date', colDate + 4, y + 8);
    doc.text('Type sac', colType + 4, y + 8);
    doc.text('Sacs', colQty + 4, y + 8);
    doc.text('Montant', colAmount + 4, y + 8);
    doc.text('Remarque', colNote + 4, y + 8);
    y += 24;
    doc.font('Helvetica').fontSize(8).fillColor('#1e2a18');

    if (input.rows.length === 0) {
      doc.fillColor('#3d4a34').text(
        'Aucun achat aliment enregistré pour le moment.',
        48,
        y + 10,
        { width: pageWidth },
      );
    } else {
      input.rows.forEach((row, index) => {
        const typeLabel = row.feedType ? feedTypeLabel(row.feedType) : '—';
        const note = row.description?.trim() || '—';
        const rowHeight = Math.max(
          wrapRowHeight(doc, note, colNoteW - 8, 20),
          20,
        );

        if (y + rowHeight > doc.page.height - 72) {
          doc.addPage();
          y = 48;
        }

        const bg = index % 2 === 0 ? '#f4f7f2' : '#ffffff';
        doc.fillColor(bg).rect(48, y, pageWidth, rowHeight).fill();
        doc.fillColor('#1e2a18');
        doc.text(formatDateFr(row.date), colDate + 4, y + 6, { width: colDateW - 6 });
        doc.text(typeLabel, colType + 4, y + 6, { width: colTypeW - 8 });
        doc.text(formatNumber(row.feedQuantity ?? 0), colQty + 4, y + 6, { width: colQtyW - 8 });
        doc.text(formatMoney(row.amount), colAmount + 4, y + 6, { width: colAmountW - 8 });
        doc.text(note, colNote + 4, y + 6, { width: colNoteW - 8 });
        y += rowHeight;
      });

      y += 10;
      doc.fillColor('#e8efe4').rect(48, y, pageWidth, 28).fill();
      doc.fillColor('#1e2a18').font('Helvetica-Bold').fontSize(9);
      doc.text('Total', colType + 4, y + 9);
      doc.text(formatNumber(totalSacs), colQty + 4, y + 9);
      doc.text(formatMoney(totalAmount), colAmount + 4, y + 9);
    }

    doc.fontSize(8).fillColor('#6b7a62');
    doc.text(
      'Achats enregistrés via « Achat aliment » (stock global entrepôt).',
      48,
      doc.page.height - 56,
      { width: pageWidth, align: 'center' },
    );

    doc.end();
  });
}

export function feedPurchasesReportFilename(at = new Date()): string {
  const day = at.toISOString().slice(0, 10);
  return `releve-achats-aliment-${day}.pdf`;
}
