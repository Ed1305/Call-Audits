import { TopBar } from "./TopBar";
import { UbuntuDock } from "./UbuntuDock";
import { ToastContainer } from "@/components/ui/Toast";

export function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ubuntu-window-light dark:bg-ubuntu-window-dark transition-colors duration-300">
      <TopBar />
      <UbuntuDock />
      <main className="ml-[68px] pt-10 min-h-screen">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
      <ToastContainer />
    </div>
  );
}
