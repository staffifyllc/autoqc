import {
  SQSClient,
  SendMessageBatchCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";

const sqs = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL!;

export interface QCJobMessage {
  propertyId: string;
  agencyId: string;
  photoIds: string[];
  styleProfileId?: string;
  clientProfileId?: string;
  tier?: "STANDARD" | "PREMIUM";
}

/**
 * Enqueue QC job - sends ONE message per photo for parallel processing.
 * Each photo gets a unique MessageGroupId so SQS FIFO processes them in parallel.
 * The last photo to finish triggers finalization (set consistency, property status).
 */
export async function enqueueQCJob(job: QCJobMessage): Promise<void> {
  // Send in batches of 10 (SQS batch limit)
  const entries = job.photoIds.map((photoId, i) => ({
    Id: `p${i}`,
    MessageBody: JSON.stringify({
      mode: "photo",
      propertyId: job.propertyId,
      agencyId: job.agencyId,
      photoId,
      clientProfileId: job.clientProfileId,
      tier: job.tier || "STANDARD",
      totalPhotos: job.photoIds.length,
    }),
    MessageGroupId: photoId, // Different groups = parallel processing
    MessageDeduplicationId: `${photoId}_${Date.now()}`,
  }));

  const batches: (typeof entries)[] = [];
  for (let i = 0; i < entries.length; i += 10) {
    batches.push(entries.slice(i, i + 10));
  }

  await Promise.all(
    batches.map((batch) =>
      sqs.send(
        new SendMessageBatchCommand({
          QueueUrl: QUEUE_URL,
          Entries: batch,
        })
      )
    )
  );
}

export { sqs };
