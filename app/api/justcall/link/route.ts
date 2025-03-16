import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { encryptData } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { apiKey, apiSecret, label, phoneNumber } = await req.json();
    
    if (!apiKey || !apiSecret || !label || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Validate credentials by making a test API call
    try {
      const testResponse = await fetch('https://api.justcall.io/v1/account', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}:${apiSecret}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!testResponse.ok) {
        return NextResponse.json({ error: 'Invalid JustCall credentials' }, { status: 400 });
      }
    } catch (error) {
      console.error('Error validating JustCall credentials:', error);
      return NextResponse.json({ error: 'Could not validate JustCall credentials' }, { status: 400 });
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
      fetch('/api/sync', {
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