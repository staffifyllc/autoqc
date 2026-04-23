"use client";

import { useRef, useState, ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

// Card with a cursor-following radial spotlight, subtle 3D tilt on
// hover, and glowing accent border on hover-in. Built for the landing
// feature grid. Pure CSS variable updates on mousemove so it is cheap
// even with a dozen of these rendered at once.

type Props = {
  icon: LucideIcon;
  title: string;
  copy: string;
  premium?: boolean;
  isNew?: boolean;
  variants?: any;
};

export function SpotlightCard({
  icon: Icon,
  title,
  copy,
  premium,
  isNew,
  variants,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, tiltX: 0, tiltY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Tilt range ±4deg, normalized to cursor position
    const tiltX = ((y / rect.height) - 0.5) * -4;
    const tiltY = ((x / rect.width) - 0.5) * 4;
    setPos({ x, y, tiltX, tiltY });
  };

  return (
    <motion.div
      ref={ref}
      variants={variants}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPos({ x: 0, y: 0, tiltX: 0, tiltY: 0 });
      }}
      style={{
        transform: `perspective(900px) rotateX(${pos.tiltX}deg) rotateY(${pos.tiltY}deg)`,
        transformStyle: "preserve-3d",
        transition: hovered
          ? "transform 0.1s ease-out, border-color 0.3s"
          : "transform 0.5s cubic-bezier(0.2, 0.9, 0.3, 1), border-color 0.3s",
      }}
      className={`relative overflow-hidden panel p-5 space-y-3 ${
        hovered
          ? "border-[hsl(var(--accent))]/60 shadow-[0_0_30px_-5px_hsl(var(--accent)/0.25)]"
          : "border-border"
      } transition-[box-shadow]`}
    >
      {/* Cursor-following spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, hsl(var(--accent) / 0.12), transparent 60%)`,
        }}
      />

      {/* Content */}
      <div className="relative">
        <div className="flex items-center justify-between">
          <div
            className={`w-9 h-9 rounded-md border flex items-center justify-center transition-all duration-300 ${
              hovered
                ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent)/0.08)] scale-110"
                : "border-border bg-[hsl(var(--surface-1))]"
            }`}
          >
            <Icon
              className={`w-4 h-4 transition-colors duration-300 ${
                hovered ? "text-[hsl(var(--accent))]" : "text-primary"
              }`}
              strokeWidth={2}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {isNew && (
              <span className="shimmer-badge text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/40 rounded-full px-2 py-0.5">
                New
              </span>
            )}
            {premium && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-yellow-300/80 border border-yellow-300/30 rounded-full px-2 py-0.5">
                ★ Premium
              </span>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-medium text-sm">{title}</h3>
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
            {copy}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
