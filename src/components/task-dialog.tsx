"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  RECURRENCE_OPTIONS,
  buildFolderTree,
  flattenFolderTree,
  type Folder,
  type Label as LabelType,
  type Priority,
  type Profile,
  type Recurrence,
  type Status,
  type TaskTemplate,
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
  labels = [],
  templates = [],
  task,
  defaultStatusId,
  defaultFolderId,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  statuses: Status[];
  teams: (Team & { members?: Profile[] })[];
  profiles: Profile[];
  folders?: Folder[];
  labels?: LabelType[];
  templates?: TaskTemplate[];
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
  const [estimateHours, setEstimateHours] = React.useState<string>("");
  const [recurrence, setRecurrence] = React.useState<Recurrence>("none");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  const [templateId, setTemplateId] = React.useState<string>("");
  const [watchers, setWatchers] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const folderOptions = React.useMemo(
    () => flattenFolderTree(buildFolderTree(folders)),
    [folders],
  );

  // A private team's tasks can only be made the responsibility of a team member.
  const selectedTeam = teams.find((t) => t.id === teamId);
  const responsibleOptions = React.useMemo(() => {
    if (selectedTeam?.is_private && selectedTeam.members?.length) {
      const ids = new Set(selectedTeam.members.map((m) => m.id));
      return profiles.filter((p) => ids.has(p.id));
    }
    return profiles;
  }, [selectedTeam, profiles]);

  // If the team changes to a private one, drop a responsible who isn't a member.
  React.useEffect(() => {
    if (
      selectedTeam?.is_private &&
      assigneeId &&
      !selectedTeam.members?.some((m) => m.id === assigneeId)
    ) {
      setAssigneeId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

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
      setEstimateHours(
        task.estimate_minutes != null ? String(task.estimate_minutes / 60) : "",
      );
      setRecurrence(task.recurrence ?? "none");
      setIsPrivate(task.is_private);
      setLabelIds(task.labels.map((l) => l.id));
      setTemplateId("");
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
      setEstimateHours("");
      setRecurrence("none");
      setIsPrivate(false);
      setLabelIds([]);
      setTemplateId("");
      setWatchers([]);
    }
  }, [open, task, defaultStatusId, defaultFolderId, statuses]);

  // Applying a template prefills the fields (only when creating).
  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description ?? "");
    setPriority(t.priority);
    setTeamId(t.team_id ?? "");
    setEstimateHours(
      t.estimate_minutes != null ? String(t.estimate_minutes / 60) : "",
    );
  }

  function toggleLabel(id: string) {
    setLabelIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

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
      estimate_minutes: estimateHours
        ? Math.round(parseFloat(estimateHours) * 60)
        : null,
      recurrence,
      is_private: isPrivate,
      labels: labelIds,
      watchers,
      parent_id: parentId ?? null,
      template_id: !editing && templateId ? templateId : null,
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
          {!editing && !isSubtask && templates.length > 0 && (
            <div>
              <Label htmlFor="t-template">Start from template</Label>
              <Select
                id="t-template"
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">Blank task</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

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
                <option value="">None</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.is_private ? "🔒 " : ""}
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="t-assignee">Responsible</Label>
              <Select
                id="t-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">No one</option>
                {responsibleOptions.map((p) => (
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
              <Label htmlFor="t-estimate">Estimate (hours)</Label>
              <Input
                id="t-estimate"
                type="number"
                min="0"
                step="0.25"
                value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
            <div>
              <Label htmlFor="t-recurrence">Repeat</Label>
              <Select
                id="t-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                disabled={isSubtask}
              >
                {RECURRENCE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
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

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Lock className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Private task</p>
                <p className="text-xs text-muted-foreground">
                  {isSubtask
                    ? "Subtasks of a private epic are private automatically."
                    : "Only you, the person responsible, watchers, and the super-admin can see this."}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPrivate}
              onClick={() => setIsPrivate((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer",
                isPrivate ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
                  isPrivate ? "translate-x-[22px]" : "translate-x-[2px]",
                )}
              />
            </button>
          </div>

          {labels.length > 0 && (
            <div>
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const on = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                        on
                          ? "border-transparent text-white"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                      style={on ? { backgroundColor: l.color } : undefined}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: l.color }}
                      />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
