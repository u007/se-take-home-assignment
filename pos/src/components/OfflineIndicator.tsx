import { Badge } from './ui/badge'
import { WifiOff, Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSyncManager } from '@/lib/sync-manager'
import { useEffect, useState } from 'react'

export function OfflineIndicator() {
  const { state: syncState } = useSyncManager()
  const [showSyncStatus, setShowSyncStatus] = useState(false)

  useEffect(() => {
    if (syncState.isSyncing) {
      setShowSyncStatus(true)
      const timeout = setTimeout(() => setShowSyncStatus(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [syncState.isSyncing])

  if (syncState.isOnline && syncState.pendingOperations === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Offline Status */}
      {!syncState.isOnline && (
        <Badge
          variant="outline"
          className="gap-2 bg-destructive/20 text-destructive border-destructive/50 px-3 py-2 font-semibold"
        >
          <WifiOff className="w-4 h-4" />
          Offline Mode
        </Badge>
      )}

      {/* Sync Status */}
      {showSyncStatus && syncState.isOnline && (
        <Badge
          variant="outline"
          className={`gap-2 px-3 py-2 font-semibold ${
            syncState.isSyncing
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
              : syncState.pendingOperations > 0
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
          }`}
        >
          {syncState.isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Syncing...
            </>
          ) : syncState.pendingOperations > 0 ? (
            <>
              <CloudOff className="w-4 h-4" />
              {syncState.pendingOperations} pending
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Synced
            </>
          )}
        </Badge>
      )}

      {/* Pending Operations Notice */}
      {!syncState.isSyncing && syncState.pendingOperations > 0 && (
        <div className="text-xs text-muted-foreground max-w-[200px] text-right">
          Changes will sync when connection is restored
        </div>
      )}
    </div>
  )
}
