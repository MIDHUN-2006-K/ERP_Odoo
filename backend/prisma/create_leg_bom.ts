import { PrismaClient, BomStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/shiv_erp?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const productId = 31; // wooden chair leg
  const adminId = 13;   // admin user

  // Check if there is already a BoM for product 31
  const existing = await prisma.bom.findFirst({
    where: { productId },
  });

  if (existing) {
    console.log(`BOM already exists with ID: ${existing.id}. Activating it...`);
    await prisma.bom.update({
      where: { id: existing.id },
      data: { status: BomStatus.ACTIVE },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { defaultBomId: existing.id },
    });
    console.log("Activated existing BOM!");
    return;
  }

  // Create a new active BoM
  const bom = await prisma.bom.create({
    data: {
      productId,
      version: 1,
      status: BomStatus.ACTIVE,
      createdBy: adminId,
      components: {
        create: [
          { componentProductId: 22, quantityPerUnit: 1.0 }, // table leg or raw material
        ],
      },
      operations: {
        create: [
          { sequence: 1, operationName: 'Leg cutting & shaping', workCenterId: 14, durationMinutes: 15 },
        ],
      },
    },
  });

  await prisma.product.update({
    where: { id: productId },
    data: { defaultBomId: bom.id },
  });

  console.log(`Successfully created and activated BOM ID ${bom.id} for wooden chair leg!`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
