"use client";

import { useEffect, useState } from "react";
import { Volume2, Wifi, Battery, ChevronDown, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export function TopBar() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-10 bg-ubuntu-topbar z-50 flex items-center px-4 select-none">
      <div className="flex items-center gap-4 flex-1">
        <button className="font-ubuntu text-sm text-white/90 hover:text-white hover:bg-white/10 px-3 py-1 rounded transition-colors">
          Activities
        </button>
        <span className="font-ubuntu text-sm font-medium text-white">
          CallAudit AI
        </span>
      </div>

      <div className="flex-1 flex justify-center">
        <span className="font-ubuntu text-sm text-white/80">
          {date} {time}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end">
        <Volume2 className="w-4 h-4 text-white/70" />
        <Wifi className="w-4 h-4 text-white/70" />
        <Battery className="w-4 h-4 text-white/70" />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-ubuntu-orange flex items-center justify-center text-white text-xs font-bold">
              QA
            </div>
            <ChevronDown className="w-3 h-3 text-white/70" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={cn(
                  "absolute right-0 top-full mt-1 w-56 rounded-gnome shadow-gnome-lg z-50 py-1",
                  "bg-ubuntu-card-light dark:bg-[#383838]",
                  "border border-ubuntu-border-light dark:border-ubuntu-border-dark"
                )}
              >
                <div className="px-4 py-3 border-b border-ubuntu-border-light dark:border-ubuntu-border-dark">
                  <p className="font-ubuntu text-sm font-medium text-ubuntu-text-dark dark:text-ubuntu-text-light">
                    QA Admin
                  </p>
                  <p className="font-ubuntu text-xs text-gray-500">
                    Team Leader
                  </p>
                </div>
                <button
                  onClick={() => {
                    toggleTheme();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 font-ubuntu text-sm hover:bg-black/5 dark:hover:bg-white/10 text-ubuntu-text-dark dark:text-ubuntu-text-light"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 font-ubuntu text-sm hover:bg-black/5 dark:hover:bg-white/10 text-ubuntu-text-dark dark:text-ubuntu-text-light">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
