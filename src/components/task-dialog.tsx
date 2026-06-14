"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PeopleSelect } from "@/components/ui/people-select";
import { createTask, updateTask, type TaskInput } from "@/lib/actions";
import {
  PRIORITIES,
  buildFolderTree,
  flattenFolderTree,
  type Folder,
  type Priority,
  type Profile,
  type Status,
  type TaskWithRelations,
  type Team,
} from "@/lib/types";

export function TaskDialog({
  open,
  onClose,
  statuses,
  teams,
  profiles,
  folders = [],
  task,
  defaultStatusId,
  defaultFolderId,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  statuses: Status[];
  teams: Team[];
  profiles: Profile[];
  folders?: Folder[];
  task?: TaskWithRelations | null;
  defaultStatusId?: string | null;
  defaultFolderId?: string | null;
  parentId?: string | null;
}) {
  const router = useRouter();
  const editing = Boolean(task);
  const isSubtask = Boolean(parentId) && !editing;

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [statusId, setStatusId] = React.useState<string>("");
  const [teamId, setTeamId] = React.useState<string>("");
  const [assigneeId, setAssigneeId] = React.useState<string>("");
  const [dueDate, setDueDate] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [folderId, setFolderId] = React.useState<string>("");
  const [watchers, setWatchers] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const folderOptions = React.useMemo(
    () => flattenFolderTree(buildFolderTree(folders)),
    [folders],
  );

  // Initialize form whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setStatusId(task.status_id ?? "");
      setTeamId(task.team_id ?? "");
      setAssigneeId(task.assignee_id ?? "");
      setDueDate(task.due_date ?? "");
      setStartDate(task.start_date ?? "");
      setFolderId(task.folder_id ?? "");
      setWatchers(task.watchers.map((w) => w.id));
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatusId(defaultStatusId || statuses[0]?.id || "");
      setTeamId("");
      setAssigneeId("");
      setDueDate("");
      setStartDate("");
      setFolderId(defaultFolderId ?? "");
      setWatchers([]);
    }
  }, [open, task, defaultStatusId, defaultFolderId, statuses]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    const input: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status_id: statusId || null,
      team_id: teamId || null,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      start_date: startDate || null,
      folder_id: folderId || null,
      watchers,
      parent_id: parentId ?? null,
    };

    const res = task
      ? await updateTask(task.id, input)
      : await createTask(input);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title={editing ? "Edit task" : isSubtask ? "Add subtask" : "Create task"}
        description={
          editing
            ? "Update the details below."
            : isSubtask
              ? "It's added to the end of this epic's pipeline."
              : "Add a task and assign it to your team."
        }
      />
      <form onSubmit={onSubmit}>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design the onboarding flow"
              autoFocus
              required
            />
          </div>

          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail, acceptance criteria, links…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-status">Status</Label>
              <Select
                id="t-status"
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
              >
                <option value="">No status</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="t-priority">Priority</Label>
              <Select
                id="t-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="t-team">Product / Team</Label>
              <Select
                id="t-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="t-assignee">Assignee</Label>
              <Select
                id="t-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="t-folder">Folder</Label>
              <Select
                id="t-folder"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">No folder</option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {`${"— ".repeat(f.depth)}${f.name}`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Watchers</Label>
              <PeopleSelect
                people={profiles}
                value={watchers}
                onChange={setWatchers}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : isSubtask ? "Add subtask" : "Create task"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
