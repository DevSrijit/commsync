import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSubscriptionUsage, calculateUserCacheSize, countUserConnections } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id as string;
    const body = await request.json();
    const { contactEmails } = body;
    
    if (!contactEmails || !Array.isArray(contactEmails) || contactEmails.length === 0) {
      return NextResponse.json({ error: "Invalid request. Contact emails are required." }, { status: 400 });
    }
    
    // Find messages related to these contacts
    const messages = await db.message.findMany({
      where: {
        OR: [
          {
            // Messages where contacts are senders
            platform: 'email',
            metadata: {
              path: ['from', 'email'],
              array_contains: contactEmails,
            },
          },
          {
            // Messages where contacts are recipients
            platform: 'email',
            metadata: {
              path: ['to'],
              array_contains: contactEmails,
            },
          },
          {
            // SMS messages
            OR: [
              {
                platform: 'twilio',
                OR: [
                  { from: { in: contactEmails } },
                  { to: { in: contactEmails } },
                ],
              },
              {
                platform: 'justcall',
                OR: [
                  { from: { in: contactEmails } },
                  { to: { in: contactEmails } },
                ],
              },
            ],
          },
        ],
      },
    });
    
    // Also find and delete any cached conversations in ClientCache
    const cacheEntries = await db.clientCache.findMany({
      where: {
        userId,
        OR: contactEmails.map(email => ({
          key: {
            contains: email
          }
        }))
      }
    });
    
    // Delete the found messages
    const deleteMessagesPromise = db.message.deleteMany({
      where: {
        id: {
          in: messages.map(message => message.id)
        }
      }
    });
    
    // Delete the cache entries
    const deleteCachePromise = db.clientCache.deleteMany({
      where: {
        id: {
          in: cacheEntries.map(entry => entry.id)
        }
      }
    });
    
    // Execute both delete operations concurrently
    const [deletedMessages, deletedCache] = await Promise.all([
      deleteMessagesPromise,
      deleteCachePromise
    ]);
    
    // Get user's subscription for this org
    // Find the user and their organization
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: {
            subscription: true
          }
        },
        ownedOrganizations: {
          include: {
            subscription: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find an organization this user belongs to that has a subscription
    const userOrg = user.organizations.find(org => org.subscription) || 
                 user.ownedOrganizations.find(org => org.subscription);

    if (userOrg?.subscription) {
      // Calculate the updated usage
      const updatedStorageUsed = await calculateUserCacheSize(userId);
      const connectionsCount = await countUserConnections(userId);
      
      // Update the subscription usage
      await updateSubscriptionUsage(
        userOrg.subscription.id,
        updatedStorageUsed,
        connectionsCount,
        0 // No AI credits change
      );
    }
    
    return NextResponse.json({
      success: true,
      count: {
        messages: deletedMessages.count,
        cache: deletedCache.count
      }
    });
  } catch (error) {
    console.error("Error deleting messages:", error);
    return NextResponse.json({ error: "Failed to delete messages" }, { status: 500 });
  }
} 