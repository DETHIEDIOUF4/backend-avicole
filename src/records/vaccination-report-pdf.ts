import PDFDocument from 'pdfkit';

export type VaccinationReportRow = {
  date: Date;
  description: string;
  amount: number;
};

export type VaccinationReportInput = {
  farmName: string;
  roomName: string;
  roomTypeLabel: string;
  managerLabel?: string;
  rows: VaccinationReportRow[];
  generatedAt?: Date;
};

function formatDateFr(value: Date): string {
  return value.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoneyFcfa(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function buildVaccinationReportPdf(input: VaccinationReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generatedAt = input.generatedAt ?? new Date();
    const total = input.rows.reduce((sum, row) => sum + row.amount, 0);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 88).fill('#2f5235');
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold');
    doc.text(input.farmName, 48, 28, { width: pageWidth });
    doc.fontSize(13).font('Helvetica');
    doc.text('Rapport de vaccination', 48, 54);

    doc.fillColor('#1e2a18').fontSize(11).font('Helvetica-Bold');
    doc.text('Informations salle', 48, 108);
    doc.font('Helvetica').fontSize(10).fillColor('#3d4a34');
    doc.text(`Salle : ${input.roomName}`, 48, 126);
    doc.text(`Type : ${input.roomTypeLabel}`, 48, 142);
    if (input.managerLabel) {
      doc.text(`Gérant : ${input.managerLabel}`, 48, 158);
    }
    doc.text(`Document généré le : ${formatDateFr(generatedAt)}`, 48, input.managerLabel ? 174 : 158);

    const tableTop = input.managerLabel ? 200 : 184;
    const colDate = 48;
    const colDesc = 130;
    const colAmount = 430;
    const rowHeight = 22;

    doc.fillColor('#2f5235').rect(48, tableTop, pageWidth, 24).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('Date', colDate + 6, tableTop + 7);
    doc.text('Détail / vaccin', colDesc + 6, tableTop + 7);
    doc.text('Montant', colAmount + 6, tableTop + 7, { width: 110, align: 'right' });

    let y = tableTop + 24;
    doc.font('Helvetica').fontSize(9).fillColor('#1e2a18');

    if (input.rows.length === 0) {
      doc.fillColor('#3d4a34').text('Aucune dépense vaccin enregistrée pour cette salle.', 48, y + 10);
    } else {
      for (const row of input.rows) {
        if (y > doc.page.height - 120) {
          doc.addPage();
          y = 48;
        }
        const bg = input.rows.indexOf(row) % 2 === 0 ? '#f4f7f2' : '#ffffff';
        doc.fillColor(bg).rect(48, y, pageWidth, rowHeight).fill();
        doc.fillColor('#1e2a18');
        doc.text(formatDateFr(row.date), colDate + 6, y + 6, { width: 72 });
        doc.text(truncate(row.description || 'Vaccination', 52), colDesc + 6, y + 6, {
          width: 280,
        });
        doc.text(formatMoneyFcfa(row.amount), colAmount + 6, y + 6, {
          width: 110,
          align: 'right',
        });
        y += rowHeight;
      }

      y += 8;
      doc.strokeColor('#2f5235').lineWidth(1).moveTo(48, y).lineTo(48 + pageWidth, y).stroke();
      y += 10;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Total dépenses vaccin', colDesc + 6, y);
      doc.text(formatMoneyFcfa(total), colAmount + 6, y, { width: 110, align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#3d4a34');
      doc.text(`${input.rows.length} opération(s) de vaccination`, 48, y + 18);
    }

    doc.fontSize(8).fillColor('#6b7a62');
    doc.text(
      'Ce document récapitule les dépenses catégorie « Vaccin » enregistrées pour la salle.',
      48,
      doc.page.height - 48,
      { width: pageWidth, align: 'center' },
    );

    doc.end();
  });
}

export function vaccinationReportFilename(roomName: string, at = new Date()): string {
  const slug = roomName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const day = at.toISOString().slice(0, 10);
  return `rapport-vaccination-${slug || 'salle'}-${day}.pdf`;
}
