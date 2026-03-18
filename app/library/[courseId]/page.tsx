'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, GripVertical, Play, Trash2, Plus } from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCourseLibraryStore } from '@/lib/store/course-library';
import { listStages, type StageListItem } from '@/lib/utils/stage-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('CourseDetail');

interface LessonMeta {
  stageId: string;
  name: string;
  sceneCount: number;
}

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId as string;

  const courses = useCourseLibraryStore((s) => s.courses);
  const course = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  );

  const [stages, setStages] = useState<StageListItem[]>([]);
  const [stagesLoaded, setStagesLoaded] = useState(false);

  // Load store + stages
  useEffect(() => {
    useCourseLibraryStore.getState().loadCourses();

    listStages()
      .then((list) => {
        setStages(list);
        setStagesLoaded(true);
      })
      .catch((err) => {
        log.error('Failed to load stages:', err);
        setStagesLoaded(true);
      });
  }, []);

  // Build lesson metadata from stages
  const lessonMetas = useMemo<LessonMeta[]>(() => {
    if (!course) return [];
    const stageMap = new Map(stages.map((s) => [s.id, s]));
    return course.lessons.map((lesson) => {
      const stage = stageMap.get(lesson.stageId);
      return {
        stageId: lesson.stageId,
        name: stage?.name ?? lesson.stageId,
        sceneCount: stage?.sceneCount ?? 0,
      };
    });
  }, [course, stages]);

  // Unassigned stages (not in any course)
  const unassignedStages = useMemo(() => {
    const assignedIds = new Set<string>();
    for (const c of courses) {
      for (const lesson of c.lessons) {
        assignedIds.add(lesson.stageId);
      }
    }
    return stages.filter((s) => !assignedIds.has(s.id));
  }, [courses, stages]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !course) return;

      const oldIndex = course.lessons.findIndex((l) => l.stageId === active.id);
      const newIndex = course.lessons.findIndex((l) => l.stageId === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(
        course.lessons.map((l) => l.stageId),
        oldIndex,
        newIndex,
      );
      useCourseLibraryStore.getState().reorderLessons(courseId, reordered);
    },
    [course, courseId],
  );

  const handleAddLesson = (stageId: string) => {
    useCourseLibraryStore.getState().addLesson(courseId, stageId);
  };

  const handleRemoveLesson = (stageId: string) => {
    useCourseLibraryStore.getState().removeLesson(courseId, stageId);
  };

  if (!course) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <p className="text-sm text-muted-foreground/60 mb-4">
            {stagesLoaded ? 'Course not found.' : 'Loading...'}
          </p>
          <Button
            variant="ghost"
            onClick={() => router.push('/library')}
            className="rounded-xl"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-4 md:p-8 overflow-x-hidden">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-start gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full mt-0.5"
            onClick={() => router.push('/library')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">
              {course.name}
            </h1>
            {course.description && (
              <p className="text-sm text-muted-foreground/60 mt-1 line-clamp-2">
                {course.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground/40 mt-1.5">
              {course.lessons.length} lesson{course.lessons.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Lesson List with DnD */}
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={course.lessons.map((l) => l.stageId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {lessonMetas.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground/50">
                  No lessons yet. Add classrooms from below.
                </div>
              ) : (
                lessonMetas.map((meta, index) => (
                  <LessonCard
                    key={meta.stageId}
                    meta={meta}
                    index={index}
                    onEnter={() => router.push(`/classroom/${meta.stageId}`)}
                    onRemove={() => handleRemoveLesson(meta.stageId)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Available Stages */}
        {stagesLoaded && (
          <>
            <div className="flex items-center gap-4 mt-10 mb-5">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[13px] text-muted-foreground/60 select-none">
                Available Classrooms
                {unassignedStages.length > 0 && (
                  <span className="ml-1.5 text-[11px] tabular-nums opacity-60">
                    {unassignedStages.length}
                  </span>
                )}
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            {unassignedStages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground/40">
                All classrooms are assigned to courses.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {unassignedStages.map((stage) => (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group flex items-center gap-3 rounded-xl border border-border/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm px-4 py-3 hover:border-violet-300/60 dark:hover:border-violet-700/40 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground/90 truncate">
                        {stage.name}
                      </p>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">
                        {stage.sceneCount} scene{stage.sceneCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                      onClick={() => handleAddLesson(stage.id)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sortable Lesson Card ────────────────────────────────────────────

function LessonCard({
  meta,
  index,
  onEnter,
  onRemove,
}: {
  meta: LessonMeta;
  index: number;
  onEnter: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: meta.stageId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'group flex items-center gap-3 rounded-xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 py-3 transition-all',
        isDragging
          ? 'border-violet-400/60 shadow-lg shadow-violet-500/10 z-50'
          : 'border-border/50 hover:border-border/80',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 p-1 -ml-1 rounded-md text-muted-foreground/30 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing transition-colors"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Order number */}
      <span className="shrink-0 size-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[11px] font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
        {index + 1}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/90 truncate">
          {meta.name}
        </p>
        <p className="text-xs text-muted-foreground/50 mt-0.5">
          {meta.sceneCount} scene{meta.sceneCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          onClick={onEnter}
        >
          <Play className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
