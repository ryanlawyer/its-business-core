import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ include: { role: true } });
  console.log('\n=== USERS ===');
  users.forEach(u => console.log(`- ${u.email} (Role: ${u.role.code})`));

  const pos = await prisma.purchaseOrder.findMany({ include: { vendor: true, requestedBy: true } });
  console.log(`\n=== PURCHASE ORDERS (${pos.length}) ===`);
  pos.forEach(po => console.log(`- ${po.poNumber} | Status: ${po.status} | Vendor: ${po.vendor.name} | By: ${po.requestedBy.name}`));

  const budgetItems = await prisma.budgetItem.findMany();
  console.log(`\n=== BUDGET ITEMS (${budgetItems.length}) ===`);
  budgetItems.forEach(b => console.log(`- ${b.code}: ${b.description}`));

  await prisma.$disconnect();
}

check();
