import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to reset dev data');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  await prisma.deviceLog.deleteMany();
  await prisma.event.deleteMany();
  await prisma.deviceCommand.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.setpoint.deleteMany();
  await prisma.roomAlgorithmParameter.deleteMany();
  await prisma.roomSetting.deleteMany();
  await prisma.device.deleteMany();
  await prisma.userSetting.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.room.deleteMany();
  await prisma.regulationAlgorithm.deleteMany();
  await prisma.user.deleteMany();
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
