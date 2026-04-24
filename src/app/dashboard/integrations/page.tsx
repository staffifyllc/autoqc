"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Key,
  FolderSync,
  Loader2,
  AlertTriangle,
  Unplug,
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

type ConnectedIntegration = {
  id: string;
  platform: string;
  isActive: boolean;
};

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successFor, setSuccessFor] = useState<string | null>(null);

  const loadConnected = async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const d = await res.json();
        setConnected(d.integrations ?? []);
      }
    } catch {
      // ignore; we just won't show connected state
    }
  };

  useEffect(() => {
    loadConnected();
  }, []);

  const isConnected = (platformId: string) =>
    connected.some((i) => i.platform === platformId && i.isActive);

  const handleConnect = async (platformId: string) => {
    setSaving(true);
    setError(null);
    setSuccessFor(null);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformId,
          credentials,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      setSuccessFor(platformId);
      setConfiguring(null);
      setCredentials({});
      await loadConnected();
    } catch (err: any) {
      setError(err.message ?? "Failed to connect");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    if (!confirm(`Disconnect ${platformId}?`)) return;
    setDisconnecting(platformId);
    setError(null);
    setSuccessFor(null);
    try {
      const res = await fetch(
        `/api/integrations?platform=${platformId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Disconnect failed (${res.status})`);
      }
      await loadConnected();
    } catch (err: any) {
      setError(err.message ?? "Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <motion.div variants={fadeUp} className="mb-8">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your delivery platforms. Push approved photos with one click.
        </p>
      </motion.div>

      {error && (
        <div className="mb-5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
        {platforms.map((platform) => {
          const connectedHere = isConnected(platform.id);
          const justSaved = successFor === platform.id;

          return (
            <div key={platform.id} className="glass-card p-6 space-y-4">
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
                      {connectedHere && (
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
                        {platform.type === "api" ? "Direct API" : "Dropbox Sync"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {platform.description}
              </p>

              {justSaved && (
                <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                  Credentials saved. {platform.name} is connected.
                </div>
              )}

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
                        autoComplete="off"
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConnect(platform.id)}
                      disabled={
                        saving ||
                        !platform.fields
                          .filter((f) => !f.label.includes("optional"))
                          .every((f) => (credentials[f.key] ?? "").trim().length > 0)
                      }
                      className="flex-1 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Connect"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setConfiguring(null);
                        setCredentials({});
                        setError(null);
                      }}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg glass text-sm hover:bg-white/10 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setConfiguring(platform.id);
                      setCredentials({});
                      setError(null);
                      setSuccessFor(null);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                      connectedHere
                        ? "glass hover:bg-white/10"
                        : "gradient-bg text-white hover:opacity-90"
                    }`}
                  >
                    {connectedHere ? "Reconfigure" : "Connect"}
                  </button>
                  {connectedHere && (
                    <button
                      onClick={() => handleDisconnect(platform.id)}
                      disabled={disconnecting === platform.id}
                      className="px-3 py-2.5 rounded-xl text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-200 hover:bg-red-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
                      title="Disconnect"
                    >
                      {disconnecting === platform.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unplug className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
