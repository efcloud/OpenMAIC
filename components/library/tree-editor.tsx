'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TreeNode } from '@/components/library/tree-node';
import { AddNodeDialog } from '@/components/library/add-node-dialog';
import { RenameDialog } from '@/components/library/rename-dialog';
import { useCourseLibraryStore } from '@/lib/store/course-library';
import { findParent } from '@/lib/utils/course-tree-ops';
import type { CourseNode } from '@/lib/types/course-tree';
import { nanoid } from 'nanoid';

interface TreeEditorProps {
  treeId: string;
  root: CourseNode;
  stageNames: Map<string, { name: string; sceneCount: number }>;
  availableStages: Array<{ id: string; name: string; sceneCount: number }>;
  onEnterLesson: (stageId: string) => void;
}

export function TreeEditor({
  treeId,
  root,
  stageNames,
  availableStages,
  onEnterLesson,
}: TreeEditorProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    nodeId: string;
    currentTitle: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortedChildren = useMemo(() => {
    const children = root.children ?? [];
    return [...children].sort((a, b) => a.order - b.order);
  }, [root.children]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find the parent of the active node to determine which level we're reordering
      const parent = findParent(root, activeId);
      if (!parent || !parent.children) return;

      // Check if both active and over are siblings (same parent)
      const overParent = findParent(root, overId);
      if (!overParent || parent.id !== overParent.id) return;

      // Reorder within the same parent
      const childIds = [...parent.children]
        .sort((a, b) => a.order - b.order)
        .map((c) => c.id);

      const oldIndex = childIds.indexOf(activeId);
      const newIndex = childIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;

      // Perform array move
      childIds.splice(oldIndex, 1);
      childIds.splice(newIndex, 0, activeId);

      useCourseLibraryStore
        .getState()
        .reorderChildren(treeId, parent.id, childIds);
    },
    [treeId, root],
  );

  const handleAddGroup = useCallback(
    (title: string, description?: string) => {
      const node: CourseNode = {
        id: nanoid(),
        type: 'group',
        title,
        description,
        order: (root.children?.length ?? 0),
        children: [],
      };
      useCourseLibraryStore.getState().addNode(treeId, root.id, node);
    },
    [treeId, root.id, root.children?.length],
  );

  const handleAddLesson = useCallback(
    (stageId: string) => {
      const meta = stageNames.get(stageId);
      const node: CourseNode = {
        id: nanoid(),
        type: 'lesson',
        title: meta?.name ?? 'Untitled Lesson',
        order: (root.children?.length ?? 0),
        stageId,
      };
      useCourseLibraryStore.getState().addNode(treeId, root.id, node);
    },
    [treeId, root.id, root.children?.length, stageNames],
  );

  const handleRename = useCallback(
    (nodeId: string, currentTitle: string) => {
      setRenameTarget({ nodeId, currentTitle });
    },
    [],
  );

  const handleRenameSubmit = useCallback(
    (newTitle: string) => {
      if (!renameTarget) return;
      useCourseLibraryStore
        .getState()
        .updateNode(treeId, renameTarget.nodeId, { title: newTitle });
      setRenameTarget(null);
    },
    [treeId, renameTarget],
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="size-4 mr-1.5" />
          Add
        </Button>
      </div>

      {/* Tree */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedChildren.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {sortedChildren.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground/50">
                No items yet. Click &quot;Add&quot; to create groups or add
                lessons.
              </div>
            ) : (
              sortedChildren.map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  depth={0}
                  treeId={treeId}
                  onEnterLesson={onEnterLesson}
                  onRename={handleRename}
                  stageNames={stageNames}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add dialog */}
      <AddNodeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        parentTitle={root.title}
        availableStages={availableStages}
        onAddGroup={handleAddGroup}
        onAddLesson={handleAddLesson}
      />

      {/* Rename dialog */}
      <RenameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        currentTitle={renameTarget?.currentTitle ?? ''}
        onRename={handleRenameSubmit}
      />
    </div>
  );
}
