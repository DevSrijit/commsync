import { PrismaClient as PrismaClientMongo } from '@prisma/client';
import { PrismaClient as PrismaClientPostgres } from '@prisma/client';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

// This is a skeleton migration script to help with data migration
// You'll need to customize it for your specific data structures

async function main() {
  console.log('Starting migration from MongoDB to PostgreSQL...');
  
  // Connect to MongoDB directly
  const mongoUri = process.env.MONGODB_URI || '';
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  console.log('Connected to MongoDB');
  
  // Connect to Postgres via Prisma
  const postgres = new PrismaClientPostgres();
  console.log('Connected to PostgreSQL');
  
  try {
    // Get MongoDB collections
    const db = mongoClient.db();
    
    // Example: Migrate users
    console.log('Migrating users...');
    const usersMongo = await db.collection('User').find({}).toArray();
    
    for (const userMongo of usersMongo) {
      try {
        // Convert MongoDB _id to cuid for PostgreSQL
        const userData = {
          id: userMongo._id.toString(), // Keep the same ID but as string
          name: userMongo.name,
          email: userMongo.email,
          emailVerified: userMongo.emailVerified,
          image: userMongo.image,
          createdAt: userMongo.createdAt || new Date(),
          updatedAt: userMongo.updatedAt || new Date(),
          stripeCustomerId: userMongo.stripeCustomerId,
        };
        
        await postgres.user.create({
          data: userData
        });
      } catch (error) {
        console.error(`Failed to migrate user ${userMongo._id}:`, error);
      }
    }
    
    console.log(`Migrated ${usersMongo.length} users`);
    
    // You would repeat similar processes for other models
    // Important: Consider the order of migration due to relations
    // Suggested order:
    // 1. Users
    // 2. ImapAccounts, SyncAccounts, etc.
    // 3. Contacts
    // 4. Groups
    // 5. Conversations
    // 6. Messages
    // 7. Organizations
    // 8. Subscriptions
    
    // Keep track of progress to resume if migration is interrupted
    // Consider implementing checkpointing and pagination for large datasets
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Clean up connections
    await mongoClient.close();
    await postgres.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    console.log('Migration script execution completed');
  }); 