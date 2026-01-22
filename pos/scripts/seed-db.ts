import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../src/db/schema';
import { uuidv7 } from '../src/lib/uuid7';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), 'pos/.env') });

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL must be set in the pos/.env file');
}

const client = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

const db = drizzle(client, { schema });

console.log('Seeding TursoDB database...');

// Run migrations
console.log('Running migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations complete!');

// Seed demo users
console.log('Seeding demo users...');

const passwordHash = Buffer.from('password123').toString('base64');
const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

const demoUsers = [
  {
    id: uuidv7(),
    username: 'normal_user',
    passwordHash,
    role: 'NORMAL',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: uuidv7(),
    username: 'vip_user',
    passwordHash,
    role: 'VIP',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: uuidv7(),
    username: 'manager',
    passwordHash,
    role: 'MANAGER',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];

// Check if users already exist
const existingUsers = await db.select().from(schema.users);
if (existingUsers.length === 0) {
  await db.insert(schema.users).values(demoUsers);
  console.log('Demo users created!');
} else {
  console.log('Users already exist, skipping...');
}

// Seed initial bots (2 bots)
console.log('Seeding initial bots...');
const existingBots = await db.select().from(schema.bots);
if (existingBots.length === 0) {
  const botsToInsert = [];
  for (let i = 1; i <= 2; i++) {
    const botId = uuidv7();
    botsToInsert.push({
      id: botId,
      status: 'IDLE',
      currentOrderId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    });
  }
  await db.insert(schema.bots).values(botsToInsert);
  console.log('Initial bots created!');
} else {
  console.log('Bots already exist, skipping...');
}

// Verify seeded data
const userCountResult = await db.select({ count: schema.sql`count(*)` }).from(schema.users);
const botCountResult = await db.select({ count: schema.sql`count(*)` }).from(schema.bots);
const userCount = userCountResult[0].count;
const botCount = botCountResult[0].count;


console.log(`\nDatabase seeded successfully!`);
console.log(`- ${userCount} users`);
console.log(`- ${botCount} bots`);
console.log(`\nDatabase location: ${tursoUrl}`);