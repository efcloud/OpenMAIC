# Course Library — Architecture Plan

## Overview

A new `/library` page that lets users organize classrooms into courses and curricula. Classrooms (stages) already exist as standalone units in IndexedDB. The library adds a layer above them — grouping, ordering, and hierarchy.

## Concepts

```
Curriculum (optional top-level)
  └── Course
        └── Module (optional grouping)
              └── Lesson (= existing Stage/Classroom)
```

**Minimum viable**: Course → Lessons (flat list, drag-to-reorder).
**Full version**: Curriculum → Courses → Modules → Lessons (nested hierarchy).

We start with the minimum viable and design for extensibility.

## Data Model

### New: CourseRecord (IndexedDB)

```typescript
interface CourseRecord {
  id: string;           // nanoid
  name: string;
  description?: string;
  coverImage?: string;  // URL or blob reference
  lessons: LessonRef[]; // Ordered list of stage references
  createdAt: number;
  updatedAt: number;
}

interface LessonRef {
  stageId: string;      // References stages table
  title?: string;       // Override display name (defaults to stage.name)
  order: number;        // Position in the course
}
```

### New: CurriculumRecord (future)

```typescript
interface CurriculumRecord {
  id: string;
  name: string;
  description?: string;
  courses: CourseRef[];  // Ordered list of course references
  createdAt: number;
  updatedAt: number;
}

interface CourseRef {
  courseId: string;
  order: number;
}
```

### Database Changes

```typescript
// lib/utils/database.ts — add to Dexie schema (bump version)
db.version(9).stores({
  // ... existing tables ...
  courses: 'id, updatedAt',          // New
  // curricula: 'id, updatedAt',     // Future
});
```

### Relationship to Existing Data

```
courses (NEW)                stages (EXISTING)
┌───────────────┐           ┌──────────────────┐
│ id            │           │ id               │
│ name          │     ┌────►│ name             │
│ lessons[]     │─────┘     │ scenes[]         │
│   stageId  ───┤           │ actions[]        │
│   order       │           │ ...              │
│ createdAt     │           └──────────────────┘
└───────────────┘
```

A stage can appear in multiple courses (reference, not copy). Deleting a course doesn't delete its stages. Deleting a stage removes it from courses that reference it (cleanup on load).

## UI Design

### `/library` Page

```
┌──────────────────────────────────────────────────────────┐
│  ← Home    Course Library                    + New Course │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ 📘          │  │ 📗          │  │ 📙          │     │
│  │ Course 1    │  │ Course 2    │  │ Course 3    │     │
│  │ 5 lessons   │  │ 3 lessons   │  │ 8 lessons   │     │
│  │ Updated 2h  │  │ Updated 1d  │  │ Updated 3d  │     │
│  │             │  │             │  │             │     │
│  │ [Open] [⋯] │  │ [Open] [⋯] │  │ [Open] [⋯] │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  Unassigned Classrooms ──────────────────────────────── │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │
│  │ PPT │ │ PPT │ │ PPT │ │ PPT │ │ PPT │              │
│  │  1  │ │  2  │ │  3  │ │  4  │ │  5  │              │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
│  (drag these into a course above)                        │
└──────────────────────────────────────────────────────────┘
```

### Course Detail View (inline expand or separate page)

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Library    📘 Course: "Intro to Physics"      │
│                                                   [Edit] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ≡  1. Newton's Laws           [▶ Enter]  [✕ Remove]    │
│  ≡  2. Forces and Motion       [▶ Enter]  [✕ Remove]    │
│  ≡  3. Energy Conservation     [▶ Enter]  [✕ Remove]    │
│  ≡  4. Quiz: Unit Review       [▶ Enter]  [✕ Remove]    │
│                                                          │
│  ─── Drop zone: drag classrooms here ───                 │
│                                                          │
│  Available Classrooms:                                   │
│  ┌─────┐ ┌─────┐ ┌─────┐                               │
│  │ PPT │ │ PPT │ │ PPT │  (drag to add)                │
│  └─────┘ └─────┘ └─────┘                               │
└──────────────────────────────────────────────────────────┘

≡ = drag handle for reordering
```

## Technical Implementation

### New Files

```
app/library/
  page.tsx                    # Library page (course grid + unassigned)
  [courseId]/
    page.tsx                  # Course detail (lesson list + reorder)

