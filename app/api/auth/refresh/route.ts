import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get provider from query parameter
    const provider = request.nextUrl.searchParams.get('provider');
    
    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Get the current session
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // For Google provider, attempt to refresh the token
    if (provider === 'google') {
      // Check if we have a refresh token
      if (!session.user.refreshToken) {
        console.error('No refresh token available for Google account');
        return NextResponse.json({ 
          error: 'No refresh token available',
          message: 'You need to re-authenticate with Google',
          provider
        }, { status: 401 });
      }

      try {
        // Call Google's token endpoint to refresh the token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            refresh_token: session.user.refreshToken,
            grant_type: 'refresh_token'
          })
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          console.error('Google token refresh failed:', errorData);
          return NextResponse.json({ 
            error: 'Token refresh failed',
            details: errorData
          }, { status: tokenResponse.status });
        }

        const tokenData = await tokenResponse.json();
        
        // IMPORTANT: Update the account with the new token
        if (session.user.id) {
          // Find the account in the database
          const account = await db.account.findFirst({
            where: {
              userId: session.user.id,
              provider: 'google',
            },
          });
          
          if (account) {
            // Update the account with the new token
            await db.account.update({
              where: { id: account.id },
              data: {
                access_token: tokenData.access_token,
                expires_at: Math.floor(Date.now() / 1000 + tokenData.expires_in),
              },
            });
            
            // Return the new token in the response
            return NextResponse.json({
              message: 'Token refresh completed successfully',
              provider,
              accessToken: tokenData.access_token,
              expiresAt: Math.floor(Date.now() / 1000 + tokenData.expires_in),
              success: true
            });
          } else {
            console.error('Google account not found for user');
            return NextResponse.json({ 
              error: 'Account not found in database',
              message: 'You may need to re-authenticate with Google'
            }, { status: 404 });
          }
        } else {
          console.error('User ID not found in session');
          return NextResponse.json({ 
            error: 'User not found',
            message: 'Session user ID is missing'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('Error refreshing Google token:', error);
        return NextResponse.json({ 
          error: 'Token refresh failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    } else {
      // For other providers
      console.log(`Token refresh requested for provider: ${provider}`);
      return NextResponse.json({
        message: 'Token refresh initiated',
        provider,
        success: true
      });
    }
  } catch (error) {
    console.error('Error in token refresh:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 