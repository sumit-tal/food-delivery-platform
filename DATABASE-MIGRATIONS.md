# Database Migrations Guide

This document provides instructions for managing database migrations in the SwiftEats food delivery platform.

## Overview

We use TypeORM for database management and migrations. Migrations allow us to:

1. Version control database schema changes
2. Apply changes consistently across environments
3. Roll back changes when needed
4. Maintain data integrity during schema updates

## Prerequisites

- PostgreSQL database server running
- Environment variables properly configured (see `.env.example`)

## Migration Commands

The following commands are available for managing migrations:

### Create a new migration

```bash
# Create an empty migration file
npm run migration:create --name=MigrationName
```

### Generate a migration based on entity changes

```bash
# Generate a migration by comparing current entities with the database schema
npm run migration:generate --name=MigrationName
```

### Run pending migrations

```bash
# Apply all pending migrations
npm run migration:run
```

### Revert the last migration

```bash
# Revert the most recently applied migration
npm run migration:revert
```

### Show migration status

```bash
# Show the status of all migrations
npm run migration:show
```

### Sync schema (development only)

```bash
# Synchronize database schema with current entities (CAUTION: data loss possible)
npm run schema:sync
```

### Drop schema (development only)

```bash
# Drop all tables (CAUTION: all data will be lost)
npm run schema:drop
```

## Migration Best Practices

1. **Never use `synchronize: true` in production** - Always use migrations to update the database schema in production environments.

2. **Test migrations thoroughly** - Before applying migrations to production, test them in a staging environment with production-like data.

3. **Include both up and down methods** - Always implement both the `up` and `down` methods in your migrations to allow for rollbacks.

4. **Keep migrations small and focused** - Each migration should handle a specific change to make troubleshooting easier.

5. **Use transactions** - Wrap complex migrations in transactions to ensure atomicity.

6. **Consider data migrations** - When changing column types or structures, include data migration steps to preserve existing data.

7. **Document breaking changes** - If a migration includes breaking changes, document them clearly.

## TypeORM Configuration

The TypeORM configuration is defined in `src/config/typeorm.config.ts`. This configuration is used by the migration commands and can be customized as needed.

Key configuration options:

- `entities`: Specifies the location of entity files
- `migrations`: Specifies the location of migration files
- `synchronize`: Should be set to `false` in production
- `migrationsRun`: Whether to automatically run migrations on application start

## Troubleshooting

### Migration fails to apply

1. Check the error message for specific issues
2. Verify that the database user has sufficient privileges
3. Ensure that the migration doesn't conflict with existing schema or data
4. Try running the migration manually using SQL commands

### Migration conflicts

If you have conflicts between migrations:

1. Revert to a known good state using `npm run migration:revert`
2. Fix the conflicting migration
3. Re-apply the migrations using `npm run migration:run`

## Additional Resources

- [TypeORM Migrations Documentation](https://typeorm.io/#/migrations)
- [Database Schema Design Best Practices](https://www.postgresql.org/docs/current/ddl-schemas.html)
