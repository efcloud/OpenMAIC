/**
 * Course Tree Operations
 *
 * Pure functions for immutable tree manipulation.
 * All functions return a NEW tree (deep clone + modify).
 */

import type { CourseNode } from '@/lib/types/course-tree';

/**
 * Recursive DFS search for a node by ID.
 */
export function findNode(root: CourseNode, id: string): CourseNode | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find the parent node that contains childId in its children array.
 * Returns null if childId is the root or not found.
 */
export function findParent(root: CourseNode, childId: string): CourseNode | null {
  if (root.children) {
    for (const child of root.children) {
      if (child.id === childId) return root;
      const found = findParent(child, childId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Re-normalize order values on children so they are 0, 1, 2, ...
 */
function normalizeOrder(children: CourseNode[]): void {
  for (let i = 0; i < children.length; i++) {
    children[i].order = i;
  }
}

/**
 * Deep clone root, find parent by ID, append child to its children array,
 * and re-normalize order values.
 */
export function addChild(
  root: CourseNode,
  parentId: string,
  child: CourseNode,
): CourseNode {
  const cloned = structuredClone(root);
  const parent = findNode(cloned, parentId);
  if (!parent) return cloned;

  if (!parent.children) {
    parent.children = [];
  }
  parent.children.push(child);
  normalizeOrder(parent.children);

  return cloned;
}

/**
 * Deep clone root, remove node from its parent's children,
 * and re-normalize order values.
 * If removing the root itself, return root unchanged.
 */
export function removeNode(root: CourseNode, nodeId: string): CourseNode {
  // Cannot remove the root node
  if (root.id === nodeId) return root;

  const cloned = structuredClone(root);
  const parent = findParent(cloned, nodeId);
  if (!parent || !parent.children) return cloned;

  parent.children = parent.children.filter((c) => c.id !== nodeId);
  normalizeOrder(parent.children);

  return cloned;
}

/**
 * Remove node from its current position and insert it into
 * newParent.children at the given index.
 */
export function moveNode(
  root: CourseNode,
  nodeId: string,
  newParentId: string,
  index: number,
): CourseNode {
  // Cannot move the root
  if (root.id === nodeId) return root;

  const cloned = structuredClone(root);

  // Find and detach the node from its current parent
  const currentParent = findParent(cloned, nodeId);
  if (!currentParent || !currentParent.children) return cloned;

  const nodeIndex = currentParent.children.findIndex((c) => c.id === nodeId);
  if (nodeIndex === -1) return cloned;

  const [node] = currentParent.children.splice(nodeIndex, 1);
  normalizeOrder(currentParent.children);

  // Find the new parent and insert
  const newParent = findNode(cloned, newParentId);
  if (!newParent) return cloned;

  if (!newParent.children) {
    newParent.children = [];
  }

  const clampedIndex = Math.max(0, Math.min(index, newParent.children.length));
  newParent.children.splice(clampedIndex, 0, node);
  normalizeOrder(newParent.children);

  return cloned;
}

/**
 * Reorder children of parentId to match the orderedIds array order.
 * Children not in orderedIds are appended at the end.
 */
export function reorderChildren(
  root: CourseNode,
  parentId: string,
  orderedIds: string[],
): CourseNode {
  const cloned = structuredClone(root);
  const parent = findNode(cloned, parentId);
  if (!parent || !parent.children) return cloned;

  const childMap = new Map(parent.children.map((c) => [c.id, c]));

  const reordered: CourseNode[] = [];

  // First, add children in the specified order
  for (const id of orderedIds) {
    const child = childMap.get(id);
    if (child) {
      reordered.push(child);
      childMap.delete(id);
    }
  }

  // Append any remaining children not in orderedIds
  for (const child of childMap.values()) {
    reordered.push(child);
  }

  parent.children = reordered;
  normalizeOrder(parent.children);

  return cloned;
}

/**
 * Update specific fields on a node.
 */
export function updateNode(
  root: CourseNode,
  nodeId: string,
  updates: Partial<Pick<CourseNode, 'title' | 'description' | 'collapsed'>>,
): CourseNode {
  const cloned = structuredClone(root);
  const node = findNode(cloned, nodeId);
  if (!node) return cloned;

  if (updates.title !== undefined) node.title = updates.title;
  if (updates.description !== undefined) node.description = updates.description;
  if (updates.collapsed !== undefined) node.collapsed = updates.collapsed;

  return cloned;
}

/**
 * Recursively collect all lessons with their path (breadcrumb of parent titles).
 */
export function flattenLessons(
  node: CourseNode,
  path: string[] = [],
): Array<{ stageId: string; path: string[] }> {
  const results: Array<{ stageId: string; path: string[] }> = [];

  if (node.type === 'lesson' && node.stageId) {
    results.push({ stageId: node.stageId, path: [...path, node.title] });
  }

  if (node.children) {
    const currentPath = node.type === 'group' ? [...path, node.title] : path;
    // Sort children by order before flattening
    const sorted = [...node.children].sort((a, b) => a.order - b.order);
    for (const child of sorted) {
      results.push(...flattenLessons(child, currentPath));
    }
  }

  return results;
}
