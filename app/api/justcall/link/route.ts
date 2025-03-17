import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { encryptData } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  try {
    // Capture request headers for debugging
    const authHeader = req.headers.get('authorization');
    const cookieHeader = req.headers.get('cookie');
    console.log('Auth header present:', !!authHeader);
    console.log('Cookie header present:', !!cookieHeader);
    
    const session = await getServerSession(authOptions);
    
    // Enhanced session debugging
    console.log('Session in JustCall link API:', {
      hasSession: !!session,
      hasUser: !!(session?.user),
      userId: session?.user?.id || 'undefined',
      userEmail: session?.user?.email || 'undefined',
      sessionObject: JSON.stringify(session),
    });
    
    if (!session || !session.user || !session.user.id) {
      // Return more specific unauthorized error
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: !session ? 'No session found' : 
                 !session.user ? 'No user in session' : 
                 !session.user.id ? 'No user ID in session' : 'Unknown session issue' 
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { apiKey, apiSecret, label, phoneNumber } = await req.json();
    
    if (!apiKey || !apiSecret || !label || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Validate credentials by making a test API call to the V2 API
    try {
      const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const testResponse = await fetch('https://api.justcall.io/v2.1/texts', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!testResponse.ok) {
        const errorData = await testResponse.json().catch(() => ({}));
        const statusCode = testResponse.status;
        let errorMessage = 'Invalid JustCall credentials';
        
        if (statusCode === 401) {
          errorMessage = 'Unauthorized: JustCall API key or secret is invalid';
        } else if (statusCode === 403) {
          errorMessage = 'Forbidden: JustCall API access denied';
        } else if (statusCode === 404) {
          errorMessage = 'JustCall API endpoint not found';
        } else if (statusCode === 429) {
          errorMessage = 'Rate limited: Too many requests to JustCall API';
        } else if (statusCode === 500) {
          errorMessage = 'JustCall server error. Please try again later or contact JustCall support.';
        } else if (errorData.message) {
          errorMessage = `JustCall API error: ${errorData.message}`;
        }
        
        console.error('JustCall credential validation failed:', { statusCode, error: errorData });
        return NextResponse.json({ error: errorMessage }, { status: 400 });
      }
      
      // Verify we can also access the phone numbers endpoint to confirm full API access
      const phoneNumbersResponse = await fetch('https://api.justcall.io/v2.1/phone-numbers', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!phoneNumbersResponse.ok) {
        console.error('JustCall phone numbers API validation failed:', { 
          status: phoneNumbersResponse.status, 
          statusText: phoneNumbersResponse.statusText 
        });
        
        return NextResponse.json({ 
          error: 'Could not verify JustCall phone numbers access. API key may have limited permissions.' 
        }, { status: 400 });
      }
      
      // Verify the API response contains expected data structure
      const smsData = await testResponse.json();
      if (!smsData || typeof smsData.data === 'undefined') {
        return NextResponse.json({ error: 'Invalid response from JustCall API' }, { status: 400 });
      }
      
      // Verify the phone number exists in the JustCall account
      const phoneNumbersData = await phoneNumbersResponse.json();
      const phoneNumbers = phoneNumbersData.data || [];
      
      // Normalize the provided phone number by removing all non-numeric characters
      const normalizedInputNumber = phoneNumber.replace(/\D/g, '');
      
      // Log available phone numbers for debugging
      console.log('JustCall API raw response:', JSON.stringify(phoneNumbersData, null, 2).substring(0, 500) + '...');
      console.log('JustCall Available Phone Numbers:', phoneNumbers.map((entry: any) => entry.justcall_number || 'N/A'));
      console.log('Trying to match with:', phoneNumber, 'Normalized:', normalizedInputNumber);

      const phoneNumberExists = phoneNumbers.some((entry: any) => {
        // Normalize the JustCall phone number by removing all non-numeric characters
        const normalizedJustCallNumber = (entry.justcall_number || '').replace(/\D/g, '');
        
        // Try multiple formats for comparison
        return entry.justcall_number === phoneNumber || 
               entry.justcall_number === phoneNumber.replace(/^\+/, '') ||
               normalizedJustCallNumber === normalizedInputNumber ||
               // For cases where country code might be different (e.g., with/without leading 1)
               (normalizedInputNumber.length > 10 && normalizedJustCallNumber.endsWith(normalizedInputNumber.slice(-10))) ||
               (normalizedJustCallNumber.length > 10 && normalizedInputNumber.endsWith(normalizedJustCallNumber.slice(-10)));
      });
      
      if (!phoneNumberExists && phoneNumbers.length > 0) {
        return NextResponse.json({ 
          error: 'The provided phone number does not exist in your JustCall account',
          availableNumbers: phoneNumbers.map((entry: any) => entry.justcall_number || entry.friendly_number),
          providedNumber: phoneNumber,
          normalizedNumber: normalizedInputNumber,
          message: 'Please use one of the available phone numbers from your JustCall account. Make sure to use the exact format shown.'
        }, { status: 400 });
      }
      
    } catch (error) {
      console.error('Error validating JustCall credentials:', error);
      return NextResponse.json({ 
        error: 'Could not validate JustCall credentials. Please check your network connection and try again.' 
      }, { status: 400 });
    }
    
    // Store the credentials securely
    const credentials = {
      apiKey,
      apiSecret,
      phoneNumber
    };
    
    const encryptedCredentials = encryptData(JSON.stringify(credentials));
    
    // Create a new sync account
    const syncAccount = await db.syncAccount.create({
      data: {
        userId,
        platform: 'justcall',
        credentials: encryptedCredentials,
        accountIdentifier: phoneNumber,
      },
    });
    
    // Trigger an initial sync in the background
    try {
      // Get the base URL from request headers
      const protocol = req.headers.get('x-forwarded-proto') || 'http';
      const host = req.headers.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      
      fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'justcall',
        }),
      }).catch(error => {
        console.error('Failed to trigger initial sync:', error);
      });
    } catch (error) {
      console.error('Error triggering initial sync:', error);
      // Continue with the response even if sync trigger fails
    }
    
    return NextResponse.json({ 
      status: 'success', 
      account: {
        id: syncAccount.id,
        platform: syncAccount.platform,
        label,
        accountIdentifier: phoneNumber,
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error linking JustCall account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 