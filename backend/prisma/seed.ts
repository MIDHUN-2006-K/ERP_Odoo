import { PrismaClient, Role, BomStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/shiv_erp?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding Shiv Furniture Works ERP...');

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.stockReservation.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.deliveryLine.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.salesOrderLine.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.goodsReceiptLine.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.moComponent.deleteMany();
  await prisma.manufacturingOrder.deleteMany();
  await prisma.bomOperation.deleteMany();
  await prisma.bomComponent.deleteMany();
  await prisma.bom.deleteMany();
  await prisma.product.deleteMany();
  await prisma.workCenter.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.sequence.deleteMany();

  // ============================================================
  // USERS
  // ============================================================
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Shiv Kumar (Admin)',
      email: 'admin@shivfurniture.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const salesUser = await prisma.user.create({
    data: {
      name: 'Amit Sharma',
      email: 'amit@shivfurniture.com',
      passwordHash: await bcrypt.hash('Sales@123', 10),
      role: Role.SALES_USER,
      phone: '+91 98765 43210',
      address: 'Colaba, Mumbai, 400001',
    },
  });

  const purchaseUser = await prisma.user.create({
    data: {
      name: 'Vijay Sharma',
      email: 'vijay@shivfurniture.com',
      passwordHash: await bcrypt.hash('Purchase@123', 10),
      role: Role.PURCHASE_USER,
    },
  });

  const mfgUser = await prisma.user.create({
    data: {
      name: 'Meera Singh',
      email: 'meera@shivfurniture.com',
      passwordHash: await bcrypt.hash('Mfg@1234', 10),
      role: Role.MFG_USER,
    },
  });

  const inventoryMgr = await prisma.user.create({
    data: {
      name: 'Ravi Patel',
      email: 'ravi@shivfurniture.com',
      passwordHash: await bcrypt.hash('Inv@1234', 10),
      role: Role.INVENTORY_MANAGER,
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: 'Mahesh Gupta',
      email: 'mahesh@shivfurniture.com',
      passwordHash: await bcrypt.hash('Owner@123', 10),
      role: Role.BUSINESS_OWNER,
      phone: '+91 98000 00000',
      address: 'Colaba, Mumbai, 400001',
    },
  });

  // ============================================================
  // VENDORS
  // ============================================================
  const vendor1 = await prisma.vendor.create({
    data: {
      name: 'Plastofact India',
      email: 'sales@plastofact.in',
      phone: '+91 22 2345 6789',
      address: '45 Industrial Estate, Andheri East, Mumbai 400059',
      gstNo: '27AABCP1234A1Z5',
      paymentTerms: 'Net 30',
    },
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      name: 'ORM Metals',
      email: 'info@ormmetals.com',
      phone: '+91 22 3456 7890',
      address: '12 Steel Market, Bhandup, Mumbai 400078',
      gstNo: '27AABCO5678B1Z3',
      paymentTerms: 'Net 15',
    },
  });

  const vendor3 = await prisma.vendor.create({
    data: {
      name: 'Timber World',
      email: 'orders@timberworld.in',
      phone: '+91 22 4567 8901',
      address: '78 Timber Yard, Bhiwandi, Thane 421302',
      paymentTerms: 'Net 45',
    },
  });



  // ============================================================
  // CUSTOMERS
  // ============================================================
  const cust1 = await prisma.customer.create({
    data: {
      name: 'Urban Living Interiors',
      email: 'purchase@urbanliving.in',
      phone: '+91 22 5678 9012',
      address: '23 Design District, Lower Parel, Mumbai 400013',
    },
  });

  const cust2 = await prisma.customer.create({
    data: {
      name: 'HomeStyle Furniture Store',
      email: 'orders@homestyle.com',
      phone: '+91 22 6789 0123',
      address: '56 Main Road, Dadar, Mumbai 400014',
    },
  });

  const cust3 = await prisma.customer.create({
    data: {
      name: 'Office Solutions Pvt Ltd',
      email: 'procurement@officesolutions.in',
      phone: '+91 22 7890 1234',
      address: '89 Corporate Park, BKC, Mumbai 400051',
    },
  });

  // ============================================================
  // WORK CENTERS
  // ============================================================
  const wcCutting = await prisma.workCenter.create({
    data: { name: 'WC001 Cutting Station', location: 'Floor 1', capacityPerDay: 100 },
  });

  const wcAssembly = await prisma.workCenter.create({
    data: { name: 'WC002 Assembly Station', location: 'Floor 1', capacityPerDay: 80 },
  });

  const wcPaint = await prisma.workCenter.create({
    data: { name: 'WC003 Painting Station', location: 'Floor 2', capacityPerDay: 50 },
  });

  const wcQuality = await prisma.workCenter.create({
    data: { name: 'WC004 Quality Check', location: 'Floor 2', capacityPerDay: 120 },
  });

  const wcPackaging = await prisma.workCenter.create({
    data: { name: 'WC005 Packaging Station', location: 'Floor 3', capacityPerDay: 150 },
  });

  // ============================================================
  // PRODUCTS — Components (raw materials)
  // ============================================================
  const tableLeg = await prisma.product.create({
    data: {
      sku: 'COMP-LEG-001',
      name: 'Table Leg (Wood)',
      category: 'COMPONENT',
      uom: 'PCS',
      salesPrice: 0,
      costPrice: 150,
      procurementStrategy: 'MTS',
      procureOnDemand: false,
      onHandQty: 200,
      defaultVendorId: vendor3.id,
    },
  });

  const tableTop = await prisma.product.create({
    data: {
      sku: 'COMP-TOP-001',
      name: 'Table Top (Plywood)',
      category: 'COMPONENT',
      uom: 'PCS',
      salesPrice: 0,
      costPrice: 500,
      procurementStrategy: 'MTS',
      procureOnDemand: false,
      onHandQty: 50,
      defaultVendorId: vendor3.id,
    },
  });

  const screws = await prisma.product.create({
    data: {
      sku: 'COMP-SCR-001',
      name: 'Wood Screws (Pack of 10)',
      category: 'COMPONENT',
      uom: 'PACK',
      salesPrice: 0,
      costPrice: 25,
      procurementStrategy: 'MTS',
      procureOnDemand: false,
      onHandQty: 500,
      defaultVendorId: vendor2.id,
    },
  });

  const paint = await prisma.product.create({
    data: {
      sku: 'COMP-PNT-001',
      name: 'Wood Polish (Mahogany)',
      category: 'COMPONENT',
      uom: 'LITRE',
      salesPrice: 0,
      costPrice: 350,
      procurementStrategy: 'MTS',
      procureOnDemand: false,
      onHandQty: 30,
      defaultVendorId: vendor1.id,
    },
  });

  const doorFrame = await prisma.product.create({
    data: {
      sku: 'COMP-DFR-001',
      name: 'Door Frame (Teak)',
      category: 'COMPONENT',
      uom: 'PCS',
      salesPrice: 0,
      costPrice: 800,
      procurementStrategy: 'MTS',
      procureOnDemand: false,
      onHandQty: 20,
      defaultVendorId: vendor3.id,
    },
  });

  const lightingFrame = await prisma.product.create({
    data: {
      sku: 'COMP-LFR-001',
      name: 'Lighting Frame (Aluminium)',
      category: 'COMPONENT',
      uom: 'PCS',
      salesPrice: 0,
      costPrice: 450,
      procurementStrategy: 'MTS',
      procureOnDemand: false,
      onHandQty: 15,
      defaultVendorId: vendor2.id,
    },
  });

  // ============================================================
  // PRODUCTS — Finished Goods
  // ============================================================
  const woodenTable = await prisma.product.create({
    data: {
      sku: 'FG-TBL-001',
      name: 'Wooden Dining Table (6-seater)',
      category: 'FINISHED_GOOD',
      uom: 'UNIT',
      salesPrice: 15000,
      costPrice: 8500,
      procurementStrategy: 'MTO',
      procureOnDemand: true,
      procurementType: 'MANUFACTURING',
      onHandQty: 5,
    },
  });

  const officeDesk = await prisma.product.create({
    data: {
      sku: 'FG-DSK-001',
      name: 'Office Desk (Executive)',
      category: 'FINISHED_GOOD',
      uom: 'UNIT',
      salesPrice: 12000,
      costPrice: 6800,
      procurementStrategy: 'MTO',
      procureOnDemand: true,
      procurementType: 'MANUFACTURING',
      onHandQty: 3,
    },
  });

  const woodenChair = await prisma.product.create({
    data: {
      sku: 'FG-CHR-001',
      name: 'Wooden Chair (Cushioned)',
      category: 'FINISHED_GOOD',
      uom: 'UNIT',
      salesPrice: 4500,
      costPrice: 2200,
      procurementStrategy: 'MTS',
      procureOnDemand: false,
      onHandQty: 100,
    },
  });

  // ============================================================
  // BILLS OF MATERIALS
  // ============================================================
  const bomTable = await prisma.bom.create({
    data: {
      productId: woodenTable.id,
      version: 1,
      status: BomStatus.ACTIVE,
      createdBy: admin.id,
      components: {
        create: [
          { componentProductId: tableLeg.id, quantityPerUnit: 4 },
          { componentProductId: tableTop.id, quantityPerUnit: 1 },
          { componentProductId: screws.id, quantityPerUnit: 12 },
          { componentProductId: paint.id, quantityPerUnit: 0.5 },
        ],
      },
      operations: {
        create: [
          { sequence: 1, operationName: 'Cutting', workCenterId: wcCutting.id, durationMinutes: 45 },
          { sequence: 2, operationName: 'Assembly', workCenterId: wcAssembly.id, durationMinutes: 60 },
          { sequence: 3, operationName: 'Painting', workCenterId: wcPaint.id, durationMinutes: 90 },
          { sequence: 4, operationName: 'Quality Check', workCenterId: wcQuality.id, durationMinutes: 15 },
          { sequence: 5, operationName: 'Packaging', workCenterId: wcPackaging.id, durationMinutes: 20 },
        ],
      },
    },
  });

  // Link default BoM
  await prisma.product.update({
    where: { id: woodenTable.id },
    data: { defaultBomId: bomTable.id },
  });

  const bomDesk = await prisma.bom.create({
    data: {
      productId: officeDesk.id,
      version: 1,
      status: BomStatus.ACTIVE,
      createdBy: admin.id,
      components: {
        create: [
          { componentProductId: tableLeg.id, quantityPerUnit: 4 },
          { componentProductId: tableTop.id, quantityPerUnit: 1 },
          { componentProductId: screws.id, quantityPerUnit: 8 },
        ],
      },
      operations: {
        create: [
          { sequence: 1, operationName: 'Assembly', workCenterId: wcAssembly.id, durationMinutes: 50 },
          { sequence: 2, operationName: 'Painting', workCenterId: wcPaint.id, durationMinutes: 60 },
          { sequence: 3, operationName: 'Quality Check', workCenterId: wcQuality.id, durationMinutes: 10 },
          { sequence: 4, operationName: 'Packaging', workCenterId: wcPackaging.id, durationMinutes: 15 },
        ],
      },
    },
  });

  await prisma.product.update({
    where: { id: officeDesk.id },
    data: { defaultBomId: bomDesk.id },
  });

  // ============================================================
  // SEQUENCES (initialize counters)
  // ============================================================
  await prisma.sequence.createMany({
    data: [
      { prefix: 'SO', nextVal: 1 },
      { prefix: 'PO', nextVal: 1 },
      { prefix: 'MO', nextVal: 1 },
      { prefix: 'BOM', nextVal: 3 },
      { prefix: 'DEL', nextVal: 1 },
      { prefix: 'GR', nextVal: 1 },
    ],
  });

  // ============================================================
  // INITIAL STOCK LEDGER ENTRIES (for products with starting stock)
  // ============================================================
  const productsWithStock = [
    tableLeg, tableTop, screws, paint, doorFrame, lightingFrame,
    woodenTable, officeDesk, woodenChair,
  ];

  for (const prod of productsWithStock) {
    if (Number(prod.onHandQty) > 0) {
      await prisma.stockLedger.create({
        data: {
          productId: prod.id,
          movementType: 'ADJUSTMENT',
          quantity: prod.onHandQty,
          balanceAfter: prod.onHandQty,
          referenceType: 'INITIAL_STOCK',
          referenceId: 0,
          createdBy: admin.id,
        },
      });
    }
  }

  console.log('✅ Seed data created successfully!');
  console.log('');
  console.log('📋 Login credentials:');
  console.log('  Admin:      admin@shivfurniture.com    / Admin@123');
  console.log('  Sales:      amit@shivfurniture.com     / Sales@123');
  console.log('  Purchase:   vijay@shivfurniture.com    / Purchase@123');
  console.log('  Mfg:        meera@shivfurniture.com    / Mfg@1234');
  console.log('  Inventory:  ravi@shivfurniture.com     / Inv@1234');
  console.log('  Owner:      mahesh@shivfurniture.com   / Owner@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
