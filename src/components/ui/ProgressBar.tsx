import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex justify-between mb-1.5">
          <span className="font-ubuntu text-sm text-ubuntu-text-dark dark:text-ubuntu-text-light">
            {label}
          </span>
          <span className="font-ubuntu-mono text-xs text-gray-500">
            {Math.round(pct)}%
          </span>
        </div>
      )}
      <div className="h-2 bg-gray-200 dark:bg-[#444] rounded-full overflow-hidden">
        <div
          className="h-full bg-ubuntu-orange rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
