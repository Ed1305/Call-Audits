import { cn } from "@/lib/utils";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className,
  ...props
}: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="font-ubuntu text-sm font-medium text-ubuntu-text-dark dark:text-ubuntu-text-light">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          "font-ubuntu px-3 py-2 rounded-gnome-sm text-sm min-h-[96px]",
          "bg-white dark:bg-[#2a2a2a]",
          "border border-ubuntu-border-light dark:border-ubuntu-border-dark",
          "text-ubuntu-text-dark dark:text-ubuntu-text-light",
          "placeholder:text-gray-400 dark:placeholder:text-gray-500",
          "focus:outline-none focus:border-ubuntu-orange focus:ring-1 focus:ring-ubuntu-orange/30",
          "transition-colors resize-y",
          error && "border-ubuntu-close",
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-xs text-ubuntu-close font-ubuntu">{error}</span>
      )}
    </div>
  );
}
