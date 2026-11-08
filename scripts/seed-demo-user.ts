/**
 * Demo Data & Provider Ownership Migration Script.
 *
 * Ensures that existing demo/test projects remain safely assigned to the dedicated
 * demo provider account (`usr_demo_provider` / `provider@accordly.local`) without
 * automatically assigning demo records to whichever Google user signs in first.
 *
 * Optionally accepts `--assign-to-email=<email>` if an administrator explicitly wants
 * to transfer demo projects to a specific authenticated Google account.
 */

import { prisma } from "../src/lib/db";

async function main() {
  const assignEmailArg = process.argv.find((arg) =>
    arg.startsWith("--assign-to-email=")
  );
  const targetEmail = assignEmailArg
    ? assignEmailArg.split("=")[1]?.trim()
    : null;

  // 1. Ensure the canonical demo user exists
  const demoUser = await prisma.user.upsert({
    where: { email: "provider@accordly.local" },
    update: {},
    create: {
      id: "usr_demo_provider",
      name: "Sarah Jenkins (Demo)",
      email: "provider@accordly.local",
      emailVerified: true,
    },
  });

  console.log(
    `[Demo Seed] Verified demo provider account: ${demoUser.id} (${demoUser.email})`
  );

  if (targetEmail) {
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (!targetUser) {
      console.error(
        `[Demo Seed] Target user with email "${targetEmail}" not found. Sign in with Google first.`
      );
      process.exit(1);
    }

    const updated = await prisma.project.updateMany({
      where: { ownerId: demoUser.id },
      data: { ownerId: targetUser.id },
    });

    console.log(
      `[Demo Seed] Explicitly reassigned ${updated.count} demo project(s) to ${targetUser.email} (${targetUser.id}).`
    );
  } else {
    const demoProjectCount = await prisma.project.count({
      where: { ownerId: demoUser.id },
    });
    console.log(
      `[Demo Seed] ${demoProjectCount} demo project(s) safely preserved under ${demoUser.email}.`
    );
  }
}

main()
  .catch((err) => {
    console.error("[Demo Seed] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

