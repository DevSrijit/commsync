import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// Track the last sync time
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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