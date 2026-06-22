"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Boxes,
  Tags,
  Tag,
  LayoutTemplate,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MoreHorizontal,
  KeyRound,
  TriangleAlert,
  Copy,
  Check,
  RefreshCw,
  Crown,
  UserPlus,
  UserCheck,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Popover, MenuItem } from "@/components/ui/popover";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  createLabel,
  createMember,
  grantAccess,
  createStatus,
  createTeam,
  createTemplate,
  deleteLabel,
  deleteStatus,
  deleteTeam,
  deleteTemplate,
  deleteUser,
  setSuperadmin,
  setUserColor,
  setUserPassword,
  setUserRole,
  updateLabel,
  updateStatus,
  updateTeam,
} from "@/lib/actions";
import { useRealtime } from "@/lib/use-realtime";
import { cn, AVATAR_PALETTE, userColor } from "@/lib/utils";
import {
  PRIORITIES,
  ROLE_LABELS,
  type Label as LabelType,
  type Priority,
  type Profile,
  type Role,
  type Status,
  type StatusCategory,
  type TaskTemplate,
  type Team,
} from "@/lib/types";

type Tab = "members" | "teams" | "statuses" | "labels" | "templates";

const SWATCHES = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b",
];

export function AdminView({
  me,
  profiles,
  teams,
  statuses,
  labels,
  templates,
  userMgmtEnabled,
}: {
  me: Profile;
  profiles: Profile[];
  teams: Team[];
  statuses: Status[];
  labels: LabelType[];
  templates: TaskTemplate[];
  userMgmtEnabled: boolean;
}) {
  useRealtime(["profiles", "teams", "statuses", "labels", "task_templates"]);
  const [tab, setTab] = React.useState<Tab>("members");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "members", label: "Members", icon: Users },
    { id: "teams", label: "Teams / Products", icon: Boxes },
    { id: "statuses", label: "Statuses", icon: Tags },
    { id: "labels", label: "Labels", icon: Tag },
    { id: "templates", label: "Templates", icon: LayoutTemplate },
  ];

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Manage members, roles, teams, and workflow statuses."
      />

      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
              tab === t.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <Members
          me={me}
          profiles={profiles}
          userMgmtEnabled={userMgmtEnabled}
        />
      )}
      {tab === "teams" && <Teams teams={teams} />}
      {tab === "statuses" && <Statuses statuses={statuses} />}
      {tab === "labels" && <Labels labels={labels} />}
      {tab === "templates" && <Templates templates={templates} teams={teams} />}
    </div>
  );
}

