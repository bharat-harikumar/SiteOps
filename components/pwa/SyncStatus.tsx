'use client';

import { useEffect } from 'react';

import { toastSuccess } from '@/lib/ui/toast';
import { toast } from 'sonner';

// PWA4 client half — reflects the service worker's offline write outbox in the
// UI. When a log/transfer POST is queued offline the SW posts BG_SYNC_QUEUED;
// when the queue drains after reconnect it posts BG_SYNC_DRAINED. We surface
// both as toasts so a field worker knows their submission wasn't lost. A write
// the server rejects on replay posts BG_SYNC_REJECTED instead (and no DRAINED),
// so "synced" is never claimed for an entry that was not saved.
type SyncMessage = { type?: string; message?: string };

export function SyncStatus() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent<SyncMessage>) => {
      const type = event.data?.type;
      if (type === 'BG_SYNC_QUEUED') {
        toast('Saved offline — will sync when you reconnect', { icon: '📴' });
      } else if (type === 'BG_SYNC_DRAINED') {
        toastSuccess('Offline changes synced');
      } else if (type === 'BG_SYNC_REJECTED' && event.data?.message) {
        // The server refused an entry saved offline. It stays on screen until
        // dismissed — a vanishing toast would let the loss go unnoticed.
        toast.error(event.data.message, { duration: Infinity, closeButton: true });
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  return null;
}
