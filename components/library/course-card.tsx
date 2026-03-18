'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MoreHorizontal,
  Trash2,
  ChevronRight,
  FileText,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import type { Slide } from '@/lib/types/slides';

interface CourseCardProps {
  readonly course: {
    id: string;
    name: string;
    description?: string;
    lessons: Array<{ stageId: string; title?: string; order: number }>;
    updatedAt: number;
  };
  readonly lessonSlides?: Slide[];
  readonly onOpen: (courseId: string) => void;
  readonly onDelete: (courseId: string) => void;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function CourseCard({ course, lessonSlides = [], onOpen, onDelete }: CourseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lessonCount = course.lessons.length;
  const previewLessons = course.lessons.slice(0, 6);

  return (
    <motion.div
      layout
      className={cn(
        'group relative rounded-2xl bg-white dark:bg-slate-900/80 border border-border/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden select-none',
        expanded && 'shadow-md',
      )}
    >
      {/* Main card — click to open editor */}
      <div onClick={() => onOpen(course.id)} className="p-4 cursor-pointer">
        {/* iOS-style folder grid — up to 6 lesson slide thumbnails */}
        <div className="mb-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-800/30 overflow-hidden aspect-[4/3] p-2">
          {lessonSlides.length > 0 ? (
            <div className="grid grid-cols-3 grid-rows-2 gap-1.5 w-full h-full">
              {lessonSlides.slice(0, 6).map((slide, i) => (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden bg-white dark:bg-slate-700/50 border border-border/20"
                >
                  <ThumbnailSlide
                    slide={slide}
                    size={120}
                    viewportSize={slide.viewportSize ?? 1000}
                    viewportRatio={slide.viewportRatio ?? 0.5625}
                  />
                </div>
              ))}
              {/* Fill remaining slots with placeholder icons */}
              {Array.from({ length: Math.max(0, 6 - lessonSlides.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="rounded-lg bg-white/60 dark:bg-slate-700/30 border border-border/10 flex items-center justify-center"
                >
                  <FileText className="size-3.5 text-muted-foreground/15" />
                </div>
              ))}
            </div>
          ) : lessonCount === 0 ? (
            <div className="flex items-center justify-center w-full h-full">
              <Folder className="size-10 text-muted-foreground/20" />
            </div>
          ) : (
            <div className="grid grid-cols-3 grid-rows-2 gap-1.5 w-full h-full">
              {previewLessons.slice(0, 6).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/60 dark:bg-slate-700/30 border border-border/10 flex items-center justify-center"
                >
                  <FileText className="size-3.5 text-muted-foreground/15" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground/90 truncate">{course.name}</h3>
            {course.description && (
              <p className="text-xs text-muted-foreground/50 line-clamp-1 mt-0.5">
                {course.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                {lessonCount} item{lessonCount !== 1 ? 's' : ''}
              </span>
              <span className="text-muted-foreground/20">·</span>
              <span className="text-[11px] text-muted-foreground/40">
                {formatRelativeTime(course.updatedAt)}
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-0.5">
            {/* Expand toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-all"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 transition-transform duration-200',
                  expanded && 'rotate-90',
                )}
              />
            </button>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-all"
              >
                <MoreHorizontal className="size-3.5" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl bg-white dark:bg-slate-800 border border-border/60 shadow-lg py-1"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onDelete(course.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded inline preview */}
      <AnimatePresence>
        {expanded && lessonCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-border/30"
          >
            <div className="px-4 py-2.5 space-y-0.5 max-h-48 overflow-y-auto">
              {course.lessons.map((lesson, i) => (
                <div
                  key={lesson.stageId || i}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <FileText className="size-3 text-violet-400/50 shrink-0" />
                  <span className="text-xs text-foreground/70 truncate flex-1">
                    {lesson.title || `Lesson ${i + 1}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground/30 shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
