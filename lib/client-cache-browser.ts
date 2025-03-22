/**
 * Browser-compatible client for working with the server-side cache
 * This is to be used in client components where server-side functions cannot be directly called
 */

/**
 * Set a value in the cache
 */
export async function setCacheValue(key: string, value: any): Promise<void> {
  try {
    await fetch('/api/cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, value }),
      credentials: 'include',
    });
  } catch (error) {
    console.error(`Failed to set cache value for key ${key}:`, error);
  }
}

/**
 * Get a value from the cache
 */
export async function getCacheValue<T = any>(key: string): Promise<T | null> {
  try {
    const response = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get cache value: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value;
  } catch (error) {
    console.error(`Failed to get cache value for key ${key}:`, error);
    return null;
  }
}

/**
 * Remove a value from the cache
 */
export async function removeCacheValue(key: string): Promise<void> {
  try {
    await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    console.error(`Failed to remove cache value for key ${key}:`, error);
  }
}

/**
 * Get multiple values from the cache
 */
export async function getMultipleCacheValues<T = Record<string, any>>(keys: string[]): Promise<T> {
  try {
    const queryString = keys.map(key => `key=${encodeURIComponent(key)}`).join('&');
    const response = await fetch(`/api/cache/multiple?${queryString}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get multiple cache values: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.values as T;
  } catch (error) {
    console.error(`Failed to get multiple cache values:`, error);
    return {} as T;
  }
} 