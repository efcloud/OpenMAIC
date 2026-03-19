/**
 * Server Sync — persist classroom data to server-side storage.
 *
 * Every classroom is stored on the server so all visitors on the same
 * instance/domain can see it. IndexedDB is a local cache; server is
 * the shared source of truth for listing and discovery.
 */

import { createLogger } from '@/lib/logger';
import type { Stage, Scene } from '@/lib/types/stage';

const log = createLogger('ServerSync');

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

/** Pending sync promise — deduplicates concurrent calls for the same stage */
let pendingSync: Promise<void> | null = null;
let pendingPayload: SyncPayload | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Sync classroom to server. Coalesces rapid successive calls (300ms) but
 * guarantees the request fires — not fire-and-forget.
 * Returns a promise that resolves when the server write completes.
 */
export function syncToServer(payload: SyncPayload): Promise<void> {
  pendingPayload = payload;

  // Coalesce rapid calls (e.g. multiple store mutations in quick succession)
  if (coalesceTimer) clearTimeout(coalesceTimer);

  return new Promise<void>((resolve) => {
    coalesceTimer = setTimeout(async () => {
      coalesceTimer = null;
      const data = pendingPayload;
      pendingPayload = null;
      if (!data) { resolve(); return; }

      // Wait for any in-flight sync to finish before starting a new one
      if (pendingSync) await pendingSync;

      pendingSync = doSync(data);
      await pendingSync;
      pendingSync = null;
      resolve();
    }, 300);
  });
}

/**
 * Flush: immediately sync the latest payload and await completion.
 * Use before navigation to ensure the server has the data.
 */
export async function flushSync(payload: SyncPayload): Promise<void> {
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
  pendingPayload = null;
  if (pendingSync) await pendingSync;
  pendingSync = doSync(payload);
  await pendingSync;
  pendingSync = null;
}

async function doSync(payload: SyncPayload): Promise<void> {
  try {
    const res = await fetch('/api/classroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.warn('Server sync failed:', res.status);
    }
  } catch (err) {
    log.warn('Server sync error:', err);
  }
}
