import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="font-ubuntu text-sm font-medium text-ubuntu-text-dark dark:text-ubuntu-text-light">
          {label}
        </label>
      )}
      <select
        className={cn(
          "font-ubuntu px-3 py-2 rounded-gnome-sm text-sm appearance-none",
          "bg-white dark:bg-[#2a2a2a]",
          "border border-ubuntu-border-light dark:border-ubuntu-border-dark",
          "text-ubuntu-text-dark dark:text-ubuntu-text-light",
          "focus:outline-none focus:border-ubuntu-orange focus:ring-1 focus:ring-ubuntu-orange/30",
          "cursor-pointer",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
