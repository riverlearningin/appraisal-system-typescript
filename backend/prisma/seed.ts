import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);

const prisma = new PrismaClient({ adapter});

async function main() {
    const roles = ['employee', 'manager', 'management', 'admin'];

    for (const role of roles) {
        await prisma.role.upsert({
            where: {name: role},
            update: {},
            create: {name: role},
        });
    }
}

main()
    .then(() => console.log('Roles seeded.'))
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());