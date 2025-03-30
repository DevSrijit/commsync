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
    
    // Handle based on platform
    if (platform === 'twilio') {
      // Twilio implementation...
      // ... (existing Twilio code)
    } else if (platform === 'justcall') {
      // JustCall implementation
      const account = accounts[0]; // Use first account if multiple
      if (!account) {
        return NextResponse.json({ error: 'No JustCall account found' }, { status: 404 });
      }
      
      const justcallService = new JustCallService(account);
      
      try {
        // Call getMessages with proper parameters
        const { messages, rateLimitInfo } = await justcallService.getMessages(
          phoneNumber || undefined, 
          undefined, // fromDate
          pageSize,
          lastSmsIdFetched || undefined,
          sortDirection
        );
        
        // Return both messages and rate limit info
        return NextResponse.json({
          messages: messages || [],
          rateLimitInfo,
          count: messages?.length || 0,
        });
      } catch (error: any) {
        console.error('Error fetching JustCall messages:', error);
        
        // Check if this is a rate limit error based on status code
        if (error.status === 429 || (error.message && error.message.includes('rate limit'))) {
          // Try to extract rate limit information if available
          const rateLimitInfo = {
            isRateLimited: true,
            remaining: 0,
            limit: 1000,
            resetTimestamp: Date.now() + 60000, // Default 1 minute
            retryAfterSeconds: 60
          };
          
          // If the error has specific rate limit details, use them
          if (error.retryAfter) {
            rateLimitInfo.retryAfterSeconds = error.retryAfter;
            rateLimitInfo.resetTimestamp = Date.now() + (error.retryAfter * 1000);
          }
          
          return NextResponse.json({
            messages: [],
            rateLimitInfo,
            count: 0,
            error: 'Rate limit exceeded'
          }, { status: 429 });
        }
        
        return NextResponse.json({ 
          messages: [], 
          error: error.message || 'Failed to fetch JustCall messages' 
        }, { status: 500 });
      }
    }
    
    // If we get here without returning, the platform wasn't handled
    return NextResponse.json({ 
      error: `Unsupported platform: ${platform}` 
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('Error in messages API:', error);
    return NextResponse.json({
      error: error.message || 'An error occurred while fetching messages',
    }, { status: 500 });
  }
} 
