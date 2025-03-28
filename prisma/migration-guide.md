# Migration Guide: MongoDB to PostgreSQL

This guide outlines the steps to migrate your CommSync application from MongoDB to PostgreSQL.

## 1. Update Environment Variables

Update your `.env` file to use a PostgreSQL connection string:

```
# Old MongoDB connection string
# DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"

# New PostgreSQL connection string
DATABASE_URL="postgresql://username:password@localhost:5432/database?schema=public"
```

## 2. Install PostgreSQL Dependencies

```bash
npm install pg @prisma/client@latest
# or
yarn add pg @prisma/client@latest
```

## 3. Create a New PostgreSQL Database

Set up a PostgreSQL database using your preferred method (local installation, Docker, cloud provider).

## 4. Generate and Apply Migration

Generate a migration from your updated schema:

```bash
npx prisma migrate dev --name mongodb-to-postgresql
```

This will:
1. Create a new migration in `prisma/migrations/`
2. Apply the migration to your database
3. Generate an updated Prisma client

## 5. Data Migration

Since the data structures between MongoDB and PostgreSQL are different, you'll need to migrate your data:

1. Export data from MongoDB (using a tool like mongodump or mongoexport)
2. Transform the data to match the new schema (converting ObjectIDs to cuid, adjusting relations)
3. Import the transformed data into PostgreSQL

For complex data migration, consider creating a custom script using Prisma's API to:
- Read data from MongoDB using your old schema
- Write data to PostgreSQL using the new schema

## 6. Update ID Handling in Your Application

The migration changes ID generation from MongoDB's ObjectId to Prisma's cuid. Review your application code for:

- Places that expect MongoDB ObjectID format
- Custom ID generation or validation
- Manual database queries that don't use Prisma client

## 7. Testing

Before deploying to production:

1. Run your application against the new PostgreSQL database
2. Test all major features
3. Verify that relationships between models work correctly
4. Check performance for critical queries

## 8. Deployment

When deploying:

1. Update your production DATABASE_URL environment variable
2. Apply migrations to your production PostgreSQL database:
   ```bash
   npx prisma migrate deploy
   ``` 