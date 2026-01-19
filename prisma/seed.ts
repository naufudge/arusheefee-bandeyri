import { prisma } from '@/lib/prisma';
import 'dotenv/config';

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
  console.log('Starting seed...');

  for (const staff of staffData) {
    await prisma.staff.create({
      data: staff,
    });
  }

  console.log(`Seeded ${staffData.length} staff members successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
