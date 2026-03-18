'use client';

import { useDraggable } from '@dnd-kit/core';
import { BookOpen, GripVertical, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnassignedStagesProps {
  stages: Array<{ id: string; name: string; sceneCount: number; updatedAt: number }>;
  onDragStart?: (stageId: string) => void;
}

function DraggableStageCard({
  stage,
  onDragStart,
}: {
  stage: { id: string; name: string; sceneCount: number; updatedAt: number };
  onDragStart?: (stageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: stage.id,
    data: { type: 'stage', stageId: stage.id },
  });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-start gap-2 rounded-xl border border-gray-100 dark:border-gray-800',
        'bg-white dark:bg-slate-900/80 p-3',
        'transition-all duration-200',
        isDragging
          ? 'shadow-lg ring-2 ring-purple-300 dark:ring-purple-600 z-50 opacity-90 scale-[1.03]'
          : 'shadow-xs hover:shadow-md hover:scale-[1.01]',
      )}
      onPointerDown={() => onDragStart?.(stage.id)}
    >
      {/* Drag handle */}
      <button
        className={cn(
          'shrink-0 touch-none cursor-grab active:cursor-grabbing',
          'rounded-md p-0.5 text-gray-400 dark:text-gray-500',
          'hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300',
          'transition-colors mt-0.5',
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/90 truncate leading-snug">
          {stage.name}
        </p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
          <BookOpen className="size-3" />
          {stage.sceneCount} {stage.sceneCount === 1 ? 'scene' : 'scenes'}
        </p>
      </div>
    </div>
  );
}

export function UnassignedStages({ stages, onDragStart }: UnassignedStagesProps) {
  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-8 text-center">
        <Inbox className="size-8 mx-auto text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          All classrooms assigned
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Create new classrooms or remove lessons from courses to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {stages.map((stage) => (
        <DraggableStageCard
          key={stage.id}
          stage={stage}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}
