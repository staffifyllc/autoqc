"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Mail,
  Phone,
  Palette,
  Home,
  ChevronRight,
  X,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ClientsPage() {
  const [clients] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    styleProfileId: "",
    customNotes: "",
    colorTempOverride: null as number | null,
    saturationOverride: null as number | null,
    verticalTolOverride: null as number | null,
  });

  const handleCreate = async () => {
    try {
      await fetch("/api/profiles/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create client:", err);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold">Client Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set per-client preferences that override your agency defaults.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition glow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </motion.div>

      {clients.length === 0 ? (
        <motion.div variants={fadeUp} className="glass-card p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No client profiles yet</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Add clients with specific preferences. Each client inherits your agency
            style profile but can override color, exposure, and tolerance settings.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </button>
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="space-y-3">
          {clients.map((client: any) => (
            <div
              key={client.id}
              className="glass-card-hover p-5 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <span className="text-lg font-bold text-brand-400">
                  {client.clientName.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{client.clientName}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {client.clientEmail && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      {client.clientEmail}
                    </span>
                  )}
                  {client.styleProfile && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Palette className="w-3 h-3" />
                      {client.styleProfile.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {client._count.properties} properties
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative glass-card p-8 w-full max-w-lg max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowCreate(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-xl font-bold mb-1">Add Client</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Client profiles inherit your default style but can override specific settings.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Client Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Smith Realty"
                    value={newClient.clientName}
                    onChange={(e) =>
                      setNewClient({ ...newClient, clientName: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={newClient.clientEmail}
                      onChange={(e) =>
                        setNewClient({
                          ...newClient,
                          clientEmail: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={newClient.clientPhone}
                      onChange={(e) =>
                        setNewClient({
                          ...newClient,
                          clientPhone: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Notes / Preferences
                  </label>
                  <textarea
                    placeholder="e.g. Prefers warm tones, always wants blue skies, strict MLS compliance..."
                    value={newClient.customNotes}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        customNotes: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition resize-none"
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!newClient.clientName.trim()}
                  className="w-full py-3 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  Add Client
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
