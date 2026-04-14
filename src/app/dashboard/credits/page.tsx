"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  Zap,
  CreditCard,
  TrendingUp,
  Check,
  Loader2,
  Receipt,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  savingsPct: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  priceCents: number | null;
  description: string | null;
  createdAt: string;
}

export default function CreditsPage() {
  const [balance, setBalance] = useState(0);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    // Check for success/cancel params from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      toast.success("Credits added to your account");
      window.history.replaceState({}, "", "/dashboard/credits");
    }
    if (params.get("canceled")) {
      toast.info("Purchase canceled");
      window.history.replaceState({}, "", "/dashboard/credits");
    }
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/credits");
      const data = await res.json();
      setBalance(data.balance);
      setHasPaymentMethod(data.hasPaymentMethod);
      setPackages(data.packages);
      setTransactions(data.transactions);
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    }
  };

  const handlePurchase = async (packageId: string) => {
    setPurchasing(packageId);
    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Purchase failed");
        setPurchasing(null);
      }
    } catch (err) {
      toast.error("Purchase failed");
      setPurchasing(null);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div variants={fadeUp} className="mb-8">
        <h1 className="text-2xl font-bold">Credits</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Buy credits upfront for the best rate, or use pay-as-you-go for flexibility.
        </p>
      </motion.div>

      {/* Balance card */}
      <motion.div
        variants={fadeUp}
        className="glass-card p-8 mb-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Current Balance
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold gradient-text">
                {balance}
              </span>
              <span className="text-muted-foreground">
                credit{balance !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {balance > 0
                ? `Process up to ${balance} propert${balance === 1 ? "y" : "ies"}`
                : hasPaymentMethod
                ? "Running on pay-as-you-go at $12/property"
                : "Buy credits or add a payment method to start processing"}
            </p>
          </div>
          <div className="w-20 h-20 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <Coins className="w-10 h-10 text-brand-400" />
          </div>
        </div>
      </motion.div>

      {/* Pricing explainer */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-2 py-1 rounded-bl-lg bg-green-500/20 text-green-400 text-xs font-bold">
            BEST VALUE
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Coins className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="font-semibold">Credits</p>
            <p className="text-xs text-muted-foreground">
              Buy upfront, save up to 20%
            </p>
            <p className="text-sm font-bold mt-1">
              $10/property
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                or less
              </span>
            </p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold">Pay As You Go</p>
            <p className="text-xs text-muted-foreground">
              Card charged per property
            </p>
            <p className="text-sm font-bold mt-1">$12/property</p>
          </div>
        </div>
      </motion.div>

      {/* Credit packages */}
      <motion.div variants={fadeUp} className="mb-8">
        <h2 className="font-semibold mb-4">Buy Credits</h2>
        <div className="grid grid-cols-4 gap-4">
          {packages.map((pkg) => {
            const perCredit = pkg.priceCents / pkg.credits / 100;
            return (
              <div
                key={pkg.id}
                className="glass-card p-5 space-y-4 relative"
              >
                {pkg.savingsPct > 0 && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full gradient-bg text-white text-xs font-bold">
                    Save {pkg.savingsPct}%
                  </div>
                )}
                <div>
                  <p className="font-semibold">{pkg.name}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold">{pkg.credits}</span>
                    <span className="text-xs text-muted-foreground">
                      credits
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    ${(pkg.priceCents / 100).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${perCredit.toFixed(2)} per credit
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-green-400" />
                    Process {pkg.credits} properties
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-green-400" />
                    Never expires
                  </li>
                  {pkg.savingsPct > 0 && (
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-green-400" />
                      Save ${((1200 - perCredit * 100) * pkg.credits / 100).toFixed(0)} vs PAYG
                    </li>
                  )}
                </ul>

                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing === pkg.id}
                  className="w-full py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {purchasing === pkg.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Buy Now
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* PAYG option */}
      {!hasPaymentMethod && (
        <motion.div
          variants={fadeUp}
          className="glass-card p-6 mb-8 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              Or add a card for pay-as-you-go
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Charged $12 per property processed. Higher rate but no upfront commitment.
            </p>
          </div>
          <button className="px-4 py-2 rounded-xl glass hover:bg-white/10 text-sm font-medium transition">
            Add Card
          </button>
        </motion.div>
      )}

      {/* Transaction history */}
      <motion.div variants={fadeUp} className="glass-card p-6">
        <h2 className="font-semibold mb-4">Transaction History</h2>

        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No transactions yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/3"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    tx.type === "PURCHASE"
                      ? "bg-green-500/10 text-green-400"
                      : tx.type === "USAGE"
                      ? "bg-blue-500/10 text-blue-400"
                      : tx.type === "REFUND"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-purple-500/10 text-purple-400"
                  }`}
                >
                  {tx.type === "PURCHASE" ? (
                    <Coins className="w-4 h-4" />
                  ) : tx.type === "USAGE" ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Receipt className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {tx.type === "PURCHASE"
                      ? `Purchased ${tx.amount} credits`
                      : tx.type === "USAGE"
                      ? tx.description || "Property processed"
                      : tx.type === "REFUND"
                      ? `Refund: ${Math.abs(tx.amount)} credits`
                      : tx.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      tx.amount > 0 ? "text-green-400" : "text-foreground"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount}
                  </p>
                  {tx.priceCents && (
                    <p className="text-xs text-muted-foreground">
                      ${(tx.priceCents / 100).toFixed(0)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
