'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useDroppable } from '@dnd-kit/core';
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
  stageNames: Map<string, { name: string; sceneCount: number; firstSceneTitle?: string }>;
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
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const isGroup = node.type === 'group';

  // Droppable zone for group nodes (allows nesting)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    disabled: !isGroup,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // --- Inline title editing (Issue 3) ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== node.title) {
      useCourseLibraryStore
        .getState()
        .updateNode(treeId, node.id, { title: trimmed });
    }
    setIsEditing(false);
  }, [editValue, node.title, treeId, node.id]);

  const cancelEdit = useCallback(() => {
    setEditValue(node.title);
    setIsEditing(false);
  }, [node.title]);

  const handleDoubleClick = useCallback(() => {
    setEditValue(node.title);
    setIsEditing(true);
  }, [node.title]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );
  // --- End inline editing ---

  const handleToggleCollapse = useCallback(() => {
    useCourseLibraryStore
      .getState()
      .updateNode(treeId, node.id, { collapsed: !node.collapsed });
  }, [treeId, node.id, node.collapsed]);

  const handleDelete = useCallback(() => {
    useCourseLibraryStore.getState().removeNode(treeId, node.id);
  }, [treeId, node.id]);

  const children = isGroup ? (node.children ?? []) : [];
  const sortedChildren = [...children].sort((a, b) => a.order - b.order);

  // Lesson: resolve stage metadata
  const stageMeta = node.stageId ? stageNames.get(node.stageId) : undefined;
  const displayTitle = isGroup
    ? node.title
    : stageMeta?.firstSceneTitle ?? stageMeta?.name ?? node.title;

  // Combine sortable + droppable refs for group nodes
  const combinedRef = useCallback(
    (el: HTMLElement | null) => {
      setSortableRef(el);
      if (isGroup) {
        setDroppableRef(el);
      }
    },
    [setSortableRef, setDroppableRef, isGroup],
  );

  return (
    <div ref={combinedRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-3 py-2 transition-all',
          isDragging
            ? 'border-violet-400/60 shadow-lg shadow-violet-500/10 z-50'
            : isOver && isGroup
              ? 'border-violet-500 bg-violet-50/60 dark:bg-violet-950/30 shadow-md shadow-violet-500/10'
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
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
              className="w-full text-sm font-medium text-foreground/90 bg-transparent border-b border-violet-400 outline-none py-0"
            />
          ) : (
            <p
              className="text-sm font-medium text-foreground/90 truncate cursor-default"
              onDoubleClick={handleDoubleClick}
            >
              {displayTitle}
            </p>
          )}
          {!isGroup && stageMeta && !isEditing && (
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              {stageMeta.sceneCount} scene{stageMeta.sceneCount !== 1 ? 's' : ''}
            </p>
          )}
          {isGroup && !isEditing && (
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
