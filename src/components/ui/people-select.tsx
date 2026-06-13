"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Multi-select people picker (used for watchers). */
export function PeopleSelect({
  people,
  value,
  onChange,
  placeholder = "Add people…",
}: {
  people: Profile[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const selected = people.filter((p) => value.includes(p.id));

  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );

  return (
    <Popover
      contentClassName="w-64 max-h-64 overflow-y-auto"
      trigger={
        <button
          type="button"
          className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 text-sm shadow-xs cursor-pointer hover:border-ring/50 transition-colors"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground px-1">{placeholder}</span>
          ) : (
            selected.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-1.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(p.id);
                }}
              >
                <Avatar name={p.full_name} email={p.email} size={18} />
                {p.full_name || p.email}
                <X className="size-3 text-muted-foreground" />
              </span>
            ))
          )}
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
      }
    >
      {() => (
        <div>
          {people.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No teammates yet.
            </p>
          )}
          {people.map((p) => {
            const isSelected = value.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted cursor-pointer"
              >
                <Avatar name={p.full_name} email={p.email} size={22} />
                <span className="flex-1 truncate">
                  {p.full_name || p.email}
                </span>
                <Check
                  className={cn(
                    "size-4 text-primary",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
