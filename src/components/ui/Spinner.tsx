import { cn } from "@/lib/utils";

export function GnomeSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-8 h-8 border-[3px] border-ubuntu-orange/30 border-t-ubuntu-orange rounded-full animate-gnome-spin",
        className
      )}
    />
  );
}

export function GnomeSpinnerLarge() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <GnomeSpinner className="w-12 h-12" />
      <span className="font-ubuntu text-sm text-gray-500 dark:text-gray-400">
        Processing...
      </span>
    </div>
  );
}
