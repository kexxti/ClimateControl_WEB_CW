import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const main = async () => {
  const seedBaseTime = new Date();
  seedBaseTime.setMinutes(0, 0, 0);

  const admin = await prisma.user.upsert({
    where: { login: 'admin' },
    update: {
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      isActive: true,
    },
    create: {
      login: 'admin',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
    },
  });

  const user = await prisma.user.upsert({
    where: { login: 'user' },
    update: {
      passwordHash: hashPassword('user123'),
      role: 'user',
      isActive: true,
    },
    create: {
      login: 'user',
      passwordHash: hashPassword('user123'),
      role: 'user',
    },
  });

  await prisma.userSetting.upsert({
    where: {
      userId_key: {
        userId: admin.id,
        key: 'theme',
      },
    },
    update: {
      value: 'dark',
    },
    create: {
      userId: admin.id,
      key: 'theme',
      value: 'dark',
    },
  });

  await prisma.userSetting.upsert({
    where: {
      userId_key: {
        userId: user.id,
        key: 'theme',
      },
    },
    update: {
      value: 'light',
    },
    create: {
      userId: user.id,
      key: 'theme',
      value: 'light',
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

  for (const [roomIndex, roomSeed] of rooms.entries()) {
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
    const roomTemperatureBias = (roomIndex - 2) * 0.15;

    for (let index = 0; index < 24; index += 1) {
      const createdAt = new Date(seedBaseTime.getTime() - (23 - index) * 60 * 60 * 1000);
      const dailyWave = Math.sin((index / 23) * Math.PI * 2) * 0.65;
      const controlNoise = (index % 4) * 0.08 - 0.12;
      const temperature = Number((roomSeed.temperature + roomTemperatureBias + dailyWave + controlNoise).toFixed(1));
      const sequence = measurementSequence + BigInt(index);

      await prisma.measurement.upsert({
        where: {
          deviceId_deviceSequence: {
            deviceId: device.id,
            deviceSequence: sequence,
          },
        },
        update: {
          temperature,
          setpointValue: roomSeed.setpoint,
          heaterState: temperature < roomSeed.setpoint,
          createdAt,
          receivedAt: createdAt,
        },
        create: {
          roomId: room.id,
          deviceId: device.id,
          temperature,
          setpointValue: roomSeed.setpoint,
          heaterState: temperature < roomSeed.setpoint,
          algorithmId: pidAlgorithm.id,
          deviceSequence: sequence,
          deviceUptimeMs: BigInt(120000 + index * 60 * 60 * 1000),
          createdAt,
          receivedAt: createdAt,
        },
      });
    }

    const logSequence = measurementSequence + BigInt(900);
    const existingDeviceLog = await prisma.deviceLog.findFirst({
      where: {
        deviceId: device.id,
        deviceSequence: logSequence,
      },
    });

    if (!existingDeviceLog) {
      await prisma.deviceLog.create({
        data: {
          roomId: room.id,
          deviceId: device.id,
          level: roomNumber === '203' ? 'info' : 'warning',
          type: roomNumber === '203' ? 'heartbeat' : 'device_offline',
          message: roomNumber === '203' ? 'Seed heartbeat received' : 'Seed offline warning',
          deviceSequence: logSequence,
          deviceUptimeMs: BigInt(180000),
        },
      });
    }
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

  await prisma.systemSetting.upsert({
    where: { key: 'telemetry_timeout_seconds' },
    update: { value: 45 },
    create: {
      key: 'telemetry_timeout_seconds',
      value: 45,
    },
  });

  const existingSeedEvent = await prisma.event.findFirst({
    where: {
      type: 'seed_created',
    },
  });

  if (!existingSeedEvent) {
    await prisma.event.create({
      data: {
        userId: user.id,
        type: 'seed_created',
        severity: 'info',
        message: 'Initial seed data created',
      },
    });
  }
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
