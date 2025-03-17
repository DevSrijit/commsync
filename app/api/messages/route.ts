import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { TwilioService } from '@/lib/twilio-service';
import { JustCallService } from '@/lib/justcall-service';

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    if (!platform) {
      return NextResponse.json({ error: 'Platform parameter is required' }, { status: 400 });
    }

    // Get accounts for the specified platform
    const accounts = await db.syncAccount.findMany({
      where: {
        userId: session.user.id,
        platform: platform.toLowerCase(),
      },
    });

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    let allMessages: any[] = [];

    // Fetch messages from each account
    for (const account of accounts) {
      try {
        let messages: any[] = [];
        
        if (platform.toLowerCase() === 'twilio') {
          const twilioService = new TwilioService(account);
          messages = await twilioService.getMessages(undefined, limit);
        } else if (platform.toLowerCase() === 'justcall') {
          const justcallService = new JustCallService(account);
          messages = await justcallService.getMessages(undefined, undefined, limit);
        }
        
        // Add account ID to each message for reference
        messages = messages.map(msg => ({
          ...msg,
          accountId: account.id
        }));
        
        allMessages = [...allMessages, ...messages];
      } catch (error) {
        console.error(`Error fetching messages from ${platform} account ${account.id}:`, error);
        // Continue with other accounts
      }
    }

    return NextResponse.json({ messages: allMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
} 