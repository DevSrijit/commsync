import { NextRequest, NextResponse } from 'next/server';
import { JustCallWebhookPayload, JustCallMessage } from '@/lib/types';
import { db } from '@/lib/db';
import { JustCallService } from '@/lib/justcall-service';

// Process a JustCall webhook event
export async function POST(req: NextRequest) {
  try {
    // Parse the webhook payload
    const payload: JustCallWebhookPayload = await req.json();
    
    if (!payload || !payload.event || !payload.data) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    // We only care about text message events
    if (payload.event !== 'text.received') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const message: JustCallMessage = payload.data;
    
    // Find the JustCall account with the agent_id or number
    const number = message.number; // This is the JustCall number
    
    // Find the associated sync account
    const syncAccount = await db.syncAccount.findFirst({
      where: {
        platform: 'justcall',
        accountIdentifier: { contains: number } // Simplified - in real world might need to decrypt and check
      }
    });

    if (!syncAccount) {
      return NextResponse.json({ error: 'No matching JustCall account found' }, { status: 404 });
    }

    // Process the message
    const justCallService = new JustCallService(syncAccount);
    await justCallService.processIncomingMessage(message);

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Error processing JustCall webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 