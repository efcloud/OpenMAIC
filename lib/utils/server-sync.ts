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

const COALESCE_MS = 300;

/** Latest payload awaiting the coalesce window */
let pendingPayload: SyncPayload | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
/** Resolvers for every caller waiting on the pending batch */
let waiters: Array<() => void> = [];
/** Serializes writes so a later payload never lands before an earlier one */
let chain: Promise<void> = Promise.resolve();

/**
 * Sync classroom to server. Coalesces rapid successive calls (300ms) but
 * guarantees the request fires — not fire-and-forget.
 * Returns a promise that resolves when the server write completes. Callers
 * superseded by a later payload resolve with that write, never hang.
 */
export function syncToServer(payload: SyncPayload): Promise<void> {
  pendingPayload = payload;

  // Coalesce rapid calls (e.g. multiple store mutations in quick succession)
  if (coalesceTimer) clearTimeout(coalesceTimer);

  return new Promise<void>((resolve) => {
    waiters.push(resolve);
    coalesceTimer = setTimeout(() => {
      void runPending();
    }, COALESCE_MS);
  });
}

/**
 * Flush: immediately sync the given payload and await completion.
 * Use before navigation to ensure the server has the data. Any calls still
 * inside the coalesce window are superseded by this payload and resolved.
 */
export async function flushSync(payload: SyncPayload): Promise<void> {
  if (coalesceTimer) {
    clearTimeout(coalesceTimer);
    coalesceTimer = null;
  }
  pendingPayload = payload;
  await runPending();
}

/** Write the pending payload, then resolve everyone who was waiting on it. */
async function runPending(): Promise<void> {
  coalesceTimer = null;
  const data = pendingPayload;
  pendingPayload = null;
  const batch = waiters;
  waiters = [];

  // doSync never rejects, so the chain can never be left in a rejected state
  chain = chain.then(() => (data ? doSync(data) : undefined));
  try {
    await chain;
  } finally {
    for (const resolve of batch) resolve();
  }
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
