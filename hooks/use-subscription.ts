import { useCallback } from 'react';
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