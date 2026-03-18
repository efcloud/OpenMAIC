/**
 * Course Library Store
 *
 * Zustand store for managing the course library.
 * Delegates persistence to course-storage (IndexedDB via Dexie).
 */

import { create } from 'zustand';
import {
  listCourses,
  getCourse,
  saveCourse,
  deleteCourse,
} from '@/lib/utils/course-storage';
import type { CourseRecord } from '@/lib/utils/database';
import { nanoid } from 'nanoid';
import { createSelectors } from '@/lib/utils/create-selectors';
import { createLogger } from '@/lib/logger';

const log = createLogger('CourseLibrary');

interface CourseLibraryState {
  courses: CourseRecord[];
  loading: boolean;

  loadCourses: () => Promise<void>;
  createCourse: (name: string, description?: string) => Promise<string>;
  updateCourse: (id: string, updates: Partial<CourseRecord>) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;

  addLesson: (courseId: string, stageId: string, title?: string) => Promise<void>;
  removeLesson: (courseId: string, stageId: string) => Promise<void>;
  reorderLessons: (courseId: string, orderedStageIds: string[]) => Promise<void>;
}

const useCourseLibraryBase = create<CourseLibraryState>()((set, get) => ({
  courses: [],
  loading: false,

  loadCourses: async () => {
    set({ loading: true });
    try {
      const courses = await listCourses();
      set({ courses });
    } catch (error) {
      log.error('Failed to load courses:', error);
    } finally {
      set({ loading: false });
    }
  },

  createCourse: async (name, description) => {
    const now = Date.now();
    const course: CourseRecord = {
      id: nanoid(),
      name,
      description,
      lessons: [],
      createdAt: now,
      updatedAt: now,
    };
    await saveCourse(course);
    set({ courses: [course, ...get().courses] });
    return course.id;
  },

  updateCourse: async (id, updates) => {
    const existing = await getCourse(id);
    if (!existing) {
      log.warn('Course not found for update:', id);
      return;
    }
    const updated: CourseRecord = {
      ...existing,
      ...updates,
      id, // prevent id override
      updatedAt: Date.now(),
    };
    await saveCourse(updated);
    set({
      courses: get().courses.map((c) => (c.id === id ? updated : c)),
    });
  },

  deleteCourse: async (id) => {
    await deleteCourse(id);
    set({ courses: get().courses.filter((c) => c.id !== id) });
  },

  addLesson: async (courseId, stageId, title) => {
    const existing = await getCourse(courseId);
    if (!existing) {
      log.warn('Course not found for addLesson:', courseId);
      return;
    }
    // Skip if already present
    if (existing.lessons.some((l) => l.stageId === stageId)) return;

    const maxOrder = existing.lessons.reduce((max, l) => Math.max(max, l.order), -1);
    const updated: CourseRecord = {
      ...existing,
      lessons: [...existing.lessons, { stageId, title, order: maxOrder + 1 }],
      updatedAt: Date.now(),
    };
    await saveCourse(updated);
    set({
      courses: get().courses.map((c) => (c.id === courseId ? updated : c)),
    });
  },

  removeLesson: async (courseId, stageId) => {
    const existing = await getCourse(courseId);
    if (!existing) {
      log.warn('Course not found for removeLesson:', courseId);
      return;
    }
    const filtered = existing.lessons.filter((l) => l.stageId !== stageId);
    // Re-normalize order values
    const lessons = filtered.map((l, i) => ({ ...l, order: i }));
    const updated: CourseRecord = {
      ...existing,
      lessons,
      updatedAt: Date.now(),
    };
    await saveCourse(updated);
    set({
      courses: get().courses.map((c) => (c.id === courseId ? updated : c)),
    });
  },

  reorderLessons: async (courseId, orderedStageIds) => {
    const existing = await getCourse(courseId);
    if (!existing) {
      log.warn('Course not found for reorderLessons:', courseId);
      return;
    }
    // Build a lookup from the existing lessons
    const lessonMap = new Map(existing.lessons.map((l) => [l.stageId, l]));
    const lessons = orderedStageIds
      .map((stageId, index) => {
        const lesson = lessonMap.get(stageId);
        if (!lesson) return null;
        return { ...lesson, order: index };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    const updated: CourseRecord = {
      ...existing,
      lessons,
      updatedAt: Date.now(),
    };
    await saveCourse(updated);
    set({
      courses: get().courses.map((c) => (c.id === courseId ? updated : c)),
    });
  },
}));

export const useCourseLibraryStore = createSelectors(useCourseLibraryBase);
