import { cn } from "@/lib/utils";

type DualToneProgressProps = {
  value: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
};

/** Purple fill on a teal track — matches student dashboard mocks. */
export function DualToneProgress({
  value,
  className,
  trackClassName,
  fillClassName,
}: DualToneProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-teal-400/35",
        trackClassName,
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-violet-500 transition-[width] duration-300 ease-out",
          fillClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
