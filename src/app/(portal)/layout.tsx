import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col min-[780px]:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pt-6 pb-12 sm:px-6 min-[780px]:px-10 min-[780px]:pt-8">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