lib/store/
  course-library.ts           # Zustand store for courses

lib/utils/
  course-storage.ts           # IndexedDB CRUD for courses

components/library/
  course-card.tsx             # Course grid card
  course-detail.tsx           # Course detail with drag-drop lessons
  lesson-card.tsx             # Draggable lesson card (mini stage preview)
  drop-zone.tsx               # Drop target for adding lessons to course
```

### Dependencies

```json
{
  "@dnd-kit/core": "^6",
  "@dnd-kit/sortable": "^10",
  "@dnd-kit/utilities": "^3"
}
```

`@dnd-kit` is the standard React drag-and-drop library — lightweight, accessible, works with React 19. Provides `useSortable`, `DndContext`, `SortableContext` for the reorderable lesson list.

### Zustand Store

```typescript
// lib/store/course-library.ts
interface CourseLibraryState {
  courses: CourseRecord[];
  loading: boolean;

  // CRUD
  loadCourses: () => Promise<void>;
  createCourse: (name: string, description?: string) => Promise<string>;
  updateCourse: (id: string, updates: Partial<CourseRecord>) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;

  // Lesson management
  addLesson: (courseId: string, stageId: string) => Promise<void>;
  removeLesson: (courseId: string, stageId: string) => Promise<void>;
  reorderLessons: (courseId: string, lessons: LessonRef[]) => Promise<void>;
}
```

### Storage Layer

```typescript
// lib/utils/course-storage.ts
export async function listCourses(): Promise<CourseRecord[]>;
export async function getCourse(id: string): Promise<CourseRecord | null>;
export async function saveCourse(course: CourseRecord): Promise<void>;
export async function deleteCourse(id: string): Promise<void>;

// Get stages NOT assigned to any course (for "unassigned" section)
export async function getUnassignedStages(): Promise<StageListItem[]>;
```

### Navigation

```
/                    → Home (existing: create classroom, recent list)
/library             → Course Library (NEW: course grid + unassigned)
/library/[courseId]  → Course Detail (NEW: lesson list, reorder, enter)
/classroom/[id]      → Classroom (existing: playback/editor)
```

The existing home page (`/`) keeps its "create classroom" flow. The library is a separate organizational layer.

### Drag-and-Drop Flow

1. **Reorder lessons within a course**: `@dnd-kit/sortable` with vertical list
2. **Add lesson to course**: Drag from "unassigned" grid into the course's drop zone
3. **Remove lesson**: Click remove button (not drag — simpler UX)
4. **Move between courses**: Future — drag from one course to another

### Stage Thumbnail Preview

The existing `getFirstSlideByStages()` function already generates slide thumbnails. Reuse it for the lesson cards in the library.

## Phases

### Phase 1: Core Library (this PR)

- [ ] Add `courses` table to Dexie (version bump)
- [ ] Create `course-storage.ts` (CRUD)
- [ ] Create `course-library.ts` (Zustand store)
- [ ] Build `/library` page with course grid
- [ ] Build `/library/[courseId]` with lesson list
- [ ] Add `@dnd-kit` for drag-to-reorder lessons
- [ ] Drag unassigned classrooms into courses
- [ ] Navigate to classroom from lesson card
- [ ] Add "Library" link to home page and sidebar

### Phase 2: Polish

- [ ] Course cover image (from first lesson's first slide)
- [ ] Lesson progress tracking (which lessons have been played)
- [ ] Sequential playback (finish lesson → auto-open next)
- [ ] Course duplication
- [ ] Export course structure as JSON

### Phase 3: Curriculum Hierarchy (future)

- [ ] Add `curricula` table
- [ ] Nest courses within curricula
- [ ] Tree view navigation
- [ ] Curriculum-level progress dashboard

## Integration with Efekta Content Agent (future)

The Course Library maps cleanly to Acci's CourseTree agent:

```
Acci CourseTree         Library
─────────────          ───────
Tree root          →   Curriculum
  Level 1 nodes    →   Courses
    Level 2 nodes  →   Modules (optional)
      Leaf nodes   →   Lessons (Stages)
```

Acci can generate a CourseTree → adapter converts to Library courses + stages.
