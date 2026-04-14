import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

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
}

export async function enqueueQCJob(job: QCJobMessage): Promise<void> {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(job),
    MessageGroupId: job.propertyId,
  });
  await sqs.send(command);
}

export { sqs };
