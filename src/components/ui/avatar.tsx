import { cn, colorFromString, initials } from "@/lib/utils";

export function Avatar({
  name,
  email,
  size = 32,
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const label = name || email || "?";
  const bg = colorFromString(label);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none ring-2 ring-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: Math.max(10, size * 0.4),
      }}
      title={label}
    >
      {initials(name || email)}
    </span>
  );
}
