import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { Scene, Stage } from '@/lib/types/stage';

export const CLASSROOMS_DIR = path.join(process.cwd(), 'data', 'classrooms');
export const CLASSROOM_JOBS_DIR = path.join(process.cwd(), 'data', 'classroom-jobs');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureClassroomsDir() {
  await ensureDir(CLASSROOMS_DIR);
}

export async function ensureClassroomJobsDir() {
  await ensureDir(CLASSROOM_JOBS_DIR);
}

export async function writeJsonFileAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tempFilePath, content, 'utf-8');
  await fs.rename(tempFilePath, filePath);
}

export function buildRequestOrigin(req: NextRequest): string {
  return req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('x-forwarded-host')}`
    : req.nextUrl.origin;
}

/** Agent profile as persisted alongside classroom data */
export interface PersistedAgent {
  id: string;
  name: string;
  role: string;
  persona: string;
  avatar: string;
  color: string;
  priority: number;
  voiceId?: string;
}

export interface PersistedClassroomData {
  id: string;
  stage: Stage;
  scenes: Scene[];
  agents?: PersistedAgent[];
  createdAt: string;
  updatedAt?: string;
}

/** Lightweight list item (no full scenes/agents payload) */
export interface ClassroomListItem {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  firstSceneTitle?: string;
  /** First slide canvas data for thumbnail preview */
  firstSlide?: unknown;
  createdAt: string;
  updatedAt?: string;
}

export function isValidClassroomId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function readClassroom(id: string): Promise<PersistedClassroomData | null> {
  const filePath = path.join(CLASSROOMS_DIR, `${id}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as PersistedClassroomData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/** List all persisted classrooms (lightweight — no scenes payload) */
export async function listClassrooms(): Promise<ClassroomListItem[]> {
  await ensureClassroomsDir();
  const files = await fs.readdir(CLASSROOMS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const items: ClassroomListItem[] = [];
  for (const file of jsonFiles) {
    try {
      const content = await fs.readFile(path.join(CLASSROOMS_DIR, file), 'utf-8');
      const data = JSON.parse(content) as PersistedClassroomData;
      // Extract first slide canvas for thumbnail
      const firstSlideScene = data.scenes?.find(
        (s) => s.content && (s.content as { type?: string }).type === 'slide',
      );
      const firstSlide = firstSlideScene
        ? (firstSlideScene.content as { canvas?: unknown })?.canvas
        : undefined;
      items.push({
        id: data.id,
        name: data.stage?.name || 'Untitled',
        description: data.stage?.description,
        sceneCount: data.scenes?.length || 0,
        firstSceneTitle: data.scenes?.[0]?.title,
        firstSlide,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    } catch {
      // Skip corrupt files
    }
  }

  // Sort by most recent first
  items.sort((a, b) => {
    const dateA = a.updatedAt || a.createdAt;
    const dateB = b.updatedAt || b.createdAt;
    return dateB.localeCompare(dateA);
  });

  return items;
}

export async function persistClassroom(
  data: {
    id: string;
    stage: Stage;
    scenes: Scene[];
    agents?: PersistedAgent[];
  },
  baseUrl?: string,
): Promise<PersistedClassroomData & { url?: string }> {
  // Read existing to preserve createdAt
  const existing = await readClassroom(data.id);

  const classroomData: PersistedClassroomData = {
    id: data.id,
    stage: data.stage,
    scenes: data.scenes,
    agents: data.agents,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ensureClassroomsDir();
  const filePath = path.join(CLASSROOMS_DIR, `${data.id}.json`);
  await writeJsonFileAtomic(filePath, classroomData);

  return {
    ...classroomData,
    url: baseUrl ? `${baseUrl}/classroom/${data.id}` : undefined,
  };
}

/** Delete a persisted classroom */
export async function deleteClassroom(id: string): Promise<void> {
  const filePath = path.join(CLASSROOMS_DIR, `${id}.json`);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  // Also clean up audio directory
  const audioDir = path.join(CLASSROOMS_DIR, id, 'audio');
  try {
    await fs.rm(audioDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ==================== Audio file persistence ====================

/** Save a TTS audio file to disk alongside the classroom */
export async function persistAudioFile(
  classroomId: string,
  audioId: string,
  base64: string,
  format: string,
): Promise<void> {
  const audioDir = path.join(CLASSROOMS_DIR, classroomId, 'audio');
  await ensureDir(audioDir);
  const filePath = path.join(audioDir, `${audioId}.${format}`);
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
}

/** Read a TTS audio file from disk, returns { base64, format } or null */
export async function readAudioFile(
  classroomId: string,
  audioId: string,
): Promise<{ base64: string; format: string } | null> {
  const audioDir = path.join(CLASSROOMS_DIR, classroomId, 'audio');
  try {
    const files = await fs.readdir(audioDir);
    const match = files.find((f) => f.startsWith(`${audioId}.`));
    if (!match) return null;
    const format = path.extname(match).slice(1);
    const data = await fs.readFile(path.join(audioDir, match));
    return { base64: data.toString('base64'), format };
  } catch {
    return null;
  }
}
