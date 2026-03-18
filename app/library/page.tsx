'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCourseLibraryStore } from '@/lib/store/course-library';
import { listStages, type StageListItem } from '@/lib/utils/stage-storage';
import { CourseCard } from '@/components/library/course-card';
import { UnassignedStages } from '@/components/library/unassigned-stages';
import { createLogger } from '@/lib/logger';

const log = createLogger('Library');

export default function LibraryPage() {
  const router = useRouter();
  const courses = useCourseLibraryStore((s) => s.courses);
  const loading = useCourseLibraryStore((s) => s.loading);

  const [stages, setStages] = useState<StageListItem[]>([]);
  const [stagesLoaded, setStagesLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load courses and stages on mount
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

  // Compute unassigned stages (not referenced in any course)
  const unassignedStages = useMemo(() => {
    const assignedIds = new Set<string>();
    for (const course of courses) {
      for (const lesson of course.lessons) {
        assignedIds.add(lesson.stageId);
      }
    }
    return stages.filter((s) => !assignedIds.has(s.id));
  }, [courses, stages]);

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-4 md:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="w-full max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Course Library
              </h1>
              <p className="text-sm text-muted-foreground/60 mt-0.5">
                Organize classrooms into structured courses
              </p>
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 rounded-xl"
          >
            <Plus className="size-4" />
            New Course
          </Button>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-muted-foreground/60">Loading courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="size-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center mb-4">
              <span className="text-2xl opacity-60">📚</span>
            </div>
            <p className="text-sm text-muted-foreground/70 max-w-sm">
              No courses yet. Create one to organize your classrooms.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {courses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
              >
                <CourseCard
                  course={course}
                  onOpen={(id) => router.push(`/library/${id}`)}
                  onDelete={(id) => useCourseLibraryStore.getState().deleteCourse(id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Divider: Unassigned Classrooms */}
        {stagesLoaded && (
          <>
            <div className="flex items-center gap-4 mt-12 mb-6">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[13px] text-muted-foreground/60 select-none">
                Unassigned Classrooms
                {unassignedStages.length > 0 && (
                  <span className="ml-1.5 text-[11px] tabular-nums opacity-60">
                    {unassignedStages.length}
                  </span>
                )}
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            <UnassignedStages stages={unassignedStages} />
          </>
        )}
      </div>

      {/* Create Course Dialog */}
      <CreateCourseDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

// ─── Create Course Dialog ────────────────────────────────────────────

function CreateCourseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    useCourseLibraryStore.getState().createCourse(name.trim(), description.trim());
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-md mx-4 rounded-2xl bg-white dark:bg-slate-900 border border-border/60 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">New Course</h2>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Course Name
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') onOpenChange(false);
                  }}
                  placeholder="e.g. Introduction to Machine Learning"
                  className="w-full h-10 rounded-xl border border-border/60 bg-transparent px-3 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/60 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Description
                  <span className="text-muted-foreground/40 font-normal ml-1">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this course covers..."
                  rows={3}
                  className="w-full rounded-xl border border-border/60 bg-transparent px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/60 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="rounded-xl"
              >
                Create Course
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
