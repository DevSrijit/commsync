import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  // Verify the request is coming from our middleware
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Find all users with Google accounts
    const accounts = await db.account.findMany({
      where: {
        provider: 'google',
        refresh_token: { not: null }, // Only get accounts with refresh tokens
      },
      include: {
        user: true,
      },
    });
    
    console.log(`Found ${accounts.length} Google accounts to check for refresh`);
    
    // Track refresh results
    const results = {
      refreshed: 0,
      errors: 0,
      skipped: 0,
    };
    
    // Process each account
    for (const account of accounts) {
      try {
        // Check if we need to refresh - for this implementation, we'll refresh all tokens        
        // Refresh token
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: account.refresh_token!,
            grant_type: 'refresh_token',
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Token refresh failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update the account with the new access token and expiry
        await db.account.update({
          where: { id: account.id },
          data: {
            access_token: data.access_token,
            expires_at: Math.floor(Date.now() / 1000 + data.expires_in),
          },
        });
        
        results.refreshed++;
        
      } catch (error) {
        console.error(`Error refreshing token for user ${account.userId}:`, error);
        results.errors++;
      }
    }
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Error in token refresh operation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 