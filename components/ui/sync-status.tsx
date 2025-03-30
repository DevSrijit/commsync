import { useState, useEffect } from "react";
import { AlertCircle, Check, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailStore } from "@/lib/email-store";

interface SyncStatusProps {
  className?: string;
}

export function SyncStatus({ className }: SyncStatusProps) {
  const { 
    syncStatus, 
    justcallRateLimitInfo,
  } = useEmailStore();
  
  const [visible, setVisible] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  // Show status banner when there's active sync or rate limiting
  useEffect(() => {
    if (syncStatus.isActive || justcallRateLimitInfo.isRateLimited) {
      setVisible(true);
      setAnimateOut(false);
    } else if (visible && !syncStatus.isActive && !justcallRateLimitInfo.isRateLimited) {
      // Add delay before hiding to show completion state
      const timer = setTimeout(() => {
        setAnimateOut(true);
        // Wait for animation to complete before hiding
        const hideTimer = setTimeout(() => {
          setVisible(false);
        }, 300);
        return () => clearTimeout(hideTimer);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus, justcallRateLimitInfo, visible]);

  if (!visible) return null;

  let statusIcon;
  let statusText;
  let statusColor;

  if (justcallRateLimitInfo.isRateLimited) {
    statusIcon = <Clock className="h-4 w-4" />;
    const resetInSeconds = Math.ceil((justcallRateLimitInfo.resetTimestamp - Date.now()) / 1000);
    statusText = `JustCall rate limit reached. Retrying in ${resetInSeconds}s`;
    statusColor = "bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400";
  } else if (syncStatus.isActive) {
    statusIcon = <RefreshCw className="h-4 w-4 animate-spin" />;
    statusText = syncStatus.message || "Syncing messages...";
    statusColor = "bg-blue-500/20 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
  } else {
    statusIcon = <Check className="h-4 w-4" />;
    statusText = "Sync complete";
    statusColor = "bg-green-500/20 text-green-600 dark:bg-green-500/20 dark:text-green-400";
  }

  return (
    <div 
      className={cn(
        "fixed top-4 left-1/2 transform -translate-x-1/2 z-50 rounded-full px-4 py-2",
        "flex items-center gap-2 shadow-md transition-all duration-300",
        "animate-float",
        animateOut ? "opacity-0 translate-y-[-10px]" : "opacity-100",
        className
      )}
      style={{
        boxShadow: `0 0 20px 5px ${
          justcallRateLimitInfo.isRateLimited ? 'rgba(250, 204, 21, 0.3)' : 
          syncStatus.isActive ? 'rgba(59, 130, 246, 0.3)' : 
          'rgba(34, 197, 94, 0.3)'
        }`,
        background: `${
          justcallRateLimitInfo.isRateLimited ? 'rgba(254, 240, 138, 0.8)' : 
          syncStatus.isActive ? 'rgba(191, 219, 254, 0.8)' : 
          'rgba(187, 247, 208, 0.8)'
        }`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: `${
          justcallRateLimitInfo.isRateLimited ? 'rgba(146, 64, 14, 1)' : 
          syncStatus.isActive ? 'rgba(30, 64, 175, 1)' : 
          'rgba(21, 128, 61, 1)'
        }`,
        border: `1px solid ${
          justcallRateLimitInfo.isRateLimited ? 'rgba(254, 240, 138, 0.9)' : 
          syncStatus.isActive ? 'rgba(191, 219, 254, 0.9)' : 
          'rgba(187, 247, 208, 0.9)'
        }`
      }}
    >
      {statusIcon}
      <span className="text-sm font-medium">{statusText}</span>
      {syncStatus.progress > 0 && syncStatus.total > 0 && (
        <span className="text-xs font-medium ml-1">
          ({syncStatus.progress}/{syncStatus.total})
        </span>
      )}
    </div>
  );
} 