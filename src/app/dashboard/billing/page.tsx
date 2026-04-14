"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  CreditCard,
  Coins,
  Receipt,
  TrendingUp,
  Home,
  ArrowRight,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function BillingPage() {
  const [balance, setBalance] = useState(0);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [totalPurchased, setTotalPurchased] = useState(0);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((data) => {
        setBalance(data.balance);
        setHasPaymentMethod(data.hasPaymentMethod);
        setTotalPurchased(data.totalPurchased);
      })
      .catch(console.error);
  }, []);

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div variants={fadeUp} className="mb-8">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your credits, payment methods, and billing history.
        </p>
      </motion.div>

      {/* Payment requirement banner */}
      {balance === 0 && !hasPaymentMethod && (
        <motion.div
          variants={fadeUp}
          className="glass-card p-5 mb-6 flex items-center gap-4 border-amber-500/30 bg-amber-500/5"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-300">
              Payment method required
            </p>
            <p className="text-sm text-amber-400/80 mt-0.5">
              You need credits or a payment method on file before processing
              any properties.
            </p>
          </div>
          <Link
            href="/dashboard/credits"
            className="px-4 py-2.5 rounded-xl gradient-bg text-white font-medium text-sm hover:opacity-90 transition flex items-center gap-2"
          >
            Buy Credits
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {/* Overview cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4 mb-8">
        <Link
          href="/dashboard/credits"
          className="glass-card-hover p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{balance}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Credits Remaining
            </p>
          </div>
        </Link>

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalPurchased}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total Credits Purchased
            </p>
          </div>
        </div>

        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-400" />
            </div>
            {hasPaymentMethod ? (
              <span className="text-xs text-green-400 font-medium">
                Active
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Not set up</span>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold">
              {hasPaymentMethod ? "PAYG" : "None"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Payment Method
            </p>
          </div>
        </div>
      </motion.div>

      {/* How billing works */}
      <motion.div variants={fadeUp} className="glass-card p-6 mb-6">
        <h2 className="font-semibold mb-4">How AutoQC Billing Works</h2>

        <div className="space-y-3">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 text-green-400 text-sm font-bold">
              1
            </div>
            <div>
              <p className="font-medium text-sm">
                Credits (Best rate) - $8-10 per property
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buy credits in bulk upfront. Each credit processes 1 property.
                Credits never expire. Volume discounts up to 20%.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 text-sm font-bold">
              2
            </div>
            <div>
              <p className="font-medium text-sm">
                Pay As You Go - $12 per property
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add a card, we charge $12 per property at processing time. No
                upfront purchase but higher rate.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 text-sm font-bold">
              3
            </div>
            <div>
              <p className="font-medium text-sm">Payment is required upfront</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Before any property is processed, we charge a credit or your
                card. If both fail, processing won't start. Refunds are
                automatic if processing fails.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4 mb-6">
        <Link
          href="/dashboard/credits"
          className="glass-card-hover p-5 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Coins className="w-6 h-6 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Buy Credits</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Save up to 20% vs pay-as-you-go
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>

        <button className="glass-card-hover p-5 flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {hasPaymentMethod ? "Update Payment Method" : "Add Payment Method"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              For pay-as-you-go at $12/property
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </motion.div>

      {/* Invoice history */}
      <motion.div variants={fadeUp} className="glass-card p-6">
        <h3 className="font-semibold mb-4">Invoice History</h3>
        <div className="text-center py-8">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No invoices yet</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