/* ---------------- Labels ---------------- */
function Labels({ labels }: { labels: LabelType[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<LabelType | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<LabelType | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New label
        </Button>
      </div>
      <Card className="divide-y divide-border">
        {labels.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No labels yet.</p>
        )}
        {labels.map((l) => (
          <div key={l.id} className="flex items-center gap-3 p-4">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
            <span className="flex-1" />
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(l)}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(l)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      <LabelDialog
        open={creating || Boolean(editing)}
        label={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <ConfirmDelete
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete label"
        description={`Delete "${deleting?.name}"? It's removed from any tasks using it.`}
        onConfirm={async () => {
          if (deleting) await deleteLabel(deleting.id);
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function LabelDialog({
  open,
  label,
  onClose,
}: {
  open: boolean;
  label: LabelType | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(SWATCHES[0]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(label?.name ?? "");
    setColor(label?.color ?? SWATCHES[0]);
  }, [open, label]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input = { name: name.trim(), color };
    if (label) await updateLabel(label.id, input);
    else await createLabel(input);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={label ? "Edit label" : "New label"} />
      <form onSubmit={save}>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="lname">Name</Label>
            <Input
              id="lname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Social, Blog, Urgent-client"
              autoFocus
              required
            />
          </div>
          <ColorPicker value={color} onChange={setColor} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/* ---------------- Templates ---------------- */
function Templates({
  templates,
  teams,
}: {
  templates: TaskTemplate[];
  teams: Team[];
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TaskTemplate | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New template
        </Button>
      </div>
      <Card className="divide-y divide-border">
        {templates.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No templates yet. Create one to spin up common tasks (e.g. a monthly
            client report) in one click.
          </p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-4">
            <LayoutTemplate className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {t.title}
                {t.items && t.items.length > 0
                  ? ` · ${t.items.length} checklist item${t.items.length === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(t)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      <TemplateDialog
        open={creating}
        teams={teams}
        onClose={() => setCreating(false)}
      />
      <ConfirmDelete
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete template"
        description={`Delete "${deleting?.name}"? Existing tasks created from it are unaffected.`}
        onConfirm={async () => {
          if (deleting) await deleteTemplate(deleting.id);
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function TemplateDialog({
  open,
  teams,
  onClose,
}: {
  open: boolean;
  teams: Team[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [teamId, setTeamId] = React.useState("");
  const [estimateHours, setEstimateHours] = React.useState("");
  const [itemsText, setItemsText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setTitle("");
    setDescription("");
    setPriority("medium");
    setTeamId("");
    setEstimateHours("");
    setItemsText("");
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await createTemplate({
      name: name.trim(),
      title: title.trim(),
      description: description.trim() || null,
      priority,
      team_id: teamId || null,
      estimate_minutes: estimateHours
        ? Math.round(parseFloat(estimateHours) * 60)
        : null,
      items: itemsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-lg">
      <DialogHeader
        title="New template"
        description="A reusable task. Checklist items: one per line."
      />
      <form onSubmit={save}>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly client report"
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="tpl-title">Task title</Label>
            <Input
              id="tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. {Client} — monthly report"
              required
            />
          </div>
          <div>
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="min-h-16"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="tpl-priority">Priority</Label>
              <Select
                id="tpl-priority"
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
              <Label htmlFor="tpl-team">Team</Label>
              <Select
                id="tpl-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">None</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tpl-est">Estimate (h)</Label>
              <Input
                id="tpl-est"
                type="number"
                min="0"
                step="0.25"
                value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tpl-items">Checklist items (one per line)</Label>
            <Textarea
              id="tpl-items"
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder={"Pull analytics\nDraft summary\nSend for review"}
              className="min-h-24"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || !title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create template
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/* ---------------- Members ---------------- */
function Members({
  me,
  profiles,
  userMgmtEnabled,
}: {
  me: Profile;
  profiles: Profile[];
  userMgmtEnabled: boolean;
}) {
  const router = useRouter();
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState<Profile | null>(null);
  const [deleting, setDeleting] = React.useState<Profile | null>(null);
  const [promoting, setPromoting] = React.useState<Profile | null>(null);
  const [addingMember, setAddingMember] = React.useState(false);
  const [granting, setGranting] = React.useState<Profile | null>(null);

  async function changeRole(id: string, role: Role) {
    setSavingId(id);
    await setUserRole(id, role);
    setSavingId(null);
    router.refresh();
  }

  return (
    <>
      {!userMgmtEnabled && (
        <div className="mb-3 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <TriangleAlert className="size-4 shrink-0 text-warning" />
          <span>
            Deleting users and resetting passwords needs the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            server environment variable (see README). Role changes work without
            it.
          </span>
        </div>
      )}

      {me.is_superadmin && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setAddingMember(true)}>
            <UserPlus className="size-4" />
            Add user
          </Button>
        </div>
      )}

      <Card className="divide-y divide-border">
        {profiles.map((p) => {
          const isSelf = p.id === me.id;
          return (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <Avatar name={p.full_name} email={p.email} color={p.color} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.full_name || p.email}
                  {isSelf && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                  {p.is_superadmin && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      <Crown className="size-3" />
                      Super-admin
                    </span>
                  )}
                  {p.is_placeholder && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 align-middle text-[10px] font-semibold text-muted-foreground">
                      <Ban className="size-3" />
                      No app access
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {p.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {savingId === p.id && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                <MemberColorPicker profile={p} />
                {p.is_placeholder ? (
                  <span className="w-32 text-center text-sm text-muted-foreground">
                    No access
                  </span>
                ) : (
                  <Select
                    value={p.role}
                    disabled={isSelf}
                    onChange={(e) => changeRole(p.id, e.target.value as Role)}
                    className="w-32"
                    title={isSelf ? "You can't change your own role" : undefined}
                  >
                    {(["admin", "user", "contributor", "viewer"] as Role[]).map(
                      (r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ),
                    )}
                  </Select>
                )}
                <Popover
                  align="end"
                  trigger={
                    <button
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
                      aria-label="User actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  }
                >
                  {(close) => (
                    <>
                      {!p.is_placeholder && (
                        <MenuItem
                          onClick={() => {
                            close();
                            setResetting(p);
                          }}
                        >
                          <KeyRound /> Reset password
                        </MenuItem>
                      )}
                      {me.is_superadmin && p.is_placeholder && (
                        <MenuItem
                          onClick={() => {
                            close();
                            setGranting(p);
                          }}
                        >
                          <UserCheck /> Grant access
                        </MenuItem>
                      )}
                      {me.is_superadmin && !p.is_superadmin && !p.is_placeholder && (
                        <MenuItem
                          onClick={() => {
                            close();
                            setPromoting(p);
                          }}
                        >
                          <Crown /> Make super-admin
                        </MenuItem>
                      )}
                      {!isSelf && (
                        <MenuItem
                          destructive
                          onClick={() => {
                            close();
                            setDeleting(p);
                          }}
                        >
                          <Trash2 /> Delete {p.is_placeholder ? "member" : "user"}
                        </MenuItem>
                      )}
                    </>
                  )}
                </Popover>
              </div>
            </div>
          );
        })}
        <p className="p-4 text-xs leading-relaxed text-muted-foreground">
          New sign-ups join as <strong>Viewer</strong> (read-only). Promote to{" "}
          <strong>Contributor</strong> (edit & comment only on tasks assigned to
          them), <strong>User</strong> (create & manage any task), or{" "}
          <strong>Admin</strong> (full access).
        </p>
      </Card>

      <ConfirmDelete
        open={Boolean(promoting)}
        onClose={() => setPromoting(null)}
        title="Make super-admin"
        description={`Transfer super-admin to ${
          promoting?.full_name || promoting?.email
        }? They will be able to see all private tasks, and you will lose that ability. Only one super-admin can exist.`}
        confirmLabel="Make super-admin"
        onConfirm={async () => {
          if (!promoting) return;
          const res = await setSuperadmin(promoting.id);
          setPromoting(null);
          if (res.error) alert(res.error);
          router.refresh();
        }}
      />
      <AddMemberDialog
        open={addingMember}
        onClose={() => setAddingMember(false)}
        configured={userMgmtEnabled}
      />
      <GrantAccessDialog user={granting} onClose={() => setGranting(null)} />
      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
      />
      <ConfirmDelete
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete user"
        description={`Permanently delete ${
          deleting?.full_name || deleting?.email
        }? They lose access immediately. Tasks they created or were assigned to are kept (unassigned).`}
        confirmLabel="Delete user"
        onConfirm={async () => {
          if (!deleting) return;
          const res = await deleteUser(deleting.id);
          setDeleting(null);
          if (res.error) alert(res.error);
          router.refresh();
        }}
      />
    </>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: Profile | null;
  onClose: () => void;
}) {
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setPassword(generatePassword());
      setError(null);
      setDone(false);
      setCopied(false);
    }
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const res = await setUserPassword(user.id, password);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <Dialog open={Boolean(user)} onClose={onClose}>
      <DialogHeader
        title="Reset password"
        description={
          user ? `Set a new password for ${user.full_name || user.email}.` : ""
        }
      />
      {done ? (
        <>
          <DialogBody>
            <div className="rounded-lg border border-success/30 bg-success/10 p-4">
              <p className="text-sm font-medium">Password updated.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Share this new password securely with the user. They can sign in
                with it right away.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-md bg-card border border-border px-3 py-2 font-mono text-sm">
                  {password}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(password);
                    setCopied(true);
                  }}
                  title="Copy"
                >
                  {copied ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={save}>
          <DialogBody className="space-y-3">
            <div>
              <Label htmlFor="newpw">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="newpw"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => setPassword(generatePassword())}
                  title="Generate"
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                At least 6 characters. You&apos;ll be able to copy it after saving.
              </p>
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
            <Button type="submit" disabled={saving || password.length < 6}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Set password
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}

function AddMemberDialog({
  open,
  onClose,
  configured,
}: {
  open: boolean;
  onClose: () => void;
  configured: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setError(null);
    }
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    setError(null);
    const res = await createMember({
      fullName: fullName.trim(),
      email: email.trim() || null,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        title="Add user"
        description="Add someone you can assign and track. They can't sign in."
      />
      <form onSubmit={save}>
        <DialogBody className="space-y-4">
          {!configured && (
            <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <TriangleAlert className="size-4 shrink-0 text-warning" />
              <span>
                Adding users needs the{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>{" "}
                server environment variable (see README).
              </span>
            </div>
          )}
          <div>
            <Label htmlFor="m-name">Full name</Label>
            <Input
              id="m-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Priya from accounts"
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="m-email">Email (optional)</Label>
            <Input
              id="m-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Leave blank if they shouldn't be contacted"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              They can be assigned tasks and watched, but cannot sign in. No
              invite or notification email is sent.
            </p>
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
          <Button type="submit" disabled={saving || !fullName.trim() || !configured}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Add user
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function GrantAccessDialog({
  user,
  onClose,
}: {
  user: Profile | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const NO_LOGIN = "@no-login.teamflow.local";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("viewer");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      // Prefill with their real email if they have one (not the synthetic placeholder).
      setEmail(user.email && !user.email.endsWith(NO_LOGIN) ? user.email : "");
      setPassword(generatePassword());
      setRole("viewer");
      setError(null);
      setDone(false);
      setCopied(false);
    }
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const res = await grantAccess({ userId: user.id, email: email.trim(), password, role });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <Dialog open={Boolean(user)} onClose={onClose}>
      <DialogHeader
        title="Grant access"
        description={
          user
            ? `Give ${user.full_name || "this member"} a real login. Their existing task assignments stay attached.`
            : ""
        }
      />
      {done ? (
        <>
          <DialogBody>
            <div className="rounded-lg border border-success/30 bg-success/10 p-4">
              <p className="text-sm font-medium">Access granted.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Share these credentials securely. They can sign in right away and
                keep everything already assigned to them.
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Email:</span> {email}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-border bg-card px-3 py-2 font-mono text-sm">
                    {password}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(password);
                      setCopied(true);
                    }}
                    title="Copy password"
                  >
                    {copied ? (
                      <Check className="size-4 text-success" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              onClick={() => {
                onClose();
                router.refresh();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={save}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="ga-email">Email</Label>
              <Input
                id="ga-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="their.email@company.com"
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A real address they control — they sign in and reset passwords with it.
              </p>
            </div>
            <div>
              <Label htmlFor="ga-role">Role</Label>
              <Select
                id="ga-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {(["viewer", "contributor", "user", "admin"] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ga-pw">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="ga-pw"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => setPassword(generatePassword())}
                  title="Generate"
                >
                  <RefreshCw className="size-4" />
                </Button>
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
            <Button type="submit" disabled={saving || !email.trim() || password.length < 6}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Grant access
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}

function MemberColorPicker({ profile }: { profile: Profile }) {
  const router = useRouter();
  const current = userColor(profile.email, profile.color);

  async function pick(color: string | null, close: () => void) {
    close();
    await setUserColor(profile.id, color);
    router.refresh();
  }

  return (
    <Popover
      align="end"
      trigger={
        <button
          className="rounded-full p-0.5 ring-1 ring-border hover:ring-foreground/30 cursor-pointer"
          title="Set color"
          aria-label="Set color"
        >
          <span
            className="block size-5 rounded-full"
            style={{ backgroundColor: current }}
          />
        </button>
      }
    >
      {(close) => (
        <div className="p-1">
          <div className="grid grid-cols-6 gap-1.5 p-1">
            {AVATAR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pick(c, close)}
                className={cn(
                  "size-6 rounded-full transition-transform hover:scale-110 cursor-pointer",
                  profile.color === c && "ring-2 ring-offset-2 ring-foreground ring-offset-card",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => pick(null, close)}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted cursor-pointer"
          >
            Auto (from name)
          </button>
        </div>
      )}
    </Popover>
  );
}

function generatePassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out;
}

/* ---------------- Teams ---------------- */
function Teams({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Team | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Team | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New team
        </Button>
      </div>
      <Card className="divide-y divide-border">
        {teams.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No teams yet.</p>
        )}
        {teams.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-4">
            <span
              className="size-4 rounded-full"
              style={{ backgroundColor: t.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.name}</p>
              {t.description && (
                <p className="truncate text-sm text-muted-foreground">
                  {t.description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(t)}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleting(t)}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      <TeamDialog
        open={creating || Boolean(editing)}
        team={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <ConfirmDelete
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete team"
        description={`Delete "${deleting?.name}"? Tasks keep their data but lose this team label.`}
        onConfirm={async () => {
          if (deleting) await deleteTeam(deleting.id);
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function TeamDialog({
  open,
  team,
  onClose,
}: {
  open: boolean;
  team: Team | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(SWATCHES[0]);
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(team?.name ?? "");
    setColor(team?.color ?? SWATCHES[0]);
    setDescription(team?.description ?? "");
  }, [open, team]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input = { name: name.trim(), color, description: description.trim() || null };
    if (team) await updateTeam(team.id, input);
    else await createTeam(input);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={team ? "Edit team" : "New team"} />
      <form onSubmit={save}>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="tname">Name</Label>
            <Input
              id="tname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile App"
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="tdesc">Description</Label>
            <Textarea
              id="tdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="min-h-16"
            />
          </div>
          <ColorPicker value={color} onChange={setColor} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/* ---------------- Statuses ---------------- */
const CATEGORY_LABELS: Record<StatusCategory, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

function Statuses({ statuses }: { statuses: Status[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Status | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Status | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New status
        </Button>
      </div>
      <Card className="divide-y divide-border">
        {statuses.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-4">
            <span
              className="size-4 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 font-medium">{s.name}</span>
            <Badge className="bg-muted text-muted-foreground border-border">
              {CATEGORY_LABELS[s.category]}
            </Badge>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)}>
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleting(s)}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        The <strong>Done</strong> category marks tasks complete (used in
        reporting and completion stats). Tasks in a deleted status become
        “No status”.
      </p>

      <StatusDialog
        open={creating || Boolean(editing)}
        status={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <ConfirmDelete
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete status"
        description={`Delete "${deleting?.name}"? Tasks using it will show as "No status".`}
        onConfirm={async () => {
          if (deleting) await deleteStatus(deleting.id);
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function StatusDialog({
  open,
  status,
  onClose,
}: {
  open: boolean;
  status: Status | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(SWATCHES[0]);
  const [category, setCategory] = React.useState<StatusCategory>("todo");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(status?.name ?? "");
    setColor(status?.color ?? SWATCHES[0]);
    setCategory(status?.category ?? "todo");
  }, [open, status]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input = { name: name.trim(), color, category };
    if (status) await updateStatus(status.id, input);
    else await createStatus(input);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader title={status ? "Edit status" : "New status"} />
      <form onSubmit={save}>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="sname">Name</Label>
            <Input
              id="sname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blocked"
              autoFocus
              required
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as StatusCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as StatusCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <ColorPicker value={color} onChange={setColor} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <Label>Color</Label>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "size-7 rounded-full transition-transform hover:scale-110 cursor-pointer",
              value === c && "ring-2 ring-offset-2 ring-foreground",
            )}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
    </div>
  );
}
