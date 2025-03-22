import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { syncJustCallAccounts, syncTwilioAccounts } from '@/lib/sync-service';

export async function POST(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract payload
    const payload = await request.json();
    const { platform, authCode, pageSize = 100, accountId, phoneNumber, lastSmsIdFetched, sortDirection = 'desc', isLoadingMore = false } = payload;
    
    // If this is a "Load More" operation, log it clearly
    if (isLoadingMore) {
      console.log(`[${platform.toUpperCase()}] Load More operation with cursor: ${lastSmsIdFetched || 'none'}`);
    } else {
      console.log(`[${platform.toUpperCase()}] Regular sync operation (no cursor)`);
    }

    if (!platform) {
      return NextResponse.json({ error: 'Platform parameter is required' }, { status: 400 });
    }

    let result;
    
    // Sync messages based on platform
    switch (platform.toLowerCase()) {
      case 'twilio':
        // For Twilio, we might want to add phoneNumber filtering in the future
        result = await syncTwilioAccounts(session.user.id);
        break;
      case 'justcall':
        // Pass the userId, phoneNumber, and accountId to the sync function
        result = await syncJustCallAccounts(session.user.id, { 
          phoneNumber, 
          accountId,
          pageSize,
          // Only include lastSmsIdFetched if this is a load more operation
          ...(isLoadingMore ? { lastSmsIdFetched } : {}),
          sortDirection
        });
        break;
      default:
        return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error syncing messages:', error);
    return NextResponse.json(
      { error: 'Failed to sync messages' },
      { status: 500 }
    );
  }
} 