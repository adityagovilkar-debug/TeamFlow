import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  style,
  color,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  // When a color is provided, render a soft dot + tinted pill.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={
        color
          ? { backgroundColor: `${color}1a`, borderColor: `${color}40`, color, ...style }
          : style
      }
      {...props}
    >
      {color ? (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {children}
    </span>
  );
}
