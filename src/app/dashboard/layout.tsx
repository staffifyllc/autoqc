"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  LayoutDashboard,
  Home,
  Palette,
  Users,
  Plug,
  CreditCard,
  Coins,
  Settings,
  LogOut,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { Bug, ArrowDownUp, Rocket, MessageSquarePlus } from "lucide-react";
import { UploadStatusPanel } from "@/components/upload/UploadStatusPanel";
import { BugReportWidget } from "@/components/dashboard/BugReportWidget";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { updates } from "@/lib/updates";

const UPDATES_HREF = "/dashboard/updates";
const UPDATES_LAST_SEEN_KEY = "autoqc_updates_last_seen_version";

const navSections: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: any }>;
}> = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/properties", label: "Properties", icon: Home },
      { href: UPDATES_HREF, label: "What's New", icon: Rocket },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/dashboard/profiles", label: "Style Profiles", icon: Palette },
      { href: "/dashboard/profiles/clients", label: "Clients", icon: Users },
      { href: "/dashboard/configure/sort-order", label: "Photo Order", icon: ArrowDownUp },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/credits", label: "Credits", icon: Coins },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/account", label: "Password", icon: Settings },
      { href: "/dashboard/account/bugs", label: "My feedback", icon: MessageSquarePlus },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasUnseenUpdates, setHasUnseenUpdates] = useState(false);

  const latestUpdateVersion = updates[0]?.version;

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => setCredits(typeof d.balance === "number" ? d.balance : 0))
      .catch(() => setCredits(0));
    // Ping the admin endpoint. 200 => admin. 403 => not.
    fetch("/api/admin/usage")
      .then((r) => setIsAdmin(r.status === 200))
      .catch(() => setIsAdmin(false));
  }, [pathname]);

  // Unread-updates indicator: compare the latest version in the changelog
  // to whatever this browser has already seen. Clears when the user opens
  // the updates page (which emits "autoqc:updates-seen").
  useEffect(() => {
    const check = () => {
      if (!latestUpdateVersion) return setHasUnseenUpdates(false);
      const seen = localStorage.getItem(UPDATES_LAST_SEEN_KEY);
      setHasUnseenUpdates(seen !== latestUpdateVersion);
    };
    check();
    window.addEventListener("autoqc:updates-seen", check);
    return () => window.removeEventListener("autoqc:updates-seen", check);
  }, [latestUpdateVersion, pathname]);

  const sections = isAdmin
    ? [
        ...navSections,
        {
          label: "Admin",
          items: [
            { href: "/dashboard/admin", label: "Platform usage", icon: ShieldCheck },
            { href: "/dashboard/admin/bugs", label: "Feedback", icon: MessageSquarePlus },
            { href: "/dashboard/admin/announce", label: "Announcements", icon: Mail },
          ],
        },
      ]
    : navSections;

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Faint scanline texture, sits behind everything */}
      <div className="pointer-events-none fixed inset-0 scanlines z-0" />

      {/* Sidebar */}
      <aside className="w-60 surface-chrome border-r border-border flex flex-col fixed h-full z-30">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-7 h-7 rounded-md accent-bg flex items-center justify-center">
            <Camera className="w-3.5 h-3.5" strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-[15px] tracking-tight">
              AutoQC
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              v1
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-4 overflow-y-auto">
          {sections.map((section, idx) => (
            <div key={section.label} className={idx > 0 ? "mt-5" : ""}>
              <p className="px-2.5 mb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-150 ${
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-md bg-[hsl(var(--surface-3))]"
                          transition={{
                            type: "spring",
                            bounce: 0.2,
                            duration: 0.4,
                          }}
                        />
                      )}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-primary" />
                      )}
                      <item.icon
                        className="w-4 h-4 relative z-10"
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                      <span className="relative z-10">{item.label}</span>
                      {item.href === UPDATES_HREF && hasUnseenUpdates && (
                        <span
                          className="relative z-10 ml-auto flex items-center"
                          title="New updates"
                          aria-label="New updates"
                        >
                          <span className="w-2 h-2 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_8px_hsl(var(--accent))] animate-pulse" />
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Credits readout */}
        <div className="px-3 py-3 border-t border-border">
          <Link
            href="/dashboard/credits"
            className="flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-[hsl(var(--surface-3))] transition-colors group"
          >
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">
              <Coins className="w-3.5 h-3.5" />
              Credits
            </div>
            <span className="font-mono text-[13px] stat-num text-foreground">
              {credits === null ? "--" : credits.toLocaleString()}
            </span>
          </Link>
        </div>

        {/* Bottom */}
        <div className="p-2.5 border-t border-border space-y-0.5">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-3))] transition-colors"
          >
            <Settings className="w-4 h-4" strokeWidth={1.75} />
            Settings
          </Link>
          <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-3))] transition-colors">
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-60 relative z-10">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>

      {/* Floating upload status - persists across all dashboard pages */}
      <UploadStatusPanel />

      {/* Floating "report a bug" widget - persists across dashboard */}
      <BugReportWidget />
    </div>
  );
}
