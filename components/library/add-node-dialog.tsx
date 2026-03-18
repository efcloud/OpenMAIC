'use client';

import { useState, useMemo } from 'react';
import { BookOpen, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AddNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTitle: string;
  availableStages: Array<{ id: string; name: string; sceneCount: number }>;
  onAddGroup: (title: string, description?: string) => void;
  onAddLesson: (stageId: string) => void;
}

export function AddNodeDialog({
  open,
  onOpenChange,
  parentTitle,
  availableStages,
  onAddGroup,
  onAddLesson,
}: AddNodeDialogProps) {
  const [tab, setTab] = useState<string>('group');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [stageSearch, setStageSearch] = useState('');

  const filteredStages = useMemo(() => {
    if (!stageSearch.trim()) return availableStages;
    const query = stageSearch.toLowerCase();
    return availableStages.filter((s) =>
      s.name.toLowerCase().includes(query),
    );
  }, [availableStages, stageSearch]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setGroupName('');
      setGroupDescription('');
      setStageSearch('');
    }
    onOpenChange(next);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = groupName.trim();
    if (!trimmed) return;
    onAddGroup(trimmed, groupDescription.trim() || undefined);
    setGroupName('');
    setGroupDescription('');
    handleOpenChange(false);
  };

  const handleSelectStage = (stageId: string) => {
    onAddLesson(stageId);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to: {parentTitle}</DialogTitle>
          <DialogDescription>
            Create a new group or add an existing classroom as a lesson.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="group">New Group</TabsTrigger>
            <TabsTrigger value="lesson">Add Lesson</TabsTrigger>
          </TabsList>

          {/* ── New Group ── */}
          <TabsContent value="group">
            <form onSubmit={handleCreateGroup}>
              <div className="grid gap-4 mt-2">
                <div className="grid gap-2">
                  <Label htmlFor="group-name">Title</Label>
                  <Input
                    id="group-name"
                    placeholder="e.g. Module 1: Foundations"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="group-description">
                    Description{' '}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="group-description"
                    placeholder="Brief description of this section..."
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    className="min-h-20 resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!groupName.trim()}>
                  Create Group
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* ── Add Lesson ── */}
          <TabsContent value="lesson">
            <div className="mt-2 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <Input
                  placeholder="Search classrooms..."
                  value={stageSearch}
                  onChange={(e) => setStageSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Stage list */}
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
                {filteredStages.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground/50">
                    {availableStages.length === 0
                      ? 'No classrooms available.'
                      : 'No matching classrooms.'}
                  </div>
                ) : (
                  filteredStages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors"
                      onClick={() => handleSelectStage(stage.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground/90 truncate">
                          {stage.name}
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-0.5 flex items-center gap-1">
                          <BookOpen className="size-3" />
                          {stage.sceneCount} scene
                          {stage.sceneCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
