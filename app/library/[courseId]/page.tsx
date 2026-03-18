'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Plus } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { useCourseLibraryStore } from '@/lib/store/course-library';
import { listStages, type StageListItem } from '@/lib/utils/stage-storage';
import { flattenLessons } from '@/lib/utils/course-tree-ops';
import { TreeEditor } from '@/components/library/tree-editor';
import { createLogger } from '@/lib/logger';

const log = createLogger('CourseDetail');

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.courseId as string;

  const trees = useCourseLibraryStore((s) => s.trees);
  const tree = useMemo(
    () => trees.find((t) => t.id === courseId),
    [trees, courseId],
  );

  const [stages, setStages] = useState<StageListItem[]>([]);
  const [stagesLoaded, setStagesLoaded] = useState(false);

  // Load store + stages
  useEffect(() => {
    useCourseLibraryStore.getState().loadTrees();

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

  // Build stageNames map
  const stageNames = useMemo<Map<string, { name: string; sceneCount: number }>>(() => {
    const map = new Map<string, { name: string; sceneCount: number }>();
    for (const s of stages) {
      map.set(s.id, { name: s.name, sceneCount: s.sceneCount });
    }
    return map;
  }, [stages]);

  // Unassigned stages: not used in any tree
  const unassignedStages = useMemo(() => {
    const assignedIds = new Set<string>();
    for (const t of trees) {
      const lessons = flattenLessons(t.root);
      for (const lesson of lessons) {
        assignedIds.add(lesson.stageId);
      }
    }
    return stages.filter((s) => !assignedIds.has(s.id));
  }, [trees, stages]);

  // Available stages for adding to this tree: anything not already in THIS tree
  const availableStages = useMemo(() => {
    if (!tree) return [];
    const assignedInTree = new Set(
      flattenLessons(tree.root).map((l) => l.stageId),
    );
    return stages
      .filter((s) => !assignedInTree.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, sceneCount: s.sceneCount }));
  }, [tree, stages]);

  const handleAddLesson = useCallback(
    (stageId: string) => {
      if (!tree) return;
      const meta = stageNames.get(stageId);
      const node = {
        id: nanoid(),
        type: 'lesson' as const,
        title: meta?.name ?? 'Untitled Lesson',
        order: tree.root.children?.length ?? 0,
        stageId,
      };
      useCourseLibraryStore.getState().addNode(courseId, tree.root.id, node);
    },
    [tree, courseId, stageNames],
  );

  const handleEnterLesson = useCallback(
    (stageId: string) => {
      router.push(`/classroom/${stageId}`);
    },
    [router],
  );

  // Lesson count for header
  const lessonCount = useMemo(() => {
    if (!tree) return 0;
    return flattenLessons(tree.root).length;
  }, [tree]);

  if (!tree) {
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
              {tree.name}
            </h1>
            {tree.description && (
              <p className="text-sm text-muted-foreground/60 mt-1 line-clamp-2">
                {tree.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground/40 mt-1.5">
              {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Tree Editor */}
        <TreeEditor
          treeId={courseId}
          root={tree.root}
          stageNames={stageNames}
          availableStages={availableStages}
          onEnterLesson={handleEnterLesson}
        />

        {/* Available Classrooms */}
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
                        {stage.sceneCount} scene
                        {stage.sceneCount !== 1 ? 's' : ''}
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
