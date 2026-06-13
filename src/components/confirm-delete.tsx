"use client";

import * as React from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const [busy, setBusy] = React.useState(false);

  async function handle() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <div className="flex gap-4 p-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handle} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
