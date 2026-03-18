'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, BookOpen, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LessonCardProps {
  lesson: { stageId: string; title?: string; order: number };
  stageName?: string;
  sceneCount?: number;
  onEnter: (stageId: string) => void;
  onRemove: (stageId: string) => void;
}

export function LessonCard({
  lesson,
  stageName,
  sceneCount,
  onEnter,
  onRemove,
}: LessonCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.stageId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayTitle = lesson.title || stageName || 'Untitled lesson';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800',
        'bg-white dark:bg-slate-900/80 px-3 py-2.5',
        'transition-shadow duration-200',
        isDragging
          ? 'shadow-lg ring-2 ring-purple-300 dark:ring-purple-600 z-50 opacity-95'
          : 'shadow-xs hover:shadow-md',
      )}
    >
      {/* Drag handle */}
      <button
        className={cn(
          'shrink-0 touch-none cursor-grab active:cursor-grabbing',
          'rounded-md p-1 text-gray-400 dark:text-gray-500',
          'hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300',
          'transition-colors',
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Lesson number badge */}
      <span
        className={cn(
          'shrink-0 text-[10px] font-black w-5 h-5 rounded-full',
          'flex items-center justify-center',
          'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        )}
      >
        {lesson.order}
      </span>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/90 truncate">
          {displayTitle}
        </p>
        {sceneCount !== undefined && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <BookOpen className="size-3" />
            {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="default"
          size="xs"
          onClick={() => onEnter(lesson.stageId)}
        >
          <Play className="size-3" data-icon="inline-start" />
          Enter
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(lesson.stageId)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
