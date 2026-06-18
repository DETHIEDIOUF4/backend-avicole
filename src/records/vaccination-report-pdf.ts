import PDFDocument from 'pdfkit';

export type VaccinationReportRow = {
  date: Date;
  description: string;
};

export type VaccinationReportInput = {
  farmName: string;
  roomName: string;
  roomTypeLabel: string;
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

function wrapRowHeight(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  width: number,
  minHeight: number,
): number {
  const h = doc.heightOfString(text, { width });
  return Math.max(minHeight, h + 10);
}

export function buildVaccinationReportPdf(input: VaccinationReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generatedAt = input.generatedAt ?? new Date();
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(0, 0, doc.page.width, 96).fill('#2f5235');
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold');
    doc.text(input.farmName, 48, 26, { width: pageWidth });
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('Carnet de vaccination ', 48, 52);
    doc.fontSize(10).font('Helvetica');
    // doc.text('Document client (sans montants)', 48, 72);

    doc.fillColor('#1e2a18').fontSize(11).font('Helvetica-Bold');
    doc.text('Identification du lot', 48, 114);
    doc.font('Helvetica').fontSize(10).fillColor('#3d4a34');
    doc.text(`Lot / salle : ${input.roomName}`, 48, 132);
    doc.text(`Type de volaille : ${input.roomTypeLabel}`, 48, 148);
    doc.text(`Édité le : ${formatDateFr(generatedAt)}`, 48, 164);

    const tableTop = 192;
    const colDate = 48;
    const colVaccin = 148;
    const colDateWidth = 88;
    const colVaccinWidth = pageWidth - colDateWidth;

    doc.fillColor('#2f5235').rect(48, tableTop, pageWidth, 24).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('Date', colDate + 6, tableTop + 7);
    doc.text('Vaccin / intervention', colVaccin + 6, tableTop + 7);

    let y = tableTop + 24;
    doc.font('Helvetica').fontSize(9).fillColor('#1e2a18');

    if (input.rows.length === 0) {
      doc.fillColor('#3d4a34').text(
        'Aucune vaccination enregistrée pour ce lot pour le moment.',
        48,
        y + 10,
        { width: pageWidth },
      );
    } else {
      input.rows.forEach((row, index) => {
        const label = row.description?.trim() || 'Vaccination';
        const rowHeight = wrapRowHeight(doc, label, colVaccinWidth - 12, 22);

        if (y + rowHeight > doc.page.height - 72) {
          doc.addPage();
          y = 48;
        }

        const bg = index % 2 === 0 ? '#f4f7f2' : '#ffffff';
        doc.fillColor(bg).rect(48, y, pageWidth, rowHeight).fill();
        doc.fillColor('#1e2a18');
        doc.text(formatDateFr(row.date), colDate + 6, y + 6, { width: colDateWidth - 8 });
        doc.text(label, colVaccin + 6, y + 6, { width: colVaccinWidth - 12 });
        y += rowHeight;
      });

      y += 10;
      doc.font('Helvetica').fontSize(9).fillColor('#3d4a34');
      doc.text(
        `${input.rows.length} vaccination(s) enregistrée(s) pour ce lot.`,
        48,
        y,
      );
    }

    doc.fontSize(8).fillColor('#6b7a62');
    doc.text(
      'Ce document atteste du suivi sanitaire du  (vaccinations et interventions). ' +
        '',
      48,
      doc.page.height - 56,
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
  return `carnet-vaccination-${slug || 'lot'}-${day}.pdf`;
}
