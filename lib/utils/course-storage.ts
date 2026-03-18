/**
 * Course Storage Manager
 *
 * CRUD operations for courses in IndexedDB.
 * Each course groups multiple stages (lessons) into an ordered sequence.
 */

import { db, type CourseRecord } from './database';

/**
 * List all courses ordered by updatedAt DESC
 */
export async function listCourses(): Promise<CourseRecord[]> {
  return db.courses.orderBy('updatedAt').reverse().toArray();
}

/**
 * Get a single course by ID
 */
export async function getCourse(id: string): Promise<CourseRecord | null> {
  const record = await db.courses.get(id);
  return record ?? null;
}

/**
 * Upsert a course record
 */
export async function saveCourse(course: CourseRecord): Promise<void> {
  await db.courses.put(course);
}

/**
 * Delete a course by ID
 */
export async function deleteCourse(id: string): Promise<void> {
  await db.courses.delete(id);
}

/**
 * Returns stage IDs that are NOT referenced by any course's lessons array.
 * Compares all stageIds from all courses.lessons against all stage IDs in the stages table.
 */
export async function getUnassignedStageIds(): Promise<string[]> {
  const [courses, stages] = await Promise.all([
    db.courses.toArray(),
    db.stages.toArray(),
  ]);

  const assignedIds = new Set<string>();
  for (const course of courses) {
    for (const lesson of course.lessons) {
      assignedIds.add(lesson.stageId);
    }
  }

  return stages
    .map((stage) => stage.id)
    .filter((id) => !assignedIds.has(id));
}
