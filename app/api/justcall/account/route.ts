import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Get all JustCall accounts for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    const accounts = await prisma.syncAccount.findMany({
      where: {
        userId,
        platform: 'justcall',
      },
      select: {
        id: true,
        platform: true,
        accountIdentifier: true,
        lastSync: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    return NextResponse.json(accounts, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching JustCall accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete a JustCall account
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
    const account = await prisma.syncAccount.findFirst({
      where: {
        id: accountId,
        userId,
        platform: 'justcall',
      },
    });
    
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Delete all messages from this account
    const messages = await prisma.message.findMany({
      where: {
        syncAccountId: accountId,
      },
      select: {
        id: true,
        conversationId: true,
      },
    });
    
    // Get list of affected conversation IDs
    const conversationIds = [...new Set(messages.map(m => m.conversationId))];
    
    // Delete messages
    await prisma.message.deleteMany({
      where: {
        syncAccountId: accountId,
      },
    });
    
    // Clean up empty conversations
    for (const conversationId of conversationIds) {
      const remainingMessages = await prisma.message.count({
        where: {
          conversationId,
        },
      });
      
      if (remainingMessages === 0) {
        await prisma.conversation.delete({
          where: {
            id: conversationId,
          },
        });
      }
    }
    
    // Delete the account
    await prisma.syncAccount.delete({
      where: {
        id: accountId,
      },
    });
    
    return NextResponse.json({ status: 'success' }, { status: 200 });
    
  } catch (error) {
    console.error('Error deleting JustCall account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 