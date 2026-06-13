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

  // 1.5 Seed sample PVs so the document-number and posted-flow features are
  //     testable right away. Idempotent per-sample (keyed on the unique
  //     "SMP-…" pvNum) so it runs regardless of other PVs already in the DB
  //     and re-runs don't duplicate. Written directly (bypassing the zod
  //     schema + signature gate); the status / *At columns are set
  //     consistently per stage. Seeded signatories have no signature
  //     attachments, so the PDF renders names and dates but blank signature
  //     images until a real signature is uploaded for that staff member.
  {
    const staffId = async (name: string) =>
      (await prisma.staff.findFirst({ where: { name } }))?.id ?? null;

    const prepared = await staffId("Sharumeela Abdul Fatah");
    const verifier = await staffId("Aishath Soniya");
    const authOne = await staffId("Imad Mohamed");
    const authTwo = await staffId("Mohamed Amir");
    const poster = await staffId("Sharmeela Mohamed");

    const gl = (code: number, amount: number) => ({ code, fund: "C-GOM", amount });
    const d = (iso: string) => new Date(iso);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const samplePvs: any[] = [
      {
        // DRAFT — single invoice, no document number.
        pvNum: "SMP-2026-0001",
        vendor: "Dhiraagu Plc",
        date: d("2026-06-01"),
        notes: "Internet & telephone services for May 2026.",
        paymentMethod: "Transfer",
        status: "DRAFT",
        preparedById: prepared,
        verifiedById: verifier,
        authorisedByOneId: authOne,
        authorisedByTwoId: authTwo,
        invoices: {
          create: [
            {
              comments: "Monthly internet and telephone bill.",
              documentNum: null,
              invoiceNumber: "INV-5521",
              invoiceDate: d("2026-05-28"),
              invoiceTotal: 1850.0,
              glDetails: { create: [gl(223001, 1850.0)] },
            },
          ],
        },
      },
      {
        // PENDING_VERIFICATION — single invoice WITH a document number
        // (exercises the top-left placement on the PDF).
        pvNum: "SMP-2026-0002",
        vendor: "State Electric Company Ltd",
        date: d("2026-06-02"),
        notes: "Electricity charges for April 2026.",
        paymentMethod: "Transfer",
        status: "PENDING_VERIFICATION",
        preparedById: prepared,
        verifiedById: verifier,
        authorisedByOneId: authOne,
        authorisedByTwoId: authTwo,
        invoices: {
          create: [
            {
              comments: "STELCO electricity bill — head office.",
              documentNum: "DOC-2026-114",
              invoiceNumber: "SE-99812",
              invoiceDate: d("2026-05-30"),
              invoiceTotal: 7421.5,
              glDetails: { create: [gl(223002, 7421.5)] },
            },
          ],
        },
      },
      {
        // PENDING_AUTHORISATION_TWO — multi-invoice, each with a document
        // number (exercises the right-aligned in-comments placement).
        pvNum: "SMP-2026-0003",
        vendor: "Office Mart Pvt Ltd",
        date: d("2026-06-03"),
        notes: "Office supplies and stationery.",
        paymentMethod: "Cheque",
        status: "PENDING_AUTHORISATION_TWO",
        preparedById: prepared,
        verifiedById: verifier,
        verifiedAt: d("2026-06-04"),
        authorisedByOneId: authOne,
        authorisedByOneAt: d("2026-06-05"),
        authorisedByTwoId: authTwo,
        invoices: {
          create: [
            {
              comments: "Stationery — pens, paper, files.",
              documentNum: "DOC-2026-201",
              invoiceNumber: "OM-3310",
              invoiceDate: d("2026-06-01"),
              invoiceTotal: 1240.0,
              glDetails: { create: [gl(221002, 1240.0)] },
            },
            {
              comments: "Printer toner cartridges.",
              documentNum: "DOC-2026-202",
              invoiceNumber: "OM-3318",
              invoiceDate: d("2026-06-01"),
              invoiceTotal: 2980.0,
              glDetails: { create: [gl(221003, 2980.0)] },
            },
          ],
        },
      },
      {
        // APPROVED — multi-invoice, ready for the Post action.
        pvNum: "SMP-2026-0004",
        vendor: "Allied Insurance Company",
        date: d("2026-06-04"),
        notes: "Annual vehicle insurance renewal.",
        paymentMethod: "Transfer",
        status: "APPROVED",
        preparedById: prepared,
        verifiedById: verifier,
        verifiedAt: d("2026-06-05"),
        authorisedByOneId: authOne,
        authorisedByOneAt: d("2026-06-06"),
        authorisedByTwoId: authTwo,
        authorisedByTwoAt: d("2026-06-07"),
        invoices: {
          create: [
            {
              comments: "Vehicle insurance — GA-1234.",
              documentNum: "DOC-2026-301",
              invoiceNumber: "AI-4401",
              invoiceDate: d("2026-06-02"),
              invoiceTotal: 5400.0,
              glDetails: { create: [gl(228001, 5400.0)] },
            },
            {
              comments: "Vehicle insurance — GA-5678.",
              documentNum: "DOC-2026-302",
              invoiceNumber: "AI-4402",
              invoiceDate: d("2026-06-02"),
              invoiceTotal: 5400.0,
              glDetails: { create: [gl(228001, 5400.0)] },
            },
          ],
        },
      },
      {
        // POSTED — full chain + posted stamp (exercises the top-right
        // "posted on" stamp on the PDF).
        pvNum: "SMP-2026-0005",
        vendor: "Maldives Water & Sewerage Co",
        date: d("2026-06-05"),
        notes: "Water charges for May 2026.",
        paymentMethod: "Transfer",
        status: "POSTED",
        preparedById: prepared,
        verifiedById: verifier,
        verifiedAt: d("2026-06-06"),
        authorisedByOneId: authOne,
        authorisedByOneAt: d("2026-06-07"),
        authorisedByTwoId: authTwo,
        authorisedByTwoAt: d("2026-06-08"),
        postedById: poster,
        postedAt: d("2026-06-09"),
        postingDate: d("2026-06-09"),
        invoices: {
          create: [
            {
              comments: "MWSC water bill — head office.",
              documentNum: "DOC-2026-410",
              invoiceNumber: "MW-7781",
              invoiceDate: d("2026-06-03"),
              invoiceTotal: 980.25,
              glDetails: { create: [gl(223003, 980.25)] },
            },
          ],
        },
      },
      {
        // REJECTED — single invoice, with a rejection comment.
        pvNum: "SMP-2026-0006",
        vendor: "Quick Print Services",
        date: d("2026-06-06"),
        notes: "Banner and poster printing for an event.",
        paymentMethod: "Cheque",
        status: "REJECTED",
        preparedById: prepared,
        verifiedById: verifier,
        rejectedById: verifier,
        rejectedAt: d("2026-06-07"),
        rejectionComment: "Quote exceeds the approved budget — please revise.",
        authorisedByOneId: authOne,
        authorisedByTwoId: authTwo,
        invoices: {
          create: [
            {
              comments: "Event banners and posters.",
              documentNum: null,
              invoiceNumber: "QP-220",
              invoiceDate: d("2026-06-04"),
              invoiceTotal: 3150.0,
              glDetails: { create: [gl(221004, 3150.0)] },
            },
          ],
        },
      },
    ];

    let created = 0;
    for (const data of samplePvs) {
      const exists = await prisma.pV.findUnique({
        where: { pvNum: data.pvNum },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.pV.create({ data });
      created += 1;
    }
    console.log(
      `Sample PVs: ${created} created, ${samplePvs.length - created} already present.`,
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
