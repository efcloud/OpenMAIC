/**
 * Course Tree Storage Manager
 *
 * CRUD operations for course trees in IndexedDB.
 * Each course tree stores a recursive nested structure of groups and lessons.
 */

import { db } from './database';
import type { CourseTreeRecord } from '@/lib/types/course-tree';

/**
 * List all course trees ordered by updatedAt DESC.
 */
export async function listCourseTrees(): Promise<CourseTreeRecord[]> {
  return db.courses.orderBy('updatedAt').reverse().toArray() as Promise<CourseTreeRecord[]>;
}

/**
 * Get a single course tree by ID.
 */
export async function getCourseTree(id: string): Promise<CourseTreeRecord | null> {
  const record = await db.courses.get(id);
  return (record as CourseTreeRecord | undefined) ?? null;
}

/**
 * Upsert a course tree record.
 */
export async function saveCourseTree(tree: CourseTreeRecord): Promise<void> {
  await db.courses.put(tree as never);
}

/**
 * Delete a course tree by ID.
 */
export async function deleteCourseTree(id: string): Promise<void> {
  await db.courses.delete(id);
}
