/**
 * Classroom List — merged view of locally cached (IndexedDB) and
 * server-persisted classrooms.
 *
 * The server is the shared source of truth for discovery: every visitor on an
 * instance sees every classroom created on it. IndexedDB is a local cache that
 * additionally holds full scene data for classrooms this browser has opened.
 */

import { listStages, deleteStageData, getFirstSlideByStages, type StageListItem } from './stage-storage';
import type { Slide } from '@/lib/types/slides';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClassroomList');

interface ServerClassroom {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  firstSceneTitle?: string;
  firstSlide?: Slide;
  createdAt: string;
  updatedAt?: string;
}

export interface MergedClassrooms {
  list: StageListItem[];
  thumbnails: Record<string, Slide>;
}

/**
 * List classrooms from IndexedDB and the server, merged and sorted by recency.
 * Local entries win on conflict (they carry richer local state); server entries
 * fill the gaps so classrooms created in other browsers are still visible.
 */
export async function loadMergedClassrooms(): Promise<MergedClassrooms> {
  const localList = await listStages();

  let serverList: StageListItem[] = [];
  const serverThumbnails: Record<string, Slide> = {};
  try {
    const res = await fetch('/api/classrooms');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.classrooms) {
        serverList = (json.classrooms as ServerClassroom[]).map((c) => {
          if (c.firstSlide) serverThumbnails[c.id] = c.firstSlide;
          const ts = new Date(c.updatedAt || c.createdAt).getTime();
          return {
            id: c.id,
            name: c.name,
            description: c.description,
            sceneCount: c.sceneCount,
            firstSceneTitle: c.firstSceneTitle,
            createdAt: ts,
            updatedAt: ts,
          };
        });
      }
    }
  } catch {
    // Server unavailable — local only
  }

  const localIds = new Set(localList.map((c) => c.id));
  const list = [...localList, ...serverList.filter((c) => !localIds.has(c.id))];
  list.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  const localSlides =
    localList.length > 0 ? await getFirstSlideByStages(localList.map((c) => c.id)) : {};

  return { list, thumbnails: { ...serverThumbnails, ...localSlides } };
}

/**
 * Delete a classroom from both IndexedDB and server storage.
 * Without the server delete the classroom reappears on the next list refresh.
 */
export async function deleteClassroomEverywhere(id: string): Promise<void> {
  await deleteStageData(id);
  try {
    const res = await fetch(`/api/classroom?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) log.warn('Server delete failed:', res.status);
  } catch (err) {
    log.warn('Server delete error:', err);
  }
}
