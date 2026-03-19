/**
 * Server Sync — auto-persist classroom data to server-side storage.
 *
 * Called alongside IndexedDB saves so that classrooms are visible to all
 * visitors (not just the browser that created them).
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('ServerSync');

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 2000; // 2s debounce (slower than IndexedDB save)

import type { Stage, Scene } from '@/lib/types/stage';

interface SyncPayload {
  stage: Stage;
  scenes: Scene[];
  agents?: Array<{
    id: string;
    name: string;
    role: string;
    persona: string;
    avatar: string;
    color: string;
    priority: number;
    voiceId?: string;
  }>;
}

/**
 * Debounced sync to server. Fire-and-forget — failures are logged but don't
 * block the UI. IndexedDB remains the primary store; server is a shared mirror.
 */
export function syncToServer(payload: SyncPayload): void {
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    syncTimer = null;
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        log.warn('Server sync failed:', res.status, await res.text().catch(() => ''));
      }
    } catch (err) {
      log.warn('Server sync error:', err);
    }
  }, SYNC_DEBOUNCE_MS);
}

/** Cancel any pending sync (e.g. on unmount) */
export function cancelSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}
