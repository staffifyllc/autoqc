"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface UploadJob {
  id: string; // unique id for this job
  propertyId: string;
  propertyAddress: string;
  files: {
    name: string;
    size: number;
    status: "pending" | "uploading" | "uploaded" | "error";
    progress: number;
    photoId?: string;
  }[];
  status: "queued" | "running" | "done" | "error";
  startedAt: Date;
}

interface UploadContextType {
  jobs: UploadJob[];
  startUpload: (
    propertyId: string,
    propertyAddress: string,
    files: File[]
  ) => string;
  dismissJob: (jobId: string) => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  const compressImage = async (file: File): Promise<Blob> => {
    if (file.size < 2 * 1024 * 1024) return file;
    if (!file.type.startsWith("image/")) return file;
    try {
      const img = await createImageBitmap(file);
      const MAX_DIM = 3840;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.9,
      });
      return blob.size < file.size ? blob : file;
    } catch {
      return file;
    }
  };

  const startUpload = useCallback(
    (propertyId: string, propertyAddress: string, files: File[]): string => {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const newJob: UploadJob = {
        id: jobId,
        propertyId,
        propertyAddress,
        files: files.map((f) => ({
          name: f.name,
          size: f.size,
          status: "pending",
          progress: 0,
        })),
        status: "queued",
        startedAt: new Date(),
      };

      setJobs((prev) => [...prev, newJob]);

      // Kick off upload async - doesn't block the UI
      processJob(jobId, propertyId, files);

      return jobId;
    },
    []
  );

  const updateFile = (
    jobId: string,
    index: number,
    updates: Partial<UploadJob["files"][0]>
  ) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              files: j.files.map((f, i) =>
                i === index ? { ...f, ...updates } : f
              ),
            }
          : j
      )
    );
  };

  const updateJobStatus = (jobId: string, status: UploadJob["status"]) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status } : j))
    );
  };

  const processJob = async (
    jobId: string,
    propertyId: string,
    files: File[]
  ) => {
    updateJobStatus(jobId, "running");

    try {
      // Get presigned URLs
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          files: files.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
          })),
        }),
      });

      const { uploads } = await res.json();

      // Parallel upload with concurrency
      const CONCURRENCY = 4;
      const queue = files.map((f, i) => ({
        index: i,
        file: f,
        uploadUrl: uploads[i].uploadUrl,
        photoId: uploads[i].photoId,
      }));

      const uploadOne = async (job: typeof queue[0]) => {
        updateFile(jobId, job.index, { status: "uploading", progress: 0 });
        try {
          const blob = await compressImage(job.file);
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", job.uploadUrl);
            xhr.setRequestHeader("Content-Type", blob.type || job.file.type);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                updateFile(jobId, job.index, {
                  progress: Math.round((e.loaded / e.total) * 100),
                });
              }
            };
            xhr.onload = () =>
              xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`Upload failed: ${xhr.status}`));
            xhr.onerror = () => reject(new Error("Upload error"));
            xhr.send(blob);
          });
          updateFile(jobId, job.index, {
            status: "uploaded",
            progress: 100,
            photoId: job.photoId,
          });
        } catch {
          updateFile(jobId, job.index, { status: "error", progress: 0 });
        }
      };

      async function worker() {
        while (queue.length > 0) {
          const job = queue.shift();
          if (!job) break;
          await uploadOne(job);
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, files.length) }, () =>
          worker()
        )
      );

      // Upload complete - auto-trigger QC so user doesn't have to click again
      try {
        const qcRes = await fetch(`/api/properties/${propertyId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "run_qc" }),
        });
        if (qcRes.status === 402) {
          const data = await qcRes.json();
          alert(data.message || "Payment required. Go to Credits page.");
        }
      } catch (qcErr) {
        console.error("Failed to auto-trigger QC:", qcErr);
      }

      updateJobStatus(jobId, "done");
    } catch (err) {
      console.error("Upload job failed:", err);
      updateJobStatus(jobId, "error");
    }
  };

  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, []);

  return (
    <UploadContext.Provider value={{ jobs, startUpload, dismissJob }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error("useUpload must be used within UploadProvider");
  }
  return ctx;
}
