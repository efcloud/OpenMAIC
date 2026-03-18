/**
 * Course Library Store
 *
 * Zustand store for managing the course library with recursive tree structures.
 * Delegates persistence to course-storage (IndexedDB via Dexie).
 * Uses pure tree operations from course-tree-ops for immutable updates.
 */

import { create } from 'zustand';
import type { CourseNode, CourseTreeRecord } from '@/lib/types/course-tree';
import {
  listCourseTrees,
  saveCourseTree,
  deleteCourseTree,
} from '@/lib/utils/course-storage';
import * as ops from '@/lib/utils/course-tree-ops';
import { nanoid } from 'nanoid';
import { createSelectors } from '@/lib/utils/create-selectors';
import { createLogger } from '@/lib/logger';

const log = createLogger('CourseLibrary');

interface CourseLibraryState {
  trees: CourseTreeRecord[];
  loading: boolean;

  loadTrees: () => Promise<void>;
  createTree: (name: string, description?: string) => Promise<string>;
  deleteTree: (id: string) => Promise<void>;

  // Tree operations (all take treeId + use ops functions)
  addNode: (treeId: string, parentId: string, node: CourseNode) => Promise<void>;
  removeNode: (treeId: string, nodeId: string) => Promise<void>;
  moveNode: (
    treeId: string,
    nodeId: string,
    newParentId: string,
    index: number,
  ) => Promise<void>;
  reorderChildren: (
    treeId: string,
    parentId: string,
    orderedIds: string[],
  ) => Promise<void>;
  updateNode: (
    treeId: string,
    nodeId: string,
    updates: Partial<Pick<CourseNode, 'title' | 'description' | 'collapsed'>>,
  ) => Promise<void>;
}

/**
 * Helper: find a tree by ID in current state, apply a root mutation, persist, and update state.
 */
async function mutateTree(
  get: () => CourseLibraryState,
  set: (partial: Partial<CourseLibraryState>) => void,
  treeId: string,
  mutate: (root: CourseNode) => CourseNode,
): Promise<void> {
  const tree = get().trees.find((t) => t.id === treeId);
  if (!tree) {
    log.warn('Tree not found:', treeId);
    return;
  }

  const newRoot = mutate(tree.root);
  const updated: CourseTreeRecord = {
    ...tree,
    root: newRoot,
    updatedAt: Date.now(),
  };

  await saveCourseTree(updated);
  set({
    trees: get().trees.map((t) => (t.id === treeId ? updated : t)),
  });
}

const useCourseLibraryBase = create<CourseLibraryState>()((set, get) => ({
  trees: [],
  loading: false,

  loadTrees: async () => {
    set({ loading: true });
    try {
      const trees = await listCourseTrees();
      set({ trees });
    } catch (error) {
      log.error('Failed to load course trees:', error);
    } finally {
      set({ loading: false });
    }
  },

  createTree: async (name, description) => {
    const now = Date.now();
    const treeId = nanoid();
    const tree: CourseTreeRecord = {
      id: treeId,
      name,
      description,
      root: {
        id: nanoid(),
        type: 'group',
        title: name,
        order: 0,
        children: [],
      },
      createdAt: now,
      updatedAt: now,
    };
    await saveCourseTree(tree);
    set({ trees: [tree, ...get().trees] });
    return treeId;
  },

  deleteTree: async (id) => {
    await deleteCourseTree(id);
    set({ trees: get().trees.filter((t) => t.id !== id) });
  },

  addNode: async (treeId, parentId, node) => {
    await mutateTree(get, set, treeId, (root) =>
      ops.addChild(root, parentId, node),
    );
  },

  removeNode: async (treeId, nodeId) => {
    await mutateTree(get, set, treeId, (root) =>
      ops.removeNode(root, nodeId),
    );
  },

  moveNode: async (treeId, nodeId, newParentId, index) => {
    await mutateTree(get, set, treeId, (root) =>
      ops.moveNode(root, nodeId, newParentId, index),
    );
  },

  reorderChildren: async (treeId, parentId, orderedIds) => {
    await mutateTree(get, set, treeId, (root) =>
      ops.reorderChildren(root, parentId, orderedIds),
    );
  },

  updateNode: async (treeId, nodeId, updates) => {
    await mutateTree(get, set, treeId, (root) =>
      ops.updateNode(root, nodeId, updates),
    );
  },
}));

export const useCourseLibraryStore = createSelectors(useCourseLibraryBase);
