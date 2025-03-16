import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { z } from 'zod';
import { Twilio } from 'twilio';

const twilioAccountSchema = z.object({
  label: z.string().min(1, "Label is required"),
  accountSid: z.string().min(1, "Account SID is required"),
  authToken: z.string().min(1, "Auth Token is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const body = await req.json();
    const validationResult = twilioAccountSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid data', details: validationResult.error.format() }, { status: 400 });
    }
    
    const { label, accountSid, authToken, phoneNumber } = validationResult.data;
    
    // Verify the Twilio credentials by making a test API call
    try {
      const twilioClient = new Twilio(accountSid, authToken);
      await twilioClient.api.accounts(accountSid).fetch();
    } catch (error) {
      console.error('Twilio API verification failed:', error);
      return NextResponse.json({ error: 'Invalid Twilio credentials. Please check your Account SID and Auth Token.' }, { status: 400 });
    }
    
    // Store the Twilio account in the database
    const twilioAccount = await db.twilioAccount.create({
      data: {
        userId,
        label,
        accountSid,
        authToken,
        phoneNumber,
      },
    });
    
    // Store the credentials securely
    const credentials = {
      accountSid,
      authToken,
      phoneNumber
    };
    
    const encryptedCredentials = encrypt(JSON.stringify(credentials));
    
    // Create a new sync account
    const syncAccount = await db.syncAccount.create({
      data: {
        userId,
        platform: 'twilio',
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
          platform: 'twilio',
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
    console.error('Error linking Twilio account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 