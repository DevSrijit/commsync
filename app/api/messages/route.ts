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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const phoneNumber = searchParams.get('phoneNumber');
    const accountId = searchParams.get('accountId');
    const sortDirection = searchParams.get('sortDirection') as 'asc' | 'desc' || 'desc';
    const lastSmsIdFetched = searchParams.get('lastSmsIdFetched');
    
    if (!platform) {
      return NextResponse.json({ error: 'Platform parameter is required' }, { status: 400 });
    }

    // Get accounts for the specified platform
    const accountsQuery: any = {
      userId: session.user.id,
      platform: platform.toLowerCase(),
    };
    
    // If accountId is specified, filter to just that account
    if (accountId) {
      accountsQuery.id = accountId;
    }
    
    const accounts = await db.syncAccount.findMany({
      where: accountsQuery,
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
          
          // For JustCall, use the phoneNumber from query params or the accountIdentifier
          const phoneToUse = phoneNumber || account.accountIdentifier;
          
          if (!phoneToUse) {
            console.warn(`No phone number specified for JustCall account ${account.id}, skipping`);
            continue;
          }
          
          console.log(`Fetching messages for JustCall account ${account.id}:`);
          console.log(`- Phone: ${phoneToUse}`);
          console.log(`- Sort direction: ${sortDirection}`);
          console.log(`- Pagination cursor (lastSmsIdFetched): ${lastSmsIdFetched || 'none'}`);
          
          // Use cursor-based pagination with lastSmsIdFetched instead of page numbers
          messages = await justcallService.getMessages(
            phoneToUse, 
            undefined, // No date filtering
            pageSize,
            lastSmsIdFetched || undefined,
            sortDirection as 'asc' | 'desc'
          );
          console.log(`Retrieved ${messages.length} messages from JustCall`);
          
          // Log the ID range to help with troubleshooting pagination
          if (messages.length > 0) {
            const firstId = messages[0].id;
            const lastId = messages[messages.length - 1].id;
            console.log(`Message ID range: ${firstId} - ${lastId}`);
          }
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

    // For JustCall with cursor-based pagination, we don't need to apply additional pagination
    if (platform.toLowerCase() === 'justcall') {
      return NextResponse.json({ 
        messages: allMessages,
        total: allMessages.length
      });
    }
    
    // Apply pagination to the results for other platforms
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMessages = allMessages.slice(startIndex, endIndex);

    return NextResponse.json({ 
      messages: paginatedMessages,
      total: allMessages.length,
      page,
      pageSize,
      totalPages: Math.ceil(allMessages.length / pageSize)
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
} 
