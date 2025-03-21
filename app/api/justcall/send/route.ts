import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';
import { JustCallService } from '@/lib/justcall-service';
import { z } from 'zod';

const sendMessageSchema = z.object({
  accountId: z.string().min(1, "JustCall account ID is required"),
  to: z.string().min(1, "Recipient phone number is required"),
  body: z.string().min(1, "Message body is required"),
  media: z.array(z.string()).optional()
});

export async function POST(req: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = sendMessageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { accountId, to, body: messageBody, media } = validationResult.data;

    // Verify the JustCall account belongs to this user
    const justcallAccount = await db.syncAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        platform: 'justcall'
      }
    });

    if (!justcallAccount) {
      return NextResponse.json(
        { error: 'JustCall account not found or not authorized' },
        { status: 404 }
      );
    }

    // Create JustCall service and send the message
    const justcallService = new JustCallService(justcallAccount);
    const message = await justcallService.sendMessage(to, messageBody, media);

    // Format the sent message as an Email type for consistent handling in the UI
    const formattedMessage = {
      id: message.id?.toString() || '',
      threadId: [to, justcallAccount.accountIdentifier].sort().join('-'),
      from: {
        name: 'You',
        email: justcallAccount.accountIdentifier,
      },
      to: [{
        name: 'Contact',
        email: to,
      }],
      subject: 'SMS Message',
      body: messageBody,
      date: new Date().toISOString(),
      labels: ['SMS', 'sent'],
      accountType: 'justcall',
      accountId: justcallAccount.id,
      platform: 'justcall'
    };

    return NextResponse.json({
      success: true,
      message: formattedMessage
    });
  } catch (error: any) {
    console.error('Error sending JustCall message:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while sending the message' },
      { status: 500 }
    );
  }
} 