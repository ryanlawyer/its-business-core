import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🏠 Seeding Group Home LTC test data...');
  console.log('   This is ADDITIVE — existing data will not be deleted.\n');

  // ============================================
  // FISCAL YEAR
  // ============================================
  console.log('📅 Creating FY2026...');
  await prisma.fiscalYear.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'OPEN',
    },
  });

  // ============================================
  // DEPARTMENTS (10)
  // ============================================
  console.log('🏢 Creating departments...');

  const departmentData = [
    { name: 'Corporate Office', description: 'Executive administration and corporate operations' },
    { name: 'Elm Street Home', description: '8-bed residential group home' },
    { name: 'Maple Court Home', description: '8-bed residential group home' },
    { name: 'Cedar Ridge Home', description: '8-bed residential group home' },
    { name: 'Birch Lane Home', description: '8-bed residential group home' },
    { name: 'Oak Haven Home', description: '10-bed residential group home' },
    { name: 'Pine View Home', description: '6-bed residential group home' },
    { name: 'Willow Creek Home', description: '8-bed residential group home' },
    { name: 'Aspen Heights Home', description: '6-bed residential group home' },
    { name: 'Horizons Day Program', description: 'Community-based day habilitation program' },
  ];

  const departments: Record<string, { id: string }> = {};
  for (const dept of departmentData) {
    const d = await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: dept,
    });
    departments[dept.name] = d;
  }

  // ============================================
  // BUDGET CATEGORIES (14)
  // ============================================
  console.log('📂 Creating budget categories...');

  const categoryData = [
    { code: 'FOOD', name: 'Food & Dietary', description: 'Groceries, meal supplies, dietary supplements, and food service' },
    { code: 'MED', name: 'Medical Supplies & Pharmacy', description: 'OTC medications, first aid, incontinence supplies, pharmacy' },
    { code: 'UTIL', name: 'Utilities', description: 'Electric, gas, water, sewer, and trash services' },
    { code: 'MAINT', name: 'Maintenance & Repairs', description: 'Building maintenance, HVAC, plumbing, and general repairs' },
    { code: 'TRANS', name: 'Transportation & Vehicle', description: 'Vehicle fuel, maintenance, insurance, and transit services' },
    { code: 'INS', name: 'Insurance', description: 'Property, liability, workers comp, and professional liability' },
    { code: 'TRAIN', name: 'Training & Certification', description: 'Staff training, CPR/First Aid, MANDT, and continuing education' },
    { code: 'ACT', name: 'Activities & Recreation', description: 'Community outings, recreation supplies, and therapeutic activities' },
    { code: 'OFFICE', name: 'Office & Administrative', description: 'Office supplies, printing, postage, and administrative costs' },
    { code: 'IT', name: 'Technology & Communications', description: 'Computers, software, phones, internet, and IT support' },
    { code: 'PROF', name: 'Professional Services', description: 'Accounting, legal, consulting, and contracted professional services' },
    { code: 'LIC', name: 'Licensing & Compliance', description: 'State licensing fees, accreditation, and regulatory compliance' },
    { code: 'FURN', name: 'Furniture & Equipment', description: 'Beds, furniture, appliances, and durable medical equipment' },
    { code: 'CLEAN', name: 'Housekeeping & Cleaning', description: 'Cleaning supplies, laundry, linen service, and janitorial' },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const cat of categoryData) {
    const c = await prisma.budgetCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
    categories[cat.code] = c;
  }

  // ============================================
  // VENDORS (~25)
  // ============================================
  console.log('🏪 Creating vendors...');

  const vendorData = [
    { vendorNumber: 'GH-V001', name: 'Sysco Food Services', phone: '800-555-0101', email: 'orders@sysco.example.com', address: '1200 Commerce Blvd', city: 'Houston', state: 'TX', zipCode: '77001' },
    { vendorNumber: 'GH-V002', name: 'US Foods', phone: '800-555-0102', email: 'service@usfoods.example.com', address: '9399 W Higgins Rd', city: 'Rosemont', state: 'IL', zipCode: '60018' },
    { vendorNumber: 'GH-V003', name: 'Gordon Food Service', phone: '800-555-0103', email: 'orders@gfs.example.com', address: '1300 Gezon Pkwy', city: 'Wyoming', state: 'MI', zipCode: '49509' },
    { vendorNumber: 'GH-V004', name: 'McKesson Medical', phone: '800-555-0104', email: 'medsupply@mckesson.example.com', address: '6555 State Hwy 161', city: 'Irving', state: 'TX', zipCode: '75039' },
    { vendorNumber: 'GH-V005', name: 'Medline Industries', phone: '800-555-0105', email: 'orders@medline.example.com', address: '3 Lakes Dr', city: 'Northfield', state: 'IL', zipCode: '60093' },
    { vendorNumber: 'GH-V006', name: 'CVS Pharmacy Institutional', phone: '800-555-0106', email: 'institutional@cvs.example.com', address: '1 CVS Drive', city: 'Woonsocket', state: 'RI', zipCode: '02895' },
    { vendorNumber: 'GH-V007', name: 'City Water & Sewer', phone: '555-0107', email: 'billing@citywater.example.com', address: '100 Municipal Dr', city: 'Springfield', state: 'IL', zipCode: '62701' },
    { vendorNumber: 'GH-V008', name: 'Regional Electric Co', phone: '555-0108', email: 'commercial@regelectric.example.com', address: '200 Power Plant Rd', city: 'Springfield', state: 'IL', zipCode: '62702' },
    { vendorNumber: 'GH-V009', name: 'National Gas Utility', phone: '800-555-0109', email: 'service@natgas.example.com', address: '300 Pipeline Ave', city: 'Springfield', state: 'IL', zipCode: '62703' },
    { vendorNumber: 'GH-V010', name: 'ABC Property Maintenance', phone: '555-0110', email: 'service@abcmaint.example.com', address: '450 Industrial Pk', city: 'Springfield', state: 'IL', zipCode: '62704' },
    { vendorNumber: 'GH-V011', name: 'Home Depot Pro', phone: '800-555-0111', email: 'pro@homedepot.example.com', address: '2455 Paces Ferry Rd', city: 'Atlanta', state: 'GA', zipCode: '30339' },
    { vendorNumber: 'GH-V012', name: 'Ferguson Plumbing', phone: '800-555-0112', email: 'orders@ferguson.example.com', address: '751 Lakefront Cmns', city: 'Newport News', state: 'VA', zipCode: '23606' },
    { vendorNumber: 'GH-V013', name: 'Enterprise Fleet Management', phone: '800-555-0113', email: 'fleet@enterprise.example.com', address: '600 Corporate Park Dr', city: 'St. Louis', state: 'MO', zipCode: '63105' },
    { vendorNumber: 'GH-V014', name: 'Jiffy Lube Fleet Services', phone: '800-555-0114', email: 'fleet@jiffylube.example.com', address: '700 Milam St', city: 'Houston', state: 'TX', zipCode: '77002' },
    { vendorNumber: 'GH-V015', name: 'State Insurance Group', phone: '800-555-0115', email: 'commercial@stateins.example.com', address: '1 Insurance Plaza', city: 'Springfield', state: 'IL', zipCode: '62705' },
    { vendorNumber: 'GH-V016', name: 'Relias Learning', phone: '800-555-0116', email: 'sales@relias.example.com', address: '111 Corning Rd', city: 'Cary', state: 'NC', zipCode: '27518' },
    { vendorNumber: 'GH-V017', name: 'CPR Training Institute', phone: '555-0117', email: 'schedule@cprtrain.example.com', address: '222 Safety Ln', city: 'Springfield', state: 'IL', zipCode: '62706' },
    { vendorNumber: 'GH-V018', name: 'Community Recreation Supply', phone: '800-555-0118', email: 'orders@commrec.example.com', address: '333 Fun Park Ave', city: 'Indianapolis', state: 'IN', zipCode: '46204' },
    { vendorNumber: 'GH-V019', name: 'Arts & Crafts Wholesale', phone: '800-555-0119', email: 'wholesale@artscrafts.example.com', address: '444 Creative Way', city: 'Dallas', state: 'TX', zipCode: '75201' },
    { vendorNumber: 'GH-V020', name: 'Staples Business Advantage', phone: '800-555-0120', email: 'business@staples.example.com', address: '500 Staples Dr', city: 'Framingham', state: 'MA', zipCode: '01702' },
    { vendorNumber: 'GH-V021', name: 'Amazon Business', phone: '800-555-0121', email: 'business@amazon.example.com', address: '410 Terry Ave N', city: 'Seattle', state: 'WA', zipCode: '98109' },
    { vendorNumber: 'GH-V022', name: 'CDW', phone: '800-555-0122', email: 'govt@cdw.example.com', address: '200 N Milwaukee Ave', city: 'Vernon Hills', state: 'IL', zipCode: '60061' },
    { vendorNumber: 'GH-V023', name: 'Verizon Business', phone: '800-555-0123', email: 'business@verizon.example.com', address: '1 Verizon Way', city: 'Basking Ridge', state: 'NJ', zipCode: '07920' },
    { vendorNumber: 'GH-V024', name: 'Anderson & Associates CPA', phone: '555-0124', email: 'info@andersoncpa.example.com', address: '100 Professional Pkwy', city: 'Springfield', state: 'IL', zipCode: '62707' },
    { vendorNumber: 'GH-V025', name: 'Greenfield Law Group', phone: '555-0125', email: 'intake@greenfieldlaw.example.com', address: '200 Legal Center Dr', city: 'Springfield', state: 'IL', zipCode: '62708' },
    { vendorNumber: 'GH-V026', name: 'Direct Supply', phone: '800-555-0126', email: 'orders@directsupply.example.com', address: '6767 N Industrial Rd', city: 'Milwaukee', state: 'WI', zipCode: '53223' },
    { vendorNumber: 'GH-V027', name: 'Grainger', phone: '800-555-0127', email: 'service@grainger.example.com', address: '100 Grainger Pkwy', city: 'Lake Forest', state: 'IL', zipCode: '60045' },
    { vendorNumber: 'GH-V028', name: 'Cintas', phone: '800-555-0128', email: 'service@cintas.example.com', address: '6800 Cintas Blvd', city: 'Mason', state: 'OH', zipCode: '45040' },
    { vendorNumber: 'GH-V029', name: 'CleanSource Supply', phone: '800-555-0129', email: 'orders@cleansource.example.com', address: '900 Clean Ave', city: 'Chicago', state: 'IL', zipCode: '60607' },
  ];

  for (const v of vendorData) {
    await prisma.vendor.upsert({
      where: { vendorNumber: v.vendorNumber },
      update: { name: v.name, phone: v.phone, email: v.email, address: v.address, city: v.city, state: v.state, zipCode: v.zipCode },
      create: v,
    });
  }

  // ============================================
  // BUDGET ITEMS (~120)
  // ============================================
  console.log('💰 Creating budget items...');

  // Budget allocations per department (keyed by department name, values are { categoryCode: amount })
  // Target ~$4M total: Corporate ~$480K, Day Program ~$320K, 8 group homes ~$330K-$400K each
  const budgetAllocations: Record<string, Record<string, number>> = {
    'Corporate Office': {
      FOOD: 8000, MED: 4000, UTIL: 18000, MAINT: 15000, TRANS: 15000,
      INS: 80000, TRAIN: 35000, ACT: 12000, OFFICE: 48000, IT: 72000,
      PROF: 120000, LIC: 30000, FURN: 25000, CLEAN: 8000,
    }, // = $490,000
    'Elm Street Home': { // 8-bed
      FOOD: 56000, MED: 24000, UTIL: 28000, MAINT: 22000, TRANS: 16000,
      INS: 42000, TRAIN: 5500, ACT: 11000, OFFICE: 4000, IT: 5500,
      PROF: 3500, LIC: 3500, FURN: 9000, CLEAN: 13000,
    }, // = $242,500 + staffing covered by payroll
    'Maple Court Home': { // 8-bed
      FOOD: 58000, MED: 23000, UTIL: 29000, MAINT: 23000, TRANS: 15000,
      INS: 42000, TRAIN: 5800, ACT: 10500, OFFICE: 4200, IT: 5200,
      PROF: 3200, LIC: 3800, FURN: 8500, CLEAN: 12500,
    }, // = $243,700
    'Cedar Ridge Home': { // 8-bed
      FOOD: 55000, MED: 25000, UTIL: 27000, MAINT: 21000, TRANS: 17000,
      INS: 40000, TRAIN: 5200, ACT: 11500, OFFICE: 3800, IT: 5600,
      PROF: 3600, LIC: 3200, FURN: 9500, CLEAN: 13500,
    }, // = $245,900
    'Birch Lane Home': { // 8-bed
      FOOD: 57000, MED: 22000, UTIL: 30000, MAINT: 24000, TRANS: 14000,
      INS: 44000, TRAIN: 6000, ACT: 10000, OFFICE: 4400, IT: 5000,
      PROF: 3000, LIC: 3800, FURN: 8000, CLEAN: 12000,
    }, // = $243,200
    'Oak Haven Home': { // 10-bed (largest)
      FOOD: 72000, MED: 28000, UTIL: 34000, MAINT: 26000, TRANS: 20000,
      INS: 48000, TRAIN: 6500, ACT: 13000, OFFICE: 4500, IT: 6500,
      PROF: 4500, LIC: 4500, FURN: 11000, CLEAN: 15500,
    }, // = $293,500
    'Pine View Home': { // 6-bed
      FOOD: 48000, MED: 20000, UTIL: 24000, MAINT: 19000, TRANS: 13000,
      INS: 38000, TRAIN: 4500, ACT: 9000, OFFICE: 3500, IT: 4500,
      PROF: 2500, LIC: 2500, FURN: 7000, CLEAN: 11000,
    }, // = $206,000
    'Willow Creek Home': { // 8-bed
      FOOD: 55000, MED: 23500, UTIL: 28500, MAINT: 22500, TRANS: 15500,
      INS: 43000, TRAIN: 5600, ACT: 10800, OFFICE: 4100, IT: 5400,
      PROF: 3200, LIC: 3500, FURN: 8600, CLEAN: 12800,
    }, // = $241,000
    'Aspen Heights Home': { // 6-bed
      FOOD: 49000, MED: 21000, UTIL: 25000, MAINT: 19500, TRANS: 13500,
      INS: 39000, TRAIN: 4800, ACT: 9500, OFFICE: 3600, IT: 4600,
      PROF: 2800, LIC: 2800, FURN: 7200, CLEAN: 11500,
    }, // = $213,800
    'Horizons Day Program': {
      FOOD: 36000, MED: 10000, UTIL: 24000, MAINT: 18000, TRANS: 68000,
      INS: 42000, TRAIN: 18000, ACT: 52000, OFFICE: 14000, IT: 12000,
      PROF: 12000, LIC: 10000, FURN: 14000, CLEAN: 22000,
    }, // = $352,000
  };

  // Short department code for budget item codes
  const deptCodes: Record<string, string> = {
    'Corporate Office': 'CORP',
    'Elm Street Home': 'ELM',
    'Maple Court Home': 'MAPLE',
    'Cedar Ridge Home': 'CEDAR',
    'Birch Lane Home': 'BIRCH',
    'Oak Haven Home': 'OAK',
    'Pine View Home': 'PINE',
    'Willow Creek Home': 'WILLOW',
    'Aspen Heights Home': 'ASPEN',
    'Horizons Day Program': 'DAY',
  };

  let budgetItemCount = 0;
  let totalBudget = 0;

  for (const [deptName, allocations] of Object.entries(budgetAllocations)) {
    const dept = departments[deptName];
    const deptCode = deptCodes[deptName];

    for (const [catCode, amount] of Object.entries(allocations)) {
      const category = categories[catCode];
      const budgetCode = `${deptCode}-${catCode}-2026`;
      const catName = categoryData.find(c => c.code === catCode)!.name;

      await prisma.budgetItem.upsert({
        where: { code: budgetCode },
        update: {
          budgetAmount: amount,
          departmentId: dept.id,
          categoryId: category.id,
          fiscalYear: 2026,
        },
        create: {
          code: budgetCode,
          description: `${catName} — ${deptName}`,
          budgetAmount: amount,
          departmentId: dept.id,
          categoryId: category.id,
          fiscalYear: 2026,
        },
      });

      budgetItemCount++;
      totalBudget += amount;
    }
  }

  // ============================================
  // TEST USERS (3 new, additive)
  // ============================================
  console.log('👤 Creating test users...');

  // Look up existing roles
  const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } });
  const userRole = await prisma.role.findUnique({ where: { code: 'USER' } });

  if (!managerRole || !userRole) {
    console.error('❌ MANAGER and/or USER roles not found. Run the base seed first.');
    process.exit(1);
  }

  const corpDept = departments['Corporate Office'];
  const elmDept = departments['Elm Street Home'];

  await prisma.user.upsert({
    where: { email: 'director@example.com' },
    update: {
      name: 'Executive Director',
      roleId: managerRole.id,
      departmentId: corpDept.id,
    },
    create: {
      email: 'director@example.com',
      password: await bcrypt.hash('director123', 10),
      name: 'Executive Director',
      roleId: managerRole.id,
      departmentId: corpDept.id,
      authProvider: 'local',
    },
  });

  await prisma.user.upsert({
    where: { email: 'housemanager@example.com' },
    update: {
      name: 'House Manager',
      roleId: managerRole.id,
      departmentId: elmDept.id,
    },
    create: {
      email: 'housemanager@example.com',
      password: await bcrypt.hash('house123', 10),
      name: 'House Manager',
      roleId: managerRole.id,
      departmentId: elmDept.id,
      authProvider: 'local',
    },
  });

  await prisma.user.upsert({
    where: { email: 'dsp@example.com' },
    update: {
      name: 'Direct Support Professional',
      roleId: userRole.id,
      departmentId: elmDept.id,
    },
    create: {
      email: 'dsp@example.com',
      password: await bcrypt.hash('dsp123', 10),
      name: 'Direct Support Professional',
      roleId: userRole.id,
      departmentId: elmDept.id,
      authProvider: 'local',
    },
  });

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n✅ Group Home LTC seed complete!');
  console.log('\n📊 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Fiscal Year: FY2026 (OPEN)`);
  console.log(`   Departments: ${departmentData.length}`);
  console.log(`   Budget Categories: ${categoryData.length}`);
  console.log(`   Vendors: ${vendorData.length}`);
  console.log(`   Budget Items: ${budgetItemCount}`);
  console.log(`   Total Budget: $${totalBudget.toLocaleString()}`);
  console.log(`   Test Users: 3`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📋 Test Login Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Director:      director@example.com / director123');
  console.log('House Manager: housemanager@example.com / house123');
  console.log('DSP:           dsp@example.com / dsp123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('Error seeding group home data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
