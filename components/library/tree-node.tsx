'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCourseLibraryStore } from '@/lib/store/course-library';
import type { CourseNode } from '@/lib/types/course-tree';

interface TreeNodeProps {
  node: CourseNode;
  depth: number;
  treeId: string;
  onEnterLesson: (stageId: string) => void;
  onRename: (nodeId: string, currentTitle: string) => void;
  stageNames: Map<string, { name: string; sceneCount: number }>;
}

const DEPTH_ICONS = [
  '\u{1F4D8}', // 0: Course
  '\u{1F4C2}', // 1: Module
  '\u{1F4C1}', // 2: Unit
  '\u{1F4CB}', // 3: Section
] as const;

function getDepthIcon(depth: number): string {
  if (depth < DEPTH_ICONS.length) return DEPTH_ICONS[depth];
  return '\u{1F4CE}'; // 4+: Group
}

export function TreeNode({
  node,
  depth,
  treeId,
  onEnterLesson,
  onRename,
  stageNames,
}: TreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleToggleCollapse = useCallback(() => {
    useCourseLibraryStore
      .getState()
      .updateNode(treeId, node.id, { collapsed: !node.collapsed });
  }, [treeId, node.id, node.collapsed]);

  const handleDelete = useCallback(() => {
    useCourseLibraryStore.getState().removeNode(treeId, node.id);
  }, [treeId, node.id]);

  const isGroup = node.type === 'group';
  const children = isGroup ? (node.children ?? []) : [];
  const sortedChildren = [...children].sort((a, b) => a.order - b.order);

  // Lesson: resolve stage metadata
  const stageMeta = node.stageId ? stageNames.get(node.stageId) : undefined;
  const displayTitle = isGroup
    ? node.title
    : stageMeta?.name ?? node.title;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-3 py-2 transition-all',
          isDragging
            ? 'border-violet-400/60 shadow-lg shadow-violet-500/10 z-50'
            : 'border-border/50 hover:border-border/80',
        )}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-1 -ml-1 rounded-md text-muted-foreground/30 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Collapse arrow (groups only) */}
        {isGroup ? (
          <button
            onClick={handleToggleCollapse}
            className="shrink-0 p-0.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform duration-200',
                !node.collapsed && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="shrink-0 w-5" />
        )}

        {/* Icon */}
        <span className="shrink-0 text-sm select-none" aria-hidden>
          {isGroup ? getDepthIcon(depth) : '\u{1F4C4}'}
        </span>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground/90 truncate">
            {displayTitle}
          </p>
          {!isGroup && stageMeta && (
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              {stageMeta.sceneCount} scene{stageMeta.sceneCount !== 1 ? 's' : ''}
            </p>
          )}
          {isGroup && (
            <p className="text-xs text-muted-foreground/40 mt-0.5">
              {children.length} item{children.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Enter button (lessons only) */}
          {!isGroup && node.stageId && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              onClick={() => onEnterLesson(node.stageId!)}
            >
              <Play className="size-3.5" />
            </Button>
          )}

          {/* Context menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground/40 hover:text-muted-foreground/80"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRename(node.id, node.title)}>
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children (groups only, animated) */}
      {isGroup && (
        <AnimatePresence initial={false}>
          {!node.collapsed && sortedChildren.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <SortableContext
                items={sortedChildren.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-1 space-y-1">
                  {sortedChildren.map((child) => (
                    <TreeNode
                      key={child.id}
                      node={child}
                      depth={depth + 1}
                      treeId={treeId}
                      onEnterLesson={onEnterLesson}
                      onRename={onRename}
                      stageNames={stageNames}
                    />
                  ))}
                </div>
              </SortableContext>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
