'use client';

import { motion } from 'motion/react';
import { BookOpen, Clock, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CourseCardProps {
  course: {
    id: string;
    name: string;
    description?: string;
    lessons: Array<{ stageId: string; title?: string; order: number }>;
    updatedAt: number;
  };
  onOpen: (courseId: string) => void;
  onDelete: (courseId: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function CourseCard({ course, onOpen, onDelete }: CourseCardProps) {
  const lessonCount = course.lessons.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'group relative rounded-2xl border border-gray-100 dark:border-gray-800',
        'bg-white dark:bg-slate-900/80 shadow-xs hover:shadow-md',
        'transition-all duration-200 hover:scale-[1.02]',
        'cursor-pointer overflow-hidden',
      )}
      onClick={() => onOpen(course.id)}
    >
      {/* Header gradient strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-violet-400 to-purple-500 dark:from-violet-500 dark:to-purple-600" />

      <div className="p-4">
        {/* Top row: title + menu */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-[15px] text-foreground/90 leading-snug line-clamp-2 min-w-0">
            {course.name}
          </h3>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(course.id);
                }}
              >
                <Trash2 className="size-4" />
                Delete course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {course.description && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {course.description}
          </p>
        )}

        {/* Footer meta */}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 font-medium text-violet-600 dark:text-violet-400">
            <BookOpen className="size-3" />
            {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatRelativeTime(course.updatedAt)}
          </span>
        </div>

        {/* Open button */}
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(course.id);
          }}
        >
          Open
        </Button>
      </div>
    </motion.div>
  );
}
