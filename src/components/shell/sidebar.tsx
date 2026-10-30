"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { endMockSession } from "@/lib/auth/session-cookie";
import { usePortalData } from "@/lib/data/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { useToast } from "../ui/toast";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/expenses", label: "Expenses" },
  { href: "/goals", label: "Goals" },
  { href: "/jobs", label: "Job agent" },
  { href: "/journal", label: "Journal" },
  { href: "/digest", label: "Weekly digest" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const data = usePortalData();
  const toast = useToast();
  const rail = useRef<HTMLDivElement>(null);

  // On phones the nav is a sideways-scrolling row: bring the current page's tab into view.
  useEffect(() => {
    const el = rail.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active) return;
    const r = el.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    el.scrollLeft += a.left - r.left - (r.width - a.width) / 2;
  }, [pathname]);

  const logOut = async () => {
    if (supabaseConfigured) await supabaseBrowser().auth.signOut();
    else endMockSession();
    // A full load on purpose: it drops everything cached in memory for this user.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  };

  return (
    <nav
      aria-label="Portal tools"
      className="flex flex-col gap-1 border-b border-line bg-surface px-4 py-4 min-[780px]:sticky min-[780px]:top-0 min-[780px]:h-dvh min-[780px]:w-[220px] min-[780px]:overflow-y-auto min-[780px]:shrink-0 min-[780px]:border-r min-[780px]:border-b-0 min-[780px]:py-6"
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-2 min-[780px]:pb-5">
        <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
          <LogoMark />
          <span className="font-display text-lg font-bold">The Portal</span>
        </Link>
        <div className="flex items-center gap-1 min-[780px]:hidden">
          <ThemeToggle showLabel={false} />
          <button type="button" onClick={logOut} className="min-h-11 cursor-pointer whitespace-nowrap px-2 text-[13px] text-muted underline hover:text-ink">
            Log out
          </button>
        </div>
      </div>

      <div ref={rail} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] min-[780px]:mx-0 min-[780px]:flex-col min-[780px]:overflow-visible min-[780px]:px-0 min-[780px]:pb-0">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[10px] px-3 text-sm no-underline",
                active ? "bg-ink font-semibold text-on-ink hover:text-on-ink" : "font-medium text-ink-soft hover:bg-subtle hover:text-ink",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => toast("New tools plug in later — each gets its own tables, page and digest reader.")}
          className="flex min-h-11 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-[10px] border border-dashed border-line-strong px-3 text-sm font-medium text-muted hover:text-ink min-[780px]:mt-2"
        >
          + Add a tool
        </button>
      </div>

      <div className="hidden grow min-[780px]:block" />
      <div className="hidden pb-1 min-[780px]:block">
        <ThemeToggle />
      </div>
      <div className="hidden items-center justify-between gap-2 border-t border-line px-2 pt-3 min-[780px]:flex">
        <span className="truncate text-sm font-semibold">{data?.profile.name ?? " "}</span>
        <button type="button" onClick={logOut} className="min-h-11 cursor-pointer text-[13px] text-muted underline hover:text-ink">
          Log out
        </button>
      </div>
    </nav>
  );
}
