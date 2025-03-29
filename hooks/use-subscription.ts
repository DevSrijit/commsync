import { useCallback, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { StoredSubscriptionData } from '@/lib/subscription';

/**
 * Hook to fetch and update subscription data
 */
export function useSubscription() {
  const { data: session } = useSession();
  
  const fetchSubscription = useCallback(async (): Promise<StoredSubscriptionData | null> => {
    if (!session?.user) return null;
    
    try {
      const response = await fetch('/api/subscription');
      
      if (response.ok) {
        const data = await response.json();
        return data.subscription;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      return null;
    }
  }, [session?.user]);
  
  const updateSubscription = useCallback(async (aiCreditsUsed: number = 0): Promise<StoredSubscriptionData | null> => {
    if (!session?.user) return null;
    
    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ aiCreditsUsed }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.subscription;
      }
      
      return null;
    } catch (error) {
      console.error('Error updating subscription data:', error);
      return null;
    }
  }, [session?.user]);
  
  return {
    fetchSubscription,
    updateSubscription,
  };
}

/**
 * Simplified hook that only provides the update function
 */
export function useSubscriptionUpdate() {
  const { updateSubscription } = useSubscription();
  return updateSubscription;
}

/**
 * Hook to check if connection limits have been reached
 */
export function useConnectionLimits() {
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [usedConnections, setUsedConnections] = useState(0);
  const [maxConnections, setMaxConnections] = useState(0);
  const { fetchSubscription } = useSubscription();
  const { data: session } = useSession();

  useEffect(() => {
    const checkLimits = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchSubscription();
        
        if (data) {
          const used = data.usedConnections || 0;
          const limit = data.totalConnections || 0;
          setUsedConnections(used);
          setMaxConnections(limit);
          setLimitReached(used >= limit);
        }
      } catch (error) {
        console.error('Error checking connection limits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkLimits();
  }, [session?.user, fetchSubscription]);

  return {
    isLoading,
    limitReached,
    usedConnections,
    maxConnections
  };
}

/**
 * Hook to check if storage limits have been reached
 */
export function useStorageLimits() {
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [usedStorage, setUsedStorage] = useState(0);
  const [maxStorage, setMaxStorage] = useState(0);
  const { fetchSubscription } = useSubscription();
  const { data: session } = useSession();

  useEffect(() => {
    const checkLimits = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchSubscription();
        
        if (data) {
          const used = data.usedStorage || 0;
          const limit = data.totalStorage || 0;
          setUsedStorage(used);
          setMaxStorage(limit);
          setLimitReached(used >= limit);
        }
      } catch (error) {
        console.error('Error checking storage limits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkLimits();
  }, [session?.user, fetchSubscription]);

  return {
    isLoading,
    limitReached,
    usedStorage,
    maxStorage
  };
} 