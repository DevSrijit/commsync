import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { z } from 'zod';
import { Conversation } from '@prisma/client';
// Get all Twilio accounts for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    const accounts = await db.twilioAccount.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        label: true,
        phoneNumber: true,
        accountSid: true,
        lastSync: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return NextResponse.json(accounts, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching Twilio accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete a Twilio account
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const accountId = req.nextUrl.searchParams.get('id');
    
    if (!accountId) {
      return NextResponse.json({ error: 'Missing account ID' }, { status: 400 });
    }
    
    // Verify the account belongs to the user
    const account = await db.twilioAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });
    
    if (!account) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
    }
    
    // Delete messages from the main message table
    const deletedMessages = await db.message.deleteMany({
      where: {
        platform: "twilio",
        metadata: {
          equals: { twilioAccountId: accountId },
        },
      },
    });

    // Find empty conversations (those with no messages left)
    const emptyConversations = await db.conversation.findMany({
      where: {
        messages: {
          none: {},
        },
      },
    });

    // Delete empty conversations
    if (emptyConversations.length > 0) {
      await db.conversation.deleteMany({
        where: {
          id: {
            in: emptyConversations.map((conv: Conversation) => conv.id),
          },
        },
      });
    }

    // Finally, delete the Twilio account
    await db.twilioAccount.delete({
      where: {
        id: accountId,
      },
    });
    
    return NextResponse.json({ status: 'success' }, { status: 200 });
    
  } catch (error) {
    console.error('Error deleting Twilio account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 