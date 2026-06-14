"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Boxes,
  Tags,
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
  createStatus,
  createTeam,
  deleteStatus,
  deleteTeam,
  deleteUser,
  setUserPassword,
  setUserRole,
  updateStatus,
  updateTeam,
} from "@/lib/actions";
import { useRealtime } from "@/lib/use-realtime";
import { cn } from "@/lib/utils";
import {
  ROLE_LABELS,
  type Profile,
  type Role,
  type Status,
  type StatusCategory,
  type Team,
} from "@/lib/types";

type Tab = "members" | "teams" | "statuses";

const SWATCHES = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b",
];

export function AdminView({
  me,
  profiles,
  teams,
  statuses,
  userMgmtEnabled,
}: {
  me: Profile;
  profiles: Profile[];
  teams: Team[];
  statuses: Status[];
  userMgmtEnabled: boolean;
}) {
  useRealtime(["profiles", "teams", "statuses"]);
  const [tab, setTab] = React.useState<Tab>("members");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "members", label: "Members", icon: Users },
    { id: "teams", label: "Teams / Products", icon: Boxes },
    { id: "statuses", label: "Statuses", icon: Tags },
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
    </div>
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

      <Card className="divide-y divide-border">
        {profiles.map((p) => {
          const isSelf = p.id === me.id;
          return (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <Avatar name={p.full_name} email={p.email} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.full_name || p.email}
                  {isSelf && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
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
                      <MenuItem
                        onClick={() => {
                          close();
                          setResetting(p);
                        }}
                      >
                        <KeyRound /> Reset password
                      </MenuItem>
                      {!isSelf && (
                        <MenuItem
                          destructive
                          onClick={() => {
                            close();
                            setDeleting(p);
                          }}
                        >
                          <Trash2 /> Delete user
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
