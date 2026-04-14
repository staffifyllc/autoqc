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
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "Properties", icon: Home },
  { href: "/dashboard/profiles", label: "Style Profiles", icon: Palette },
  { href: "/dashboard/profiles/clients", label: "Clients", icon: Users },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/credits", label: "Credits", icon: Coins },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col fixed h-full z-30">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-6 border-b border-border">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">AutoQC</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? "text-foreground bg-white/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-white/10 border border-white/10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <item.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
