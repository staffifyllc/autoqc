"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Home,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  ArrowUpRight,
  Plus,
  TrendingUp,
  Coins,
} from "lucide-react";
import { useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function DashboardPage() {
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((data) => setCredits(data.balance))
      .catch(() => {});
  }, []);

  const stats = [
    {
      label: "Credits",
      value: String(credits),
      change: null,
      icon: Coins,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
    },
    {
      label: "Properties This Month",
      value: "0",
      change: null,
      icon: Home,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Auto-Fixed",
      value: "0",
      change: null,
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Flagged for Review",
      value: "0",
      change: null,
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
    },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger}>
      {/* Header */}
      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back. Here&apos;s your QC overview.
          </p>
        </div>
        <Link
          href="/dashboard/properties?new=true"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-4 h-4" />
          New Property
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div
                className={`w-10 h-10 rounded-xl ${stat.bg} border flex items-center justify-center`}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              {stat.change && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <TrendingUp className="w-3 h-3" />
                  {stat.change}
                </span>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Recent Properties + Quick Actions */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent */}
        <motion.div variants={fadeUp} className="col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Properties</h2>
            <Link
              href="/dashboard/properties"
              className="text-xs text-brand-400 hover:text-brand-300 transition flex items-center gap-1"
            >
              View All
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-muted-foreground">
              No properties yet
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-xs">
              Upload your first property to see QC results here.
            </p>
            <Link
              href="/dashboard/properties?new=true"
              className="mt-4 text-sm text-brand-400 hover:text-brand-300 transition flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Property
            </Link>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={fadeUp} className="glass-card p-6 space-y-4">
          <h2 className="font-semibold">Quick Actions</h2>

          <div className="space-y-2">
            {[
              {
                label: "Upload Property",
                href: "/dashboard/properties?new=true",
                icon: Plus,
                desc: "Start a new QC run",
              },
              {
                label: "Create Style Profile",
                href: "/dashboard/profiles?new=true",
                icon: "palette",
                desc: "Define your photo standard",
              },
              {
                label: "Connect Platform",
                href: "/dashboard/integrations",
                icon: "plug",
                desc: "Set up delivery push",
              },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-white/20 transition">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* QC Score gauge placeholder */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              Average QC Score
            </p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold gradient-text">--</span>
              <span className="text-sm text-muted-foreground pb-1">/ 100</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full w-0 rounded-full gradient-bg transition-all duration-1000" />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
