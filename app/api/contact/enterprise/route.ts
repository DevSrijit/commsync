import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY is not set');
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const {
      name,
      email,
      phone,
      companyName,
      teamSize,
      connectedAccounts,
      storageRequirement,
      aiCredits,
      additionalRequirements,
    } = data;

    // Send email via SendGrid
    const msg = {
      to: 'commsync@havenmediasolutions.com', // TOEMAIL
      from: 'commsync@havenmediasolutions.com',
      subject: `New Enterprise Inquiry from ${companyName}`,
      html: `
        <h2>New Enterprise Plan Inquiry</h2>
        <h3>Contact Information</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Company:</strong> ${companyName}</p>
        
        <h3>Requirements</h3>
        <ul>
          <li><strong>Team Size:</strong> ${teamSize} users</li>
          <li><strong>Connected Accounts:</strong> ${connectedAccounts}</li>
          <li><strong>Storage:</strong> ${storageRequirement}GB</li>
          <li><strong>Monthly AI Credits:</strong> ${aiCredits}</li>
        </ul>
        
        <h3>Additional Requirements</h3>
        <p>${additionalRequirements || 'None specified'}</p>
      `,
    };

    await sgMail.send(msg);

    // Store inquiry in database if user is logged in
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (user) {
        // Create organization for enterprise inquiry
        const organization = await db.organization.create({
          data: {
            name: companyName,
            ownerId: user.id,
          },
        });

        // Update user's organizations
        await db.user.update({
          where: { id: user.id },
          data: {
            organizations: {
              connect: {
                id: organization.id,
              },
            },
          },
        });

        // Create placeholder subscription for enterprise inquiry
        await db.subscription.create({
          data: {
            organizationId: organization.id,
            stripeSubscriptionId: 'pending_enterprise',
            stripePriceId: 'enterprise_custom',
            status: 'pending',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            planType: 'enterprise',
            maxUsers: -1,
            maxStorage: -1,
            maxConnections: -1,
            totalStorage: -1,
            totalConnections: -1,
            totalAiCredits: -1,
            customLimits: {
              requestedTeamSize: teamSize,
              connectedAccounts,
              storageRequirement,
              aiCredits,
              additionalRequirements,
              status: 'pending_review',
              submittedAt: new Date().toISOString(),
              contactInfo: { name, email, phone, companyName },
            },
          },
        });

        return NextResponse.json({
          message: 'Enterprise inquiry submitted successfully',
          organizationId: organization.id,
        });
      }
    }

    return NextResponse.json({
      message: 'Enterprise inquiry submitted successfully',
    });
  } catch (error) {
    console.error('Enterprise inquiry error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
} 