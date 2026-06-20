import { PrismaClient } from '@prisma/client';
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
  const products = await prisma.product.findMany({
    include: {
      defaultBom: true,
      boms: {
        include: {
          components: true,
          operations: true,
        }
      }
    }
  });
  console.log("PRODUCTS:");
  products.forEach(p => {
    console.log(`- ID: ${p.id}, SKU: ${p.sku}, Name: ${p.name}, Category: ${p.category}, ProcurementType: ${p.procurementType}, DefaultBomId: ${p.defaultBomId}`);
    if (p.boms.length > 0) {
      console.log(`  BOMs count: ${p.boms.length}`);
      p.boms.forEach(b => {
        console.log(`    * Bom ID: ${b.id}, Version: ${b.version}, Status: ${b.status}, Components: ${b.components.length}, Operations: ${b.operations.length}`);
      });
    }
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
