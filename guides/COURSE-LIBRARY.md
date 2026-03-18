# Course Library — Architecture Plan (v2)

## Core Concept

A recursive tree where every item is a **node**. A node is either:
- **Group** — a container (Course, Module, Unit, Chapter, Section)
- **Lesson** — a link to an existing classroom/stage

Groups can contain other groups and lessons at any depth. The structure is fully flexible — the user decides the hierarchy.

```
📚 English Curriculum           ← group (depth 0)
  📘 Beginner Course            ← group (depth 1)
    📂 Unit 1: Greetings        ← group (depth 2)
      📄 Lesson: Hello World    ← lesson (→ stageId)
      📄 Lesson: Introductions  ← lesson (→ stageId)
      📄 Lesson: Quiz           ← lesson (→ stageId)
    📂 Unit 2: Daily Life       ← group (depth 2)
      📄 Lesson: Food           ← lesson (→ stageId)
      📄 Lesson: Transport      ← lesson (→ stageId)
  📘 Intermediate Course        ← group (depth 1)
    📄 Lesson: Business English ← lesson (→ stageId)
```

The **depth labels** (Curriculum, Course, Unit, Lesson) are just display hints — the data model doesn't care about depth names. Users can nest as deep as they want.

## Data Model

### CourseNode (recursive)

```typescript
interface CourseNode {
  id: string;
  type: 'group' | 'lesson';
  title: string;
  description?: string;
  order: number;

  // Group-only
  children?: CourseNode[];
  collapsed?: boolean;       // UI state: collapsed in tree view

  // Lesson-only
  stageId?: string;          // Reference to stages table
}
```

### CourseTreeRecord (IndexedDB — one per top-level tree)

```typescript
interface CourseTreeRecord {
  id: string;                // nanoid
  name: string;              // Display name for the library grid
  description?: string;
  root: CourseNode;          // The entire tree is stored as one nested JSON
  createdAt: number;
  updatedAt: number;
}
```

The whole tree is a single JSON blob in IndexedDB. Trees are small (metadata only, no media), so this is efficient and avoids complex relational queries.

### Database

```typescript
// courses table stores CourseTreeRecord
// Primary key: id, Index: updatedAt
db.version(9).stores({
  courses: 'id, updatedAt',
});
```

## UI Design

### Library Page (`/library`)

Grid of top-level trees (same as before) + unassigned classrooms.

### Tree Editor (`/library/[treeId]`)

```
┌──────────────────────────────────────────────────────────┐
│  ← Library    📚 English Curriculum         [+ Group] [+ Lesson] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ▼ 📘 Beginner Course                          [⋯]     │
│    │                                                     │
│    ├─ ▼ 📂 Unit 1: Greetings                   [⋯]     │
│    │   ├─ 📄 Hello World          [▶ Enter]    [⋯]     │
│    │   ├─ 📄 Introductions        [▶ Enter]    [⋯]     │
│    │   └─ 📄 Quiz                 [▶ Enter]    [⋯]     │
│    │                                                     │
│    └─ ▶ 📂 Unit 2: Daily Life  (collapsed)      [⋯]     │
│                                                          │
│  ▼ 📘 Intermediate Course                       [⋯]     │
│    └─ 📄 Business English      [▶ Enter]        [⋯]     │
│                                                          │
│  ─── Drop zone: drag classrooms here to add ───         │
│                                                          │
│  Available Classrooms:                                   │
│  ┌─────┐ ┌─────┐ ┌─────┐                               │
│  │ PPT │ │ PPT │ │ PPT │                               │
│  └─────┘ └─────┘ └─────┘                               │
└──────────────────────────────────────────────────────────┘
```

### Interactions

- **Collapse/expand** groups by clicking the arrow
- **Drag to reorder** nodes within the same level
- **Drag to nest** — drop a node onto a group to move it inside
- **Drag out** — drag from a group to the parent level
- **Add group** — creates a new empty group at the current level
- **Add lesson** — opens a picker of available classrooms
- **[⋯] menu** — Rename, Delete, Convert group↔lesson
- **[▶ Enter]** — opens `/classroom/[stageId]` for lessons

### Depth Labels (cosmetic)

The UI auto-labels based on depth for visual clarity:

| Depth | Icon | Default Label |
|-------|------|---------------|
| 0 | 📚 | Curriculum |
| 1 | 📘 | Course |
| 2 | 📂 | Module |
| 3 | 📁 | Unit |
| 4 | 📋 | Section |
| 5+ | 📎 | Group |

These are just display hints — the data model is depth-agnostic.

## Technical Implementation

### Files

```
lib/types/course-tree.ts          # CourseNode, CourseTreeRecord types
lib/utils/course-storage.ts       # IndexedDB CRUD (rewrite)
lib/store/course-library.ts       # Zustand store (rewrite for tree ops)
lib/utils/course-tree-ops.ts      # Pure tree manipulation functions

components/library/
  course-card.tsx                  # Grid card (keep)
  tree-editor.tsx                  # Main tree view + drag-drop
  tree-node.tsx                    # Recursive node component
  add-node-dialog.tsx              # Dialog for adding group or lesson
  node-menu.tsx                    # Context menu for node actions

app/library/
  page.tsx                         # Library grid (minor update)
  [treeId]/page.tsx                # Tree editor (rewrite)
```

### Tree Operations (pure functions)

```typescript
// lib/utils/course-tree-ops.ts

// Find a node by ID anywhere in the tree
findNode(root: CourseNode, id: string): CourseNode | null

// Find parent of a node
findParent(root: CourseNode, id: string): CourseNode | null

// Add a child to a group
addChild(root: CourseNode, parentId: string, child: CourseNode): CourseNode

// Remove a node (and all descendants if group)
removeNode(root: CourseNode, id: string): CourseNode

// Move a node to a new parent at a specific index
moveNode(root: CourseNode, nodeId: string, newParentId: string, index: number): CourseNode

// Reorder children within a parent
reorderChildren(root: CourseNode, parentId: string, orderedIds: string[]): CourseNode

// Flatten tree to ordered lesson list (for sequential playback)
flattenLessons(root: CourseNode): Array<{ stageId: string; path: string[] }>
```

All operations return a new tree (immutable). The store replaces the root.

### Drag-and-Drop

Use `@dnd-kit/core` with custom collision detection:
- **Reorder** within same level: vertical list sortable
- **Nest** into group: detect drop on a group node → add as last child
- **Un-nest**: drag to left edge → move to parent level

This requires `@dnd-kit/core` (already installed) but NOT `@dnd-kit/sortable` for the tree — we need custom logic for nesting.

## Phases

### Phase 1: Core Tree (this PR)
- [ ] Define types (CourseNode, CourseTreeRecord)
- [ ] Tree operation pure functions
- [ ] Update IndexedDB schema + storage
- [ ] Update Zustand store for tree ops
- [ ] Build tree editor component (recursive)
- [ ] Drag-to-reorder within same level
- [ ] Add group / add lesson dialogs
- [ ] Collapse/expand groups
- [ ] Delete / rename nodes

### Phase 2: Advanced DnD
- [ ] Drag to nest (drop on group)
- [ ] Drag to un-nest (drop on parent level)
- [ ] Drag between trees (library page)
- [ ] Visual drop indicators (line above/below/inside)

### Phase 3: Integration
- [ ] Sequential playback (flatten tree → play lessons in order)
- [ ] Progress tracking per lesson node
- [ ] Acci CourseTree import (convert Acci tree → CourseNode tree)
- [ ] Export/import tree as JSON
