import { updateSubscriptionUsage } from "@/lib/subscription";

// Check if the environment is browser
const isBrowser = typeof window !== "undefined";

/**
 * Constants for AI feature credit costs
 */
export const AI_CREDIT_COSTS = {
  GENERATE_RESPONSE: 1,
  SUMMARIZE_THREAD: 2,
  ANALYZE_SENTIMENT: 1,
  TRANSLATE_MESSAGE: 1,
  SCHEDULE_SUGGESTION: 1,
  DRAFT_EMAIL: 2,
};

/**
 * Record AI credit usage for a specific feature
 * Returns true if credits were successfully consumed
 */
export async function recordAiCreditUsage(
  subscriptionId: string,
  feature: keyof typeof AI_CREDIT_COSTS,
  userId: string,
  userStorageUsed: number = 0,
  userConnections: number = 0
): Promise<boolean> {
  try {
    const creditCost = AI_CREDIT_COSTS[feature];

    // If in browser environment, use the API endpoint instead of direct database access
    if (isBrowser) {
      // Use the API endpoint to update subscription usage
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aiCreditsUsed: creditCost,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to record AI credit usage");
      }

      const data = await response.json();
      return data.success;
    } else {
      // Server-side: directly update subscription usage
      const updatedSubscription = await updateSubscriptionUsage(
        subscriptionId,
        userStorageUsed,
        userConnections,
        creditCost
      );

      // Return true if the update was successful
      return !!updatedSubscription;
    }
  } catch (error) {
    console.error(
      `Error recording AI credit usage for feature ${feature}:`,
      error
    );
    return false;
  }
}

/**
 * Check if a user has enough credits for a particular AI feature
 */
export async function hasEnoughCreditsForFeature(
  subscriptionData: { usedAiCredits: number; totalAiCredits: number } | null,
  feature: keyof typeof AI_CREDIT_COSTS
): Promise<boolean> {
  if (!subscriptionData) return false;

  const creditCost = AI_CREDIT_COSTS[feature];
  const { usedAiCredits, totalAiCredits } = subscriptionData;

  // Check if there are enough credits remaining
  return usedAiCredits + creditCost <= totalAiCredits;
}

/**
 * Hook for client-side AI credit usage
 */
export function useAiCredits() {
  /**
   * Record usage of an AI feature and update in the database
   */
  async function useFeature(
    feature: keyof typeof AI_CREDIT_COSTS
  ): Promise<boolean> {
    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aiCreditsUsed: AI_CREDIT_COSTS[feature],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to record AI credit usage");
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("Error recording AI credit usage:", error);
      return false;
    }
  }

  return { useFeature };
}
