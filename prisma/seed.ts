import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import "dotenv/config";

const staffData = [
  { name: "Sharumeela Abdul Fatah", designation: "Accounts Officer" },
  { name: "Aishath Yaania", designation: "Administrative Officer" },
  { name: "Aishath Shara Saeed", designation: "Archives Officer" },
  { name: "Aishath Soniya", designation: "Deputy Director" },
  { name: "Ahmed Asim", designation: "Consultant" },
  { name: "Imad Mohamed", designation: "Chief Corporate Executive" },
  { name: "Ahmed Arusham Ismail", designation: "Assistant Developer" },
  { name: "Aminath Shiuna", designation: "Lead Archivist" },
  { name: "Sharmeela Mohamed", designation: "Principal Finance Officer" },
  { name: "Shahad Shareef", designation: "Computer Technician" },
  { name: "Mohamed Amir", designation: "Director General" },
  { name: "Hawwa Samha Shuaib", designation: "Archives Officer" },
  { name: "Fathimath Nahuza", designation: "Senior Archivist" },
  { name: "Mohamed Zeehan Abdullah", designation: "Director" },
];

async function main() {
  console.log("Starting seed...");

  // 1. Seed staff (only if there are none — keeps re-runs idempotent without
  //    requiring a unique constraint on name).
  const existingStaffCount = await prisma.staff.count();
  if (existingStaffCount === 0) {
    for (const staff of staffData) {
      await prisma.staff.create({ data: staff });
    }
    console.log(`Seeded ${staffData.length} staff members.`);
  } else {
    console.log(
      `Skipping staff seed — ${existingStaffCount} staff already in DB.`,
    );
  }

  // 2. Seed the Administrator role (idempotent via upsert on unique name).
  const adminRole = await prisma.role.upsert({
    where: { name: "Administrator" },
    update: {
      // Keep permissions in sync with the catalog so a deploy that adds a new
      // permission to PERMISSIONS automatically grants it to admins.
      permissions: [...ALL_PERMISSIONS],
      isSystem: true,
      description: "Full access to every feature. System role; cannot be deleted.",
    },
    create: {
      name: "Administrator",
      description: "Full access to every feature. System role; cannot be deleted.",
      permissions: [...ALL_PERMISSIONS],
      isSystem: true,
    },
  });
  console.log(
    `Administrator role ready (id: ${adminRole.id}, ${adminRole.permissions.length} permissions).`,
  );

  // 3. Assign Administrator to a designated Staff.
  //    Set SEED_ADMIN in .env to either an email (preferred) or a name.
  //    e.g.  SEED_ADMIN=arusham@archives.gov.mv
  //    or    SEED_ADMIN="Ahmed Arusham Ismail"
  const seedAdmin = process.env.SEED_ADMIN?.trim();
  if (!seedAdmin) {
    console.warn(
      "[seed] SEED_ADMIN env var not set. Administrator role created but " +
        "not assigned to anyone. Set SEED_ADMIN to an email or name and " +
        "re-run, or assign via SQL:\n" +
        "  INSERT INTO \"_StaffRoles\" (\"A\", \"B\") VALUES " +
        "((SELECT id FROM staff WHERE email = '...'), '" +
        adminRole.id +
        "');",
    );
    return;
  }

  const isEmail = seedAdmin.includes("@");
  const candidate = await prisma.staff.findFirst({
    where: isEmail
      ? { email: { equals: seedAdmin, mode: "insensitive" } }
      : { name: { equals: seedAdmin, mode: "insensitive" } },
  });

  if (!candidate) {
    console.warn(
      `[seed] No Staff matched SEED_ADMIN="${seedAdmin}" (matched by ${
        isEmail ? "email" : "name"
      }). Administrator role created but not assigned.`,
    );
    return;
  }

  await prisma.staff.update({
    where: { id: candidate.id },
    data: { roles: { connect: { id: adminRole.id } } },
  });
  console.log(
    `Administrator role assigned to "${candidate.name}" (${candidate.email ?? "no email"}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
