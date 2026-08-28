"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Phone,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Call", icon: Upload },
  { href: "/calls", label: "Call History", icon: Phone },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function UbuntuDock() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed left-0 top-10 bottom-0 w-[68px] z-40 flex flex-col items-center py-3 gap-1",
        "bg-ubuntu-sidebar-dark border-r border-black/20"
      )}
    >
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              "group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200",
              isActive
                ? "bg-ubuntu-orange/20"
                : "hover:bg-white/10"
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-ubuntu-orange rounded-r-full" />
            )}
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
                isActive
                  ? "bg-ubuntu-orange text-white shadow-md"
                  : "text-white/70 group-hover:text-white"
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
