import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

const APP_NAME = 'Ferme Keur Guilaye';
const FRONTEND_URL = 'https://fermekeurguilaye.com';
const API_URL = 'https://backend-avicole.onrender.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '775332077';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '775332077';
const ADMIN_NAME = `${process.env.ADMIN_FIRST_NAME ?? 'Super'} ${process.env.ADMIN_LAST_NAME ?? 'Admin'}`.trim();

function sectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.fillColor('#2f5235').font('Helvetica-Bold').fontSize(12).text(title, 48, y);
  return y + 22;
}

function bodyText(doc: PDFKit.PDFDocument, text: string, y: number, opts?: { bold?: boolean }): number {
  doc
    .fillColor('#1e2a18')
    .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(10)
    .text(text, 48, y, { width: doc.page.width - 96, lineGap: 3 });
  return doc.y + 10;
}

function bulletList(doc: PDFKit.PDFDocument, items: string[], y: number): number {
  doc.font('Helvetica').fontSize(10).fillColor('#3d4a34');
  for (const item of items) {
    if (y > doc.page.height - 72) {
      doc.addPage();
      y = 48;
    }
    doc.text(`• ${item}`, 56, y, { width: doc.page.width - 104, lineGap: 2 });
    y = doc.y + 4;
  }
  return y + 6;
}

async function buildPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 96;
    const today = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    doc.rect(0, 0, doc.page.width, 100).fill('#2f5235');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(APP_NAME, 48, 32);
    doc.fontSize(14).font('Helvetica').text('Mise en production — Guide fonctionnel', 48, 62);

    let y = 118;
    y = bodyText(doc, `Document établi le ${today}. Version livrée en production avec l’ensemble des corrections demandées.`, y);
    y += 4;

    y = sectionTitle(doc, '1. Accès à l’application', y);
    y = bulletList(doc, [
      `Site web : ${FRONTEND_URL}`,
      `API backend : ${API_URL}`,
      'Connexion par numéro de téléphone et mot de passe.',
      'Interface optimisée ordinateur, tablette et smartphone.',
    ], y);

    y = sectionTitle(doc, '2. Compte super administrateur', y);
    y = bulletList(doc, [
      `Nom : ${ADMIN_NAME}`,
      `Rôle : Administrateur (accès complet)`,
      `Téléphone de connexion : ${ADMIN_PHONE}`,
      `Mot de passe initial : ${ADMIN_PASSWORD}`,
      'Recommandation : changer le mot de passe après la première connexion.',
      'Création d’autres admins ou gérants via le menu Équipe.',
    ], y);

    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 48;
    }

    y = sectionTitle(doc, '3. Corrections et améliorations livrées', y);
    y = bulletList(doc, [
      'Stock aliment global par type de sac avec alertes (seuil 50 sacs).',
      'Tableau de bord admin réorganisé (stock et salles en priorité).',
      'Interface mobile optimisée pour les gérants sur téléphone.',
      'Gérants pondeuses : saisie de la récolte d’œufs.',
      'Historique complet pour les gérants (sans filtre de dates).',
      'Carnet de vaccination client en PDF (sans montants, pour les acheteurs).',
    ], y);

    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 48;
    }

    y = sectionTitle(doc, '4. Fonctionnalités — Administrateur', y);
    y = bulletList(doc, [
      'Tableau de bord : stock aliment global, vue par salle, revenus, dépenses, bénéfice, graphiques.',
      'Achat aliment (stock global entrepôt) avec type de sac et quantité.',
      'Salles : création, modification, suppression, filtres, affectation gérant.',
      'Opérations par salle : entrées poulettes/pondeuses, production œufs, mortalité, dépense, utilisation aliment, vente.',
      'Filtre par période sur les indicateurs de salle.',
      'Paramètres : prix unitaires (tablette œufs, poulette, pondeuse).',
      'Équipe : création, modification, suppression utilisateurs ; rôles admin / gérant.',
      'Téléchargement du carnet de vaccination client (PDF) par salle.',
    ], y);

    y = sectionTitle(doc, '5. Fonctionnalités — Gérant', y);
    y = bulletList(doc, [
      'Accès limité à la ou les salles qui lui sont attribuées.',
      'Salles pondeuses : récolte d’œufs (nombre d’œufs cueillis).',
      'Utilisation aliment (type de sac + quantité) — impact sur stock global.',
      'Enregistrement mortalité et ventes (prix appliqué automatiquement).',
      'Historique complet : aliment, ventes, mortalités, récoltes d’œufs (toutes dates).',
      'Carnet de vaccination client (PDF) téléchargeable pour remise aux acheteurs.',
    ], y);

    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 48;
    }

    y = sectionTitle(doc, '6. Données et sécurité', y);
    y = bulletList(doc, [
      'Authentification JWT (session maintenue, déconnexion sécurisée).',
      'Base PostgreSQL hébergée (Neon) — migrations automatiques au déploiement.',
      'Séparation des droits : un gérant ne voit que ses salles.',
      'Montants en FCFA ; stocks œufs en unités ou tablettes selon l’opération.',
    ], y);

    y = sectionTitle(doc, '7. Support et évolutions', y);
    y = bulletList(doc, [
      'En cas de problème de connexion : vérifier téléphone, mot de passe et connexion internet.',
      'Pour créer des gérants : menu Équipe → Nouvel utilisateur → rôle Gérant + salle.',
      'Pour remettre à zéro les opérations (sans supprimer salles/utilisateurs) : script admin db:purge-operations.',
      'Contact technique : support du prestataire ayant livré la solution.',
    ], y);

    doc.fontSize(8).fillColor('#6b7a62').text(
      `${APP_NAME} — Document de mise en production. Usage interne et client.`,
      48,
      doc.page.height - 40,
      { width: pageWidth, align: 'center' },
    );

    doc.end();
  });
}

async function main() {
  const buffer = await buildPdf();
  const outDir = path.resolve(__dirname, '../../../docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'Ferme-Keur-Guilaye-Mise-en-production.pdf');
  fs.writeFileSync(outPath, buffer);
  console.log(`PDF généré : ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
