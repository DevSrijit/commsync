import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { JustCallService } from '@/lib/justcall-service';

export async function GET(request: Request) {
  try {
    // Verify authentication - only allow in development environment for security
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Debug endpoints only available in development' }, { status: 403 });
    }
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get parameters
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Get the JustCall accounts
    const query: any = { platform: 'justcall', userId: session.user.id };
    if (accountId) query.id = accountId;
    
    const accounts = await db.syncAccount.findMany({
      where: query,
    });
    
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'No JustCall accounts found' }, { status: 404 });
    }
    
    const results: any[] = [];
    
    // For each account, run the diagnostic tests
    for (const account of accounts) {
      try {
        console.log(`Running JustCall diagnostics for account ${account.id}`);
        
        // Initialize the service
        const justCallService = new JustCallService(account);
        
        // Collect diagnostic information
        const diagnostics: any = {
          accountId: account.id,
          accountIdentifier: account.accountIdentifier,
          tests: []
        };
        
        // Test 1: Get phone numbers
        try {
          const phoneNumbers = await justCallService.getPhoneNumbers();
          diagnostics.tests.push({
            name: 'getPhoneNumbers',
            status: 'success',
            count: phoneNumbers.length,
            data: phoneNumbers
          });
        } catch (error: any) {
          diagnostics.tests.push({
            name: 'getPhoneNumbers',
            status: 'error',
            message: error.message
          });
        }
        
        // Test 2: Get all texts without filtering
        try {
          const allTexts = await justCallService.getAllTextsDebug(limit);
          diagnostics.tests.push({
            name: 'getAllTextsDebug',
            status: 'success',
            count: allTexts?.data?.length || 0
          });
        } catch (error: any) {
          diagnostics.tests.push({
            name: 'getAllTextsDebug',
            status: 'error',
            message: error.message
          });
        }
        
        // Test 3: Get messages with normal filtering
        try {
          const result = await justCallService.getMessages(
            account.accountIdentifier,
            undefined,
            limit
          );
          
          const { messages, rateLimited, retryAfter } = result;
          
          diagnostics.tests.push({
            name: 'getMessages',
            status: 'success',
            count: messages.length,
            phoneNumber: account.accountIdentifier,
            rateLimited,
            retryAfter
          });
        } catch (error: any) {
          diagnostics.tests.push({
            name: 'getMessages',
            status: 'error',
            message: error.message,
            phoneNumber: account.accountIdentifier
          });
        }
        
        results.push(diagnostics);
      } catch (accountError: any) {
        results.push({
          accountId: account.id,
          error: accountError.message
        });
      }
    }
    
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Error in JustCall diagnostics:', error);
    return NextResponse.json(
      { error: 'Diagnostic error', message: error.message },
      { status: 500 }
    );
  }
} 