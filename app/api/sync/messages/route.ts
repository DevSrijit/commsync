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

    // Get the platform and other parameters from request body
    const { platform, phoneNumber, accountId, page, pageSize, oldestDate, sortDirection } = await request.json();

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
          page,
          pageSize,
          oldestDate,
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