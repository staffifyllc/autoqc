"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug,
  CheckCircle2,
  ExternalLink,
  X,
  Key,
  FolderSync,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const platforms = [
  {
    id: "ARYEO",
    name: "Aryeo",
    description:
      "Push photos directly via API. Full REST integration with automatic listing creation.",
    type: "api",
    color: "from-blue-600 to-blue-400",
    fields: [{ key: "apiKey", label: "API Key", type: "password" }],
  },
  {
    id: "HDPHOTOHUB",
    name: "HDPhotoHub",
    description:
      "Push photos via API to your HDPhotoHub media folders and orders.",
    type: "api",
    color: "from-green-600 to-green-400",
    fields: [{ key: "apiKey", label: "API Key", type: "password" }],
  },
  {
    id: "SPIRO",
    name: "Spiro",
    description:
      "Sync via Dropbox. Photos are written to your Spiro-connected Dropbox folders.",
    type: "dropbox",
    color: "from-purple-600 to-purple-400",
    fields: [
      { key: "accessToken", label: "Dropbox Access Token", type: "password" },
      {
        key: "rootFolder",
        label: "Root Folder Path (optional)",
        type: "text",
      },
    ],
  },
  {
    id: "TONOMO",
    name: "Tonomo",
    description:
      "Sync via Dropbox. Photos are written to your Tonomo-connected Dropbox folders.",
    type: "dropbox",
    color: "from-orange-600 to-orange-400",
    fields: [
      { key: "accessToken", label: "Dropbox Access Token", type: "password" },
      {
        key: "rootFolder",
        label: "Root Folder Path (optional)",
        type: "text",
      },
    ],
  },
];

export default function IntegrationsPage() {
  const [connectedPlatforms] = useState<Record<string, boolean>>({});
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const handleConnect = async (platformId: string) => {
    try {
      await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformId,
          credentials,
        }),
      });
      setConfiguring(null);
      setCredentials({});
      // Refresh
    } catch (err) {
      console.error("Failed to connect:", err);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div variants={fadeUp} className="mb-8">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your delivery platforms. Push approved photos with one click.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
        {platforms.map((platform) => {
          const isConnected = connectedPlatforms[platform.id];

          return (
            <div
              key={platform.id}
              className="glass-card p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center`}
                  >
                    <span className="text-white font-bold text-sm">
                      {platform.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{platform.name}</h3>
                      {isConnected && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {platform.type === "api" ? (
                        <Key className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <FolderSync className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {platform.type === "api"
                          ? "Direct API"
                          : "Dropbox Sync"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {platform.description}
              </p>

              {configuring === platform.id ? (
                <div className="space-y-3 pt-2 border-t border-border">
                  {platform.fields.map((field) => (
                    <div key={field.key}>
                      <label className="text-xs font-medium mb-1 block">
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        value={credentials[field.key] || ""}
                        onChange={(e) =>
                          setCredentials({
                            ...credentials,
                            [field.key]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConnect(platform.id)}
                      className="flex-1 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90 transition"
                    >
                      Connect
                    </button>
                    <button
                      onClick={() => {
                        setConfiguring(null);
                        setCredentials({});
                      }}
                      className="px-4 py-2 rounded-lg glass text-sm hover:bg-white/10 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfiguring(platform.id)}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${
                    isConnected
                      ? "glass hover:bg-white/10"
                      : "gradient-bg text-white hover:opacity-90"
                  }`}
                >
                  {isConnected ? "Reconfigure" : "Connect"}
                </button>
              )}
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
