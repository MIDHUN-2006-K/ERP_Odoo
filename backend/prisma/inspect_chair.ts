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
  const bom = await prisma.bom.findUnique({
    where: { id: 16 },
    include: {
      components: {
        include: {
          componentProduct: true
        }
      },
      operations: {
        include: {
          workCenter: true
        }
      }
    }
  });
  console.log("BOM 16 DETAILS:", JSON.stringify(bom, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
