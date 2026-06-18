import { PrismaClient } from '@prisma/client';

/**
 * Supprime toutes les données opérationnelles (ventes, dépenses, stocks, entrées, etc.)
 * en conservant : utilisateurs, salles (+ gérants), tokens de session, tarifs de vente.
 *
 * Usage (prod ou local) :
 *   PURGE_CONFIRM=yes npm run db:purge-operations
 */
async function main() {
  if (process.env.PURGE_CONFIRM?.trim().toLowerCase() !== 'yes') {
    console.error(
      'Refusé : définissez PURGE_CONFIRM=yes pour confirmer la suppression de toutes les opérations.',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  await prisma.$connect();

  const [users, rooms] = await Promise.all([
    prisma.user.count(),
    prisma.room.count(),
  ]);

  console.log(`Conservation : ${users} utilisateur(s), ${rooms} salle(s).`);

  const counts = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.deleteMany();
    const pulletIntake = await tx.pulletIntake.deleteMany();
    const layerHenIntake = await tx.layerHenIntake.deleteMany();
    const eggProduction = await tx.eggProduction.deleteMany();
    const mortality = await tx.mortality.deleteMany();
    const expense = await tx.expense.deleteMany();
    const stockMovement = await tx.stockMovement.deleteMany();
    return {
      sale,
      pulletIntake,
      layerHenIntake,
      eggProduction,
      mortality,
      expense,
      stockMovement,
    };
  });

  console.log('Supprimé :');
  console.log(`  - ventes              : ${counts.sale.count}`);
  console.log(`  - entrées poulettes   : ${counts.pulletIntake.count}`);
  console.log(`  - entrées pondeuses   : ${counts.layerHenIntake.count}`);
  console.log(`  - productions œufs    : ${counts.eggProduction.count}`);
  console.log(`  - mortalités          : ${counts.mortality.count}`);
  console.log(`  - dépenses            : ${counts.expense.count}`);
  console.log(`  - mouvements de stock : ${counts.stockMovement.count}`);
  console.log('Terminé. Utilisateurs, salles et paramètres de prix conservés.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
