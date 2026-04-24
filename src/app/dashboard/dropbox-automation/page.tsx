"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderSync,
  Key,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plug,
  Unplug,
} from "lucide-react";

type Status = {
  connected: boolean;
  isActive?: boolean;
  watchFolder?: string;
  outputBehavior?: "processed_subfolder" | "outbox_folder";
  outputFolder?: string;
  hasCursor?: boolean;
  accountId?: string | null;
  lastSyncedAt?: string | null;
  totalPhotosIngested?: number;
  totalPropertiesPushedBack?: number;
};

export default function DropboxAutomationPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [watchFolder, setWatchFolder] = useState("/AutoQC Inbox");
  const [outputBehavior, setOutputBehavior] = useState<
    "processed_subfolder" | "outbox_folder"
  >("processed_subfolder");
  const [outputFolder, setOutputFolder] = useState("/AutoQC Outbox");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/integrations/dropbox-autohdr");
    if (r.ok) {
      const d = await r.json();
      setStatus(d);
      if (d.watchFolder) setWatchFolder(d.watchFolder);
      if (d.outputBehavior) setOutputBehavior(d.outputBehavior);
      if (d.outputFolder) setOutputFolder(d.outputFolder);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const connect = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/integrations/dropbox-autohdr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          watchFolder,
          outputBehavior,
          outputFolder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      setSuccess(
        data.warning ??
          "Connected. AutoQC is now watching your Dropbox folder."
      );
      setAccessToken("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/integrations/dropbox-autohdr/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sync failed");
      const { ingest, push } = data;
      setSuccess(
        `Pulled ${ingest.ingested} photo${ingest.ingested === 1 ? "" : "s"} across ${ingest.properties} new propert${ingest.properties === 1 ? "y" : "ies"}. Pushed back ${push.propertiesPushed} finished propert${push.propertiesPushed === 1 ? "y" : "ies"}.`
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Dropbox automation? New drops will stop being picked up.")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/dropbox-autohdr", { method: "DELETE" });
      await load();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
            <FolderSync className="w-4 h-4 text-blue-300" />
          </div>
          <h1 className="text-2xl font-bold">Dropbox Automation</h1>
          <span className="text-[10px] font-mono uppercase tracking-wider text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
            AutoHDR
          </span>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Hands-off pipeline. Your AutoHDR software pushes finished JPEGs
          into a Dropbox folder; AutoQC pulls them, runs the full
          14-check QC + auto-fixes, and puts the results back in Dropbox
          for your editor or agent to grab.
        </p>
      </div>

      {/* Status panel */}
      {status?.connected && status.isActive && (
        <div className="panel p-5 rounded-2xl border border-green-500/30 bg-green-500/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <div>
                <div className="text-sm font-semibold">Connected</div>
                <div className="text-[11px] text-muted-foreground">
                  Watching {status.watchFolder}
                  {status.accountId && ` · account ${status.accountId.slice(0, 14)}...`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={syncNow}
                disabled={syncing}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Sync now
                  </>
                )}
              </button>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 hover:bg-red-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Unplug className="w-3 h-3" />
                Disconnect
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/5">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Photos ingested
              </div>
              <div className="text-lg font-semibold stat-num mt-0.5">
                {status.totalPhotosIngested ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Pushed back
              </div>
              <div className="text-lg font-semibold stat-num mt-0.5">
                {status.totalPropertiesPushedBack ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Last synced
              </div>
              <div className="text-[12px] mt-1">
                {status.lastSyncedAt
                  ? new Date(status.lastSyncedAt).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup form */}
      <div className="panel p-6 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-1">
          {status?.connected && status.isActive ? "Update settings" : "Connect your Dropbox"}
        </h2>
        <p className="text-[12px] text-muted-foreground mb-5">
          You need a Dropbox access token from your Dropbox app console.
          See the setup notes below if you have not created one yet.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground flex items-center gap-1.5">
              <Key className="w-3 h-3" />
              Dropbox access token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={status?.connected ? "Paste a new token to rotate" : "sl.BpxxxxxxxXXXXXXX..."}
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              Watch folder in Dropbox
            </label>
            <input
              type="text"
              value={watchFolder}
              onChange={(e) => setWatchFolder(e.target.value)}
              placeholder="/AutoQC Inbox"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Put a subfolder here for each property (e.g. /AutoQC Inbox/123 Main St/). AutoQC treats each subfolder as one property.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              Where do processed files go?
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm cursor-pointer p-3 rounded-lg border border-white/10 hover:bg-white/[0.02]">
                <input
                  type="radio"
                  checked={outputBehavior === "processed_subfolder"}
                  onChange={() => setOutputBehavior("processed_subfolder")}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium">Alongside originals in /Processed</div>
                  <div className="text-[11px] text-muted-foreground">
                    Example: /AutoQC Inbox/123 Main St/Processed/image.jpg
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer p-3 rounded-lg border border-white/10 hover:bg-white/[0.02]">
                <input
                  type="radio"
                  checked={outputBehavior === "outbox_folder"}
                  onChange={() => setOutputBehavior("outbox_folder")}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium">Into a separate outbox folder</div>
                  <div className="text-[11px] text-muted-foreground">
                    Example: /AutoQC Outbox/123 Main St/image.jpg
                  </div>
                </div>
              </label>
            </div>
          </div>

          {outputBehavior === "outbox_folder" && (
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">
                Outbox folder path
              </label>
              <input
                type="text"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
                placeholder="/AutoQC Outbox"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              {error}
            </div>
          )}
          {success && (
            <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
              {success}
            </div>
          )}

          <button
            onClick={connect}
            disabled={saving || !accessToken || !watchFolder}
            className="px-4 py-2 rounded-lg gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5" />
                {status?.connected && status.isActive ? "Update" : "Connect"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Setup notes */}
      <div className="panel p-6 rounded-2xl border border-white/5">
        <h2 className="text-sm font-semibold mb-3">How to get a Dropbox access token</h2>
        <ol className="text-[13px] text-muted-foreground space-y-3 list-decimal list-inside">
          <li>
            Open the{" "}
            <Link
              href="https://www.dropbox.com/developers/apps"
              target="_blank"
              className="text-foreground underline"
            >
              Dropbox App Console
            </Link>{" "}
            in a new tab.
          </li>
          <li>
            Click <strong>Create app</strong>. Pick <strong>Scoped access</strong>, <strong>Full Dropbox</strong>, name it something like "AutoQC AutoHDR Link."
          </li>
          <li>
            On the app page, open the <strong>Permissions</strong> tab and enable:
            <code className="block bg-white/5 border border-white/10 rounded px-2 py-1 mt-1 text-[11px] font-mono">
              files.content.read · files.content.write · files.metadata.read · files.metadata.write · account_info.read
            </code>
          </li>
          <li>
            Back on the <strong>Settings</strong> tab, scroll to <strong>OAuth 2</strong> and generate an <strong>access token</strong>. Paste it above.
          </li>
          <li>
            Create the folder <code className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] font-mono">/AutoQC Inbox</code> in your Dropbox. Point AutoHDR at subfolders inside it (one per property) and you are done.
          </li>
        </ol>
        <p className="text-[11px] text-muted-foreground mt-4">
          For real-time processing, ask your account manager to wire a webhook into your Dropbox app. Without it, AutoQC falls back to a 30-minute polling cron, which is still hands-off.
        </p>
      </div>
    </div>
  );
}
