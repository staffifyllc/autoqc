"use client";

import { useEffect, useState } from "react";
import { User, Building2, Lock, Loader2, CheckCircle2 } from "lucide-react";

type ProfileData = {
  user: { id: string; email: string; name: string | null };
  agency: { id: string; name: string } | null;
};

export default function SettingsPage() {
  const [initial, setInitial] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    fetch("/api/account/profile")
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setInitial(d);
        setName(d.user.name ?? "");
        setEmail(d.user.email);
        setAgencyName(d.agency?.name ?? "");
      })
      .catch(() => setProfileError("Could not load your profile."));
  }, []);

  const profileDirty =
    initial !== null &&
    (name !== (initial.user.name ?? "") ||
      email !== initial.user.email ||
      agencyName !== (initial.agency?.name ?? ""));

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    setProfileLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, agencyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error ?? "Could not save. Try again.");
        setProfileLoading(false);
        return;
      }
      setProfileSaved(true);
      setInitial({
        user: { id: initial?.user.id ?? "", email, name },
        agency: initial?.agency
          ? { id: initial.agency.id, name: agencyName }
          : null,
      });
    } catch {
      setProfileError("Could not save. Try again.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (newPassword.length < 10) {
      setPwError("New password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error ?? "Change failed.");
        setPwLoading(false);
        return;
      }
      setPwSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwError("Change failed. Try again.");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal info, company, and password.
        </p>
      </div>

      <section className="panel p-6 rounded-xl space-y-5">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <h2 className="font-semibold">Profile</h2>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
              Used to sign in. Changing it takes effect right away.
            </p>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 mb-3 pt-3">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Company</span>
            </div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              Company name
            </label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Your agency"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {profileError && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
              {profileError}
            </div>
          )}

          {profileSaved && (
            <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved.
            </div>
          )}

          <button
            type="submit"
            disabled={profileLoading || !profileDirty}
            className="px-4 py-2 rounded-lg gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {profileLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </form>
      </section>

      <section className="panel p-6 rounded-xl space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4" />
          <h2 className="font-semibold">Change password</h2>
        </div>

        <form onSubmit={handlePasswordSave} className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              New password (at least 10 characters)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block text-muted-foreground">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          {pwError && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
              {pwError}
            </div>
          )}

          {pwSaved && (
            <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Password changed. Next sign-in uses the new one.
            </div>
          )}

          <button
            type="submit"
            disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
            className="px-4 py-2 rounded-lg gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {pwLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Change password"
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
