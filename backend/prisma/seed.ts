import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  const admin = await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      passwordHash: 'dev-only-change-me-admin',
      role: 'admin',
    },
  });

  const user = await prisma.user.upsert({
    where: { login: 'user' },
    update: {},
    create: {
      login: 'user',
      passwordHash: 'dev-only-change-me-user',
      role: 'user',
    },
  });

  const pidAlgorithm = await prisma.regulationAlgorithm.upsert({
    where: { code: 'PID' },
    update: {},
    create: {
      code: 'PID',
      name: 'PID',
      description: 'PID regulation algorithm',
    },
  });

  await prisma.regulationAlgorithm.upsert({
    where: { code: 'ON_OFF' },
    update: {},
    create: {
      code: 'ON_OFF',
      name: 'On/Off',
      description: 'Simple hysteresis regulation',
    },
  });

  await prisma.regulationAlgorithm.upsert({
    where: { code: 'TIME' },
    update: {},
    create: {
      code: 'TIME',
      name: 'Time',
      description: 'Time-based regulation prototype',
    },
  });

  await prisma.regulationAlgorithm.upsert({
    where: { code: 'ML' },
    update: {},
    create: {
      code: 'ML',
      name: 'ML',
      description: 'Machine-learning optimization placeholder',
      isEnabled: false,
    },
  });

  const rooms = [
    { name: 'Кабинет 203', location: 'Корпус 1', floor: 2, setpoint: 23, temperature: 22.8 },
    { name: 'Кабинет 201', location: 'Корпус 1', floor: 2, setpoint: 20, temperature: 21.2 },
    { name: 'Кабинет 105', location: 'Корпус 1', floor: 1, setpoint: 23, temperature: 23.5 },
    { name: 'Кабинет 118', location: 'Корпус 1', floor: 1, setpoint: 21, temperature: 19.9 },
    { name: 'Кабинет 302', location: 'Корпус 1', floor: 3, setpoint: 22, temperature: 24.1 },
  ];

  for (const roomSeed of rooms) {
    const existingRoom = await prisma.room.findFirst({
      where: { name: roomSeed.name },
    });

    const room = existingRoom
      ? await prisma.room.update({
          where: { id: existingRoom.id },
          data: {
            location: roomSeed.location,
            floor: roomSeed.floor,
          },
        })
      : await prisma.room.create({
          data: {
            name: roomSeed.name,
            location: roomSeed.location,
            floor: roomSeed.floor,
          },
        });

    const roomNumber = roomSeed.name.replace(/\D/g, '');
    const device = await prisma.device.upsert({
      where: { deviceUid: `arduino-${roomNumber}` },
      update: {
        roomId: room.id,
        firmwareVersion: '0.1.0',
      },
      create: {
        roomId: room.id,
        deviceUid: `arduino-${roomNumber}`,
        name: `Controller ${roomNumber}`,
        apiKeyHash: `dev-only-api-key-${roomNumber}`,
        firmwareVersion: '0.1.0',
        isOnline: roomNumber === '203',
      },
    });

    await prisma.roomSetting.upsert({
      where: { roomId: room.id },
      update: {
        currentSetpoint: roomSeed.setpoint,
        algorithmId: pidAlgorithm.id,
      },
      create: {
        roomId: room.id,
        currentSetpoint: roomSeed.setpoint,
        algorithmId: pidAlgorithm.id,
        mode: 'standard',
        controlMode: 'remote',
        status: 'stable',
        updatedByUserId: admin.id,
      },
    });

    await prisma.roomAlgorithmParameter.upsert({
      where: {
        roomId_algorithmId_isActive: {
          roomId: room.id,
          algorithmId: pidAlgorithm.id,
          isActive: true,
        },
      },
      update: {
        kp: 1.2,
        ki: 0.35,
        kd: 0.08,
        hysteresis: 0.4,
      },
      create: {
        roomId: room.id,
        algorithmId: pidAlgorithm.id,
        kp: 1.2,
        ki: 0.35,
        kd: 0.08,
        hysteresis: 0.4,
        createdByUserId: admin.id,
      },
    });

    const measurementSequence = BigInt(roomNumber) * BigInt(1000);

    await prisma.measurement.upsert({
      where: {
        deviceId_deviceSequence: {
          deviceId: device.id,
          deviceSequence: measurementSequence,
        },
      },
      update: {
        temperature: roomSeed.temperature,
        setpointValue: roomSeed.setpoint,
        heaterState: roomSeed.temperature < roomSeed.setpoint,
      },
      create: {
        roomId: room.id,
        deviceId: device.id,
        temperature: roomSeed.temperature,
        setpointValue: roomSeed.setpoint,
        heaterState: roomSeed.temperature < roomSeed.setpoint,
        algorithmId: pidAlgorithm.id,
        deviceSequence: measurementSequence,
        deviceUptimeMs: BigInt(120000),
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: 'critical_temperature' },
    update: { value: 35.0 },
    create: {
      key: 'critical_temperature',
      value: 35.0,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'telemetry_interval_ms' },
    update: { value: 5000 },
    create: {
      key: 'telemetry_interval_ms',
      value: 5000,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'heartbeat_interval_ms' },
    update: { value: 30000 },
    create: {
      key: 'heartbeat_interval_ms',
      value: 30000,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'command_poll_interval_ms' },
    update: { value: 5000 },
    create: {
      key: 'command_poll_interval_ms',
      value: 5000,
    },
  });

  await prisma.event.create({
    data: {
      userId: user.id,
      type: 'seed_created',
      severity: 'info',
      message: 'Initial seed data created',
    },
  });
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
