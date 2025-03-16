import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// Track the last sync time and token refresh time
let lastSyncTime = 0;
let lastTokenRefreshTime = 0;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Helper function to refresh Gmail tokens
async function refreshGmailTokens() {
  try {
    // Find all users with Gmail tokens that need refreshing
    // We can't actually fetch the tokens in middleware since they're encrypted in the JWT
    // Instead, we'll hit a dedicated endpoint that will handle the refresh
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/refresh-tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SYNC_API_KEY}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to refresh tokens: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`Refreshed tokens for ${result.refreshed} users`);
    
    return result;
  } catch (error) {
    console.error('Error refreshing Gmail tokens:', error);
    return { refreshed: 0, errors: 1 };
  }
}

export async function middleware(request: NextRequest) {
  const now = Date.now();
  
  // Skip the middleware checks for API routes and static assets
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/') || path.match(/\.(jpg|jpeg|png|gif|svg|css|js)$/)) {
    return NextResponse.next();
  }

  // Get the internal API key
  const apiKey = process.env.SYNC_API_KEY;
  if (!apiKey) {
    console.warn('Sync API key not set, skipping automatic operations');
    return NextResponse.next();
  }

  // Handle token refresh
  if (now - lastTokenRefreshTime > TOKEN_REFRESH_INTERVAL_MS) {
    lastTokenRefreshTime = now;
    
    // Refreshing tokens in the background
    refreshGmailTokens()
      .then((result) => {
        console.log(`Token refresh completed at ${new Date().toISOString()}: ${result.refreshed} refreshed, ${result.errors || 0} errors`);
      })
      .catch(error => {
        console.error('Error during token refresh:', error);
      });
  }
  
  // Handle periodic sync
  if (now - lastSyncTime > SYNC_INTERVAL_MS) {
    lastSyncTime = now;
    
    // Trigger the background sync
    try {
      fetch(`${request.nextUrl.origin}/api/sync?apiKey=${apiKey}`, {
        method: 'GET',
      }).catch(error => {
        console.error('Error triggering automatic sync:', error);
      });
      
      console.log('Triggered automatic sync at', new Date().toISOString());
    } catch (error) {
      console.error('Failed to trigger automatic sync:', error);
    }
  }
  
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    // Match all request paths except those starting with:
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 