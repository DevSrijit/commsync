import { db } from './db';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';

/**
 * Utility functions for storing and retrieving client-side cache data in the database
 * This replaces localStorage and cookies for persistent client-side data
 */

/**
 * Set a cache value in the database
 */
export async function setCacheValue(key: string, value: any, userId?: string): Promise<void> {
  const session = userId ? null : await getServerSession(authOptions);
  const userIdToUse = userId || session?.user?.id;
  
  if (!userIdToUse) {
    console.error('Cannot set cache value: No user ID provided or found in session');
    return;
  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  await db.clientCache.upsert({
    where: {
      userId_key: {
        userId: userIdToUse,
        key,
      },
    },
    update: {
      value: stringValue,
      updatedAt: new Date(),
    },
    create: {
      userId: userIdToUse,
      key,
      value: stringValue,
    },
  });
}

/**
 * Get a cache value from the database
 */
export async function getCacheValue<T = any>(key: string, userId?: string): Promise<T | null> {
  const session = userId ? null : await getServerSession(authOptions);
  const userIdToUse = userId || session?.user?.id;
  
  if (!userIdToUse) {
    console.error('Cannot get cache value: No user ID provided or found in session');
    return null;
  }

  const cacheEntry = await db.clientCache.findUnique({
    where: {
      userId_key: {
        userId: userIdToUse,
        key,
      },
    },
  });

  if (!cacheEntry) {
    return null;
  }

  try {
    return JSON.parse(cacheEntry.value) as T;
  } catch (e) {
    // If it can't be parsed as JSON, return as string
    return cacheEntry.value as unknown as T;
  }
}

/**
 * Remove a cache value from the database
 */
export async function removeCacheValue(key: string, userId?: string): Promise<void> {
  const session = userId ? null : await getServerSession(authOptions);
  const userIdToUse = userId || session?.user?.id;
  
  if (!userIdToUse) {
    console.error('Cannot remove cache value: No user ID provided or found in session');
    return;
  }

  await db.clientCache.deleteMany({
    where: {
      userId: userIdToUse,
      key,
    },
  });
}

/**
 * Get multiple cache values at once
 */
export async function getMultipleCacheValues(keys: string[], userId?: string): Promise<Record<string, any>> {
  const session = userId ? null : await getServerSession(authOptions);
  const userIdToUse = userId || session?.user?.id;
  
  if (!userIdToUse) {
    console.error('Cannot get multiple cache values: No user ID provided or found in session');
    return {};
  }

  const cacheEntries = await db.clientCache.findMany({
    where: {
      userId: userIdToUse,
      key: {
        in: keys,
      },
    },
  });

  const result: Record<string, any> = {};
  
  for (const entry of cacheEntries) {
    try {
      result[entry.key] = JSON.parse(entry.value);
    } catch (e) {
      result[entry.key] = entry.value;
    }
  }

  return result;
} 