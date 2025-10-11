import { prisma } from '../src/lib/prisma';
import { recalculateAllBudgets } from '../src/lib/budget-tracking';

async function main() {
  console.log('Starting budget recalculation...');
  
  try {
    const result = await recalculateAllBudgets();
    console.log('\n✅ Budget recalculation complete!');
    console.log(`   Budget items updated: ${result.budgetItemsUpdated}`);
    console.log(`   APPROVED POs processed: ${result.approvedPOsProcessed}`);
    console.log(`   COMPLETED POs processed: ${result.completedPOsProcessed}`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
