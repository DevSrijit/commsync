import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatStorage } from '@/lib/subscription';

interface StorageLimitBannerProps {
  usedStorage: number;
  totalStorage: number;
  onDismiss?: () => void;
  className?: string;
}

export function StorageLimitBanner({
  usedStorage,
  totalStorage,
  onDismiss,
  className
}: StorageLimitBannerProps) {
  const formattedUsed = formatStorage(usedStorage);
  const formattedTotal = formatStorage(totalStorage);

  return (
    <div className={cn(
      "sticky top-0 z-50 w-full bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 px-4 py-3",
      "flex items-center justify-between text-amber-800 dark:text-amber-300",
      className
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-medium">Storage limit reached:</span> {formattedUsed}/{formattedTotal} used. 
          <span className="hidden sm:inline"> Syncing paused. Remove conversations or upgrade to continue.</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          className="text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          onClick={() => window.location.href = '/settings/subscription'}
        >
          Upgrade
        </Button>
        
        {onDismiss && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
} 