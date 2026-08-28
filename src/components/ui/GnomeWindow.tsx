"use client";

import { cn } from "@/lib/utils";

interface GnomeWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function GnomeWindow({
  title,
  children,
  className,
  actions,
}: GnomeWindowProps) {
  return (
    <div
      className={cn(
        "rounded-gnome overflow-hidden shadow-gnome animate-fade-in",
        "bg-ubuntu-card-light dark:bg-ubuntu-card-dark",
        "border border-ubuntu-border-light dark:border-ubuntu-border-dark",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5",
          "bg-ubuntu-window-light dark:bg-[#3a3a3a]",
          "border-b border-ubuntu-border-light dark:border-ubuntu-border-dark"
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-ubuntu-close hover:brightness-110 cursor-default" />
          <span className="w-3 h-3 rounded-full bg-ubuntu-minimize hover:brightness-110 cursor-default" />
          <span className="w-3 h-3 rounded-full bg-ubuntu-maximize hover:brightness-110 cursor-default" />
        </div>
        <span className="font-ubuntu text-sm font-medium text-ubuntu-text-dark dark:text-ubuntu-text-light flex-1 ml-2">
          {title}
        </span>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
