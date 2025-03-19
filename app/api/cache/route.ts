import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getCacheValue, setCacheValue, removeCacheValue } from '@/lib/client-cache';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 });
    }

    const value = await getCacheValue(key, session.user.id);
    
    return NextResponse.json({ value });
  } catch (error: any) {
    console.error('Error in cache GET:', error);
    return NextResponse.json(
      { error: 'Failed to get cache value', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 });
    }

    await setCacheValue(key, value, session.user.id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in cache POST:', error);
    return NextResponse.json(
      { error: 'Failed to set cache value', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 });
    }

    await removeCacheValue(key, session.user.id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in cache DELETE:', error);
    return NextResponse.json(
      { error: 'Failed to remove cache value', message: error.message },
      { status: 500 }
    );
  }
} 