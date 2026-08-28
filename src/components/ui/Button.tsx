import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "font-ubuntu font-medium rounded-gnome-sm transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-ubuntu-orange/50",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-2.5 text-base",
        variant === "primary" &&
          "bg-ubuntu-orange text-white hover:bg-ubuntu-orange-dark active:brightness-90",
        variant === "secondary" &&
          "bg-gray-200 dark:bg-[#4a4a4a] text-ubuntu-text-dark dark:text-ubuntu-text-light hover:bg-gray-300 dark:hover:bg-[#555]",
        variant === "ghost" &&
          "bg-transparent text-ubuntu-text-dark dark:text-ubuntu-text-light hover:bg-black/5 dark:hover:bg-white/10",
        variant === "danger" &&
          "bg-ubuntu-close text-white hover:brightness-90",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
