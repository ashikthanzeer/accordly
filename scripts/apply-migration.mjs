import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const dbUrl = new URL(process.env.DIRECT_URL || process.env.DATABASE_URL);
dbUrl.searchParams.set("connect_timeout", "30");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl.toString(),
    },
  },
});

async function main() {
  console.log("=== NeonDB Schema Migration Runner ===");
  console.log("Target Host:", dbUrl.host);

  try {
    const migrationPath = path.resolve(
      process.cwd(),
      "prisma/migrations/20261109000000_archival_and_proposal_soft_delete/migration.sql"
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Remove comments
    const cleanSql = sqlContent
      .split("\n")
      .map((line) => (line.trim().startsWith("--") ? "" : line))
      .join("\n");

    const statements = cleanSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} statements to execute.`);

    for (const statement of statements) {
      console.log(`Executing:\n${statement}`);
      await prisma.$executeRawUnsafe(statement);
      console.log("✓ Success\n");
    }
    console.log("All migration statements executed successfully!\n");

    // Verify Project columns
    const projectCols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Project' AND column_name IN ('archivedAt', 'archivedBy')
      ORDER BY column_name;
    `);
    console.log("Verified Project columns in Neon DB:", projectCols);

    // Verify ChangeOrder columns
    const changeOrderCols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ChangeOrder' AND column_name IN ('deletedAt', 'deletedBy')
      ORDER BY column_name;
    `);
    console.log("Verified ChangeOrder columns in Neon DB:", changeOrderCols);

    // Verify records count to ensure zero data loss
    const projectCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "Project";`);
    const proposalCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "ChangeOrder";`);
    console.log("Existing Project records count:", projectCount);
    console.log("Existing ChangeOrder records count:", proposalCount);

  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
