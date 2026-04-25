"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, X, MessageCircle } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

const STORAGE_KEY = "autoqc_support_open";

export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Restore open state across page navigations within the same session.
  useEffect(() => {
    try {
      const o = sessionStorage.getItem(STORAGE_KEY);
      if (o === "1") setOpen(true);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {}
  }, [open, hydrated]);

  // Load history on first open.
  useEffect(() => {
    if (!open || messages.length > 0 || conversationId) return;
    fetch("/api/support/chat")
      .then((r) => r.json())
      .then((d) => {
        if (d?.conversationId) {
          setConversationId(d.conversationId);
          setMessages(d.messages ?? []);
        } else if ((d?.messages ?? []).length === 0) {
          // No prior conversation. Seed a friendly opener from "Nova"
          // so the user doesn't stare at an empty box.
          setMessages([
            {
              role: "assistant",
              content:
                "hey, nova here. i'm on the autoqc support team. ask me anything about the product, pricing, or how to set something up. i'm fast.",
            },
          ]);
        }
      })
      .catch(() => {});
  }, [open]);

  // Auto-scroll to newest message whenever the list changes.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const r = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId ?? undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "send failed");
      setConversationId(d.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: d.reply },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "something on my end glitched. try again in a sec, or email hello@autoqc.io if it keeps happening.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg shadow-black/40 border-2 border-amber-500/40 bg-[#1a1a1a] hover:scale-105 transition-transform overflow-hidden flex items-center justify-center"
          aria-label="Chat with Nova"
          title="Chat with Nova"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nova.jpg"
            alt="Nova"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback: if /nova.jpg isn't deployed yet, hide the
              // broken image and show a chat bubble icon instead.
              (e.target as HTMLImageElement).style.display = "none";
              (e.currentTarget.parentElement as HTMLElement).innerHTML +=
                '<div style="color:#fbbf24"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>';
            }}
          />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1a1a1a]" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-24px)] h-[540px] max-h-[calc(100vh-40px)] rounded-2xl bg-[#0d1117] border border-white/10 shadow-2xl shadow-black/60 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-amber-500/8 to-transparent">
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-[#1a1a1a] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/nova.jpg"
                  alt="Nova"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d1117]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">Nova</div>
              <div className="text-[11px] text-emerald-300 leading-tight">
                Online · usually replies in seconds
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-amber-500/20 text-amber-100 border border-amber-500/30 rounded-br-sm"
                      : "bg-white/[0.04] text-foreground border border-white/5 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/5 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  typing...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={send}
            className="border-t border-white/5 p-3 flex items-center gap-2 bg-black/20"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="p-2 rounded-lg gradient-bg text-white hover:opacity-90 transition disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
