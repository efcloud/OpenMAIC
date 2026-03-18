/**
 * Course Tree Types
 *
 * Recursive tree structure for organizing courses into nested groups and lessons.
 */

export interface CourseNode {
  id: string;
  type: 'group' | 'lesson';
  title: string;
  description?: string;
  order: number;
  children?: CourseNode[]; // Group only
  collapsed?: boolean; // Group only — UI state
  stageId?: string; // Lesson only — reference to stages table
}

export interface CourseTreeRecord {
  id: string;
  name: string;
  description?: string;
  root: CourseNode; // Entire tree as nested JSON
  createdAt: number;
  updatedAt: number;
}
