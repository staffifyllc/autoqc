"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  ArrowLeft,
  Ruler,
  Thermometer,
  Sun,
  Aperture,
  Eye,
  Sparkles,
  X,
} from "lucide-react";

interface DemoResult {
  fileName: string;
  qcScore: number;
  status: "passed" | "fixed" | "flagged";
  issues: {
    key: string;
    label: string;
    severity: number;
    detail?: string;
  }[];
  metrics: {
    verticalDev: number;
    colorTemp: number;
    exposure: number;
    sharpness: number;
  };
  fixesApplied?: string[];
}

export default function DemoPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [results, setResults] = useState<DemoResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<number>(0);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 5));
    setResults([]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 5,
    multiple: true,
  });

  const runDemo = async () => {
    setProcessing(true);

    // Simulate QC processing (in production, this would hit a serverless endpoint)
    await new Promise((r) => setTimeout(r, 2000 + files.length * 500));

    // Generate demo results
    const demoResults: DemoResult[] = files.map((file) => {
      const score = 65 + Math.random() * 30;
      const vertDev = Math.random() * 3;
      const colorTemp = 3500 + Math.random() * 3500;

      const issues: DemoResult["issues"] = [];
      if (vertDev > 1.0) {
        issues.push({
          key: "vertical_tilt",
          label: "Vertical Tilt",
          severity: Math.min(vertDev / 3, 1),
          detail: `${vertDev.toFixed(1)} degrees off vertical`,
        });
      }
      if (colorTemp < 4000 || colorTemp > 6000) {
        issues.push({
          key: "color_temp",
          label: "Color Temperature",
          severity: 0.5,
          detail: `Detected ${Math.round(colorTemp)}K`,
        });
      }
      if (Math.random() > 0.7) {
        issues.push({
          key: "soft_focus",
          label: "Soft Focus",
          severity: 0.4,
          detail: "Below sharpness threshold in bottom quadrants",
        });
      }

      return {
        fileName: file.name,
        qcScore: Math.round(score),
        status: issues.length === 0 ? "passed" : issues.some((i) => i.severity > 0.6) ? "flagged" : "fixed",
        issues,
        metrics: {
          verticalDev: parseFloat(vertDev.toFixed(2)),
          colorTemp: Math.round(colorTemp),
          exposure: parseFloat((Math.random() * 2 - 0.5).toFixed(2)),
          sharpness: Math.round(80 + Math.random() * 150),
        },
      };
    });

    setResults(demoResults);
    setProcessing(false);
    setFixed(false);
  };

  const runAutoFix = async () => {
    setFixing(true);
    // Simulate the auto-fix process
    await new Promise((r) => setTimeout(r, 2000));

    // Apply fixes to the results - remove fixable issues and boost scores
    const fixedResults = results.map((result) => {
      const fixableKeys = ["vertical_tilt", "color_temp", "horizon_tilt", "soft_focus"];
      const unfixableIssues = result.issues.filter(
        (i) => !fixableKeys.includes(i.key)
      );
      const fixedIssues = result.issues.filter((i) =>
        fixableKeys.includes(i.key)
      );

      return {
        ...result,
        qcScore: Math.min(
          100,
          result.qcScore + fixedIssues.length * 8
        ),
        status: unfixableIssues.length === 0 ? "fixed" : "flagged",
        issues: unfixableIssues,
        fixesApplied: fixedIssues.map((i) => i.label),
      } as DemoResult & { fixesApplied?: string[] };
    });

    setResults(fixedResults);
    setFixing(false);
    setFixed(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">AutoQC</span>
          </Link>
          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Try AutoQC</h1>
          <p className="text-muted-foreground">
            Upload up to 5 photos and see how our QC engine works. No account
            needed.
          </p>
        </motion.div>

        {results.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Upload area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 mb-6 ${
                isDragActive
                  ? "border-brand-400 bg-brand-500/10"
                  : "border-white/15 hover:border-white/30 hover:bg-white/5"
              }`}
            >
              <input {...getInputProps()} />
              <Upload
                className={`w-10 h-10 mx-auto mb-3 ${
                  isDragActive ? "text-brand-400" : "text-muted-foreground"
                }`}
              />
              <p className="font-medium">
                {files.length === 0
                  ? "Drop your real estate photos here"
                  : files.length < 5
                  ? `Add more photos (${files.length} of 5)`
                  : "Maximum 5 photos reached"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                JPEG or PNG, up to 20MB each, max 5 photos
              </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {files.length} of 5 photos selected
                  </p>
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-2">
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 group"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition opacity-60 hover:opacity-100"
                        aria-label="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={runDemo}
                  disabled={processing}
                  className="w-full py-3.5 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition glow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing photos...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Run Quality Check
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          /* Results */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="glass-card p-4 text-center">
                <p className="text-2xl font-bold gradient-text">
                  {Math.round(
                    results.reduce((a, r) => a + r.qcScore, 0) /
                      results.length
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg QC Score
                </p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-2xl font-bold text-green-400">
                  {results.filter((r) => r.status === "passed").length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Passed</p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">
                  {results.filter((r) => r.status === "fixed").length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-Fixable
                </p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-2xl font-bold text-red-400">
                  {results.filter((r) => r.status === "flagged").length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Flagged</p>
              </div>
            </div>

            {/* Per-photo results */}
            <div className="space-y-3 mb-8">
              {results.map((result, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedResult(i)}
                  className={`w-full glass-card p-4 flex items-center gap-4 text-left transition ${
                    selectedResult === i
                      ? "ring-2 ring-brand-500"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5">
                    <img
                      src={URL.createObjectURL(files[i])}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {result.fileName}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {result.issues.map((issue) => (
                        <span
                          key={issue.key}
                          className="text-xs text-amber-400"
                        >
                          {issue.label}
                        </span>
                      ))}
                      {result.issues.length === 0 && (
                        <span className="text-xs text-green-400">
                          All checks passed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{result.qcScore}</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      result.status === "passed"
                        ? "bg-green-500/10 text-green-400"
                        : result.status === "fixed"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {result.status === "passed"
                      ? "Passed"
                      : result.status === "fixed"
                      ? "Fixable"
                      : "Flagged"}
                  </div>
                </button>
              ))}
            </div>

            {/* Selected photo detail */}
            {results[selectedResult] && (
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">
                  {results[selectedResult].fileName} - Detailed Report
                </h3>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    {
                      icon: Ruler,
                      label: "Vertical Dev",
                      value: `${results[selectedResult].metrics.verticalDev} deg`,
                      ok: results[selectedResult].metrics.verticalDev < 1,
                    },
                    {
                      icon: Thermometer,
                      label: "Color Temp",
                      value: `${results[selectedResult].metrics.colorTemp}K`,
                      ok:
                        results[selectedResult].metrics.colorTemp > 4000 &&
                        results[selectedResult].metrics.colorTemp < 6000,
                    },
                    {
                      icon: Sun,
                      label: "Exposure",
                      value: `${results[selectedResult].metrics.exposure} EV`,
                      ok: Math.abs(results[selectedResult].metrics.exposure) < 1,
                    },
                    {
                      icon: Aperture,
                      label: "Sharpness",
                      value: `${results[selectedResult].metrics.sharpness}`,
                      ok: results[selectedResult].metrics.sharpness > 100,
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className={`p-3 rounded-xl text-center ${
                        metric.ok ? "bg-green-500/5" : "bg-red-500/5"
                      }`}
                    >
                      <metric.icon
                        className={`w-4 h-4 mx-auto mb-1 ${
                          metric.ok ? "text-green-400" : "text-red-400"
                        }`}
                      />
                      <p className="text-sm font-mono font-medium">
                        {metric.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>

                {results[selectedResult].issues.length > 0 && (
                  <div className="space-y-2">
                    {results[selectedResult].issues.map((issue) => (
                      <div
                        key={issue.key}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/15"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-amber-300">
                            {issue.label}
                          </span>
                          {issue.detail && (
                            <span className="text-xs text-amber-400/70 ml-2">
                              {issue.detail}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Auto Fix All button - show before fixing */}
            {!fixed && results.some((r) => r.issues.length > 0) && (
              <div className="mt-8 glass-card p-6 border-brand-500/30 bg-brand-500/5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-brand-400" />
                      Ready to fix these issues?
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      AutoQC can auto-correct verticals, color temperature,
                      horizon, and soft focus in one click.
                    </p>
                  </div>
                  <button
                    onClick={runAutoFix}
                    disabled={fixing}
                    className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition glow-sm disabled:opacity-50"
                  >
                    {fixing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Auto Fix All
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Fixed success banner */}
            {fixed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 glass-card p-6 border-green-500/30 bg-green-500/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-300">
                      Auto-fixes applied
                    </h3>
                    <p className="text-sm text-green-400/80 mt-0.5">
                      Verticals straightened, white balance corrected, soft
                      focus sharpened. Scores improved. Sign up to get the
                      actual fixed photos delivered.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CTA */}
            <div className="mt-8 text-center">
              <p className="text-muted-foreground mb-4">
                {fixed
                  ? "Sign up to download the fixed photos and unlock the full platform."
                  : "Want auto-fixes, style profiles, and platform delivery?"}
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition glow"
              >
                Get Started - Credits from $8/property
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-xs text-muted-foreground mt-3">
                Buy credits or use pay-as-you-go. No subscriptions.
              </p>
            </div>

            {/* Try again */}
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setFiles([]);
                  setResults([]);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition"
              >
                Try with different photos
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
