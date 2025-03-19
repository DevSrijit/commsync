/**
 * Browser-compatible client for working with the server-side cache
 * This is to be used in client components where localStorage was previously used
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
    
    // Fallback to localStorage during migration
    if (typeof window !== 'undefined') {
      try {
        if (typeof value === 'string') {
          localStorage.setItem(key, value);
        } else {
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch (e) {
        console.error(`Fallback to localStorage failed for key ${key}:`, e);
      }
    }
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
    
    // Fallback to localStorage during migration
    if (typeof window !== 'undefined') {
      try {
        const value = localStorage.getItem(key);
        if (value === null) return null;
        
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      } catch (e) {
        console.error(`Fallback to localStorage failed for key ${key}:`, e);
      }
    }
    
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
    
    // Also remove from localStorage during migration
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error(`Failed to remove from localStorage for key ${key}:`, e);
      }
    }
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
    
    // Fallback to localStorage during migration
    if (typeof window !== 'undefined') {
      try {
        const result: Record<string, any> = {};
        
        for (const key of keys) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            try {
              result[key] = JSON.parse(value);
            } catch {
              result[key] = value;
            }
          }
        }
        
        return result as T;
      } catch (e) {
        console.error(`Fallback to localStorage failed for multiple keys:`, e);
      }
    }
    
    return {} as T;
  }
} 