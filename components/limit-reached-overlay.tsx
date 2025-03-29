import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LimitReachedOverlayProps {
  type: 'connections' | 'storage';
  used: number;
  limit: number;
  unit?: string;
  className?: string;
}

export function LimitReachedOverlay({
  type,
  used,
  limit,
  unit = '',
  className
}: LimitReachedOverlayProps) {
  const title = type === 'connections' 
    ? 'Connection Limit Reached' 
    : 'Storage Limit Reached';
  
  const message = type === 'connections'
    ? `Your organization is using ${used}/${limit} connections already.`
    : `Your organization is using ${used}${unit}/${limit}${unit} of storage already.`;

  return (
    <div className={cn(
      "absolute inset-0 backdrop-blur-sm bg-background/80 z-50 flex flex-col items-center justify-center p-6 text-center",
      className
    )}>
      <div className="rounded-full bg-orange-100 dark:bg-orange-950/30 p-4 mb-4">
        <Lock className="h-10 w-10 text-orange-600 dark:text-orange-400" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">{message}</p>
      
      <Button 
        variant="default" 
        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-none"
        onClick={() => window.location.href = '/settings/subscription'}
      >
        Upgrade Your Plan
      </Button>
    </div>
  );
} 