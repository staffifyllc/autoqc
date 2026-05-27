/**
 * Ingest a local folder of finished JPEGs as reference photos for an
 * agency's StyleProfile, then trigger the profile-learner Lambda so
 * the LAB style histogram gets computed and stored.
 *
 * Usage:
 *   npx tsx scripts/ingest-style-references.ts \
 *     --agency "Flylisted" \
 *     --folder ~/Downloads/flylisted-finished-samples \
 *     [--profile "Flylisted Default"] \
 *     [--limit 1000]
 *
 * Once this completes, the HDR Lambda automatically applies the
 * learned histogram to every Mertens-fused or single-RAW-decoded
 * image for that agency.
 */
import { promises as fs } from "fs";
import { resolve, basename, extname } from "path";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { prisma } from "../src/lib/db";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET;
const LAMBDA_NAME = "photoqc-profile-learner";

const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };
  return {
    agency: get("--agency"),
    folder: get("--folder"),
    profileName: get("--profile") ?? "Default",
    limit: get("--limit") ? parseInt(get("--limit")!, 10) : Infinity,
    dryRun: args.includes("--dry-run"),
  };
}

async function findAgency(name: string) {
  const matches = await prisma.agency.findMany({
    where: { name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (matches.length === 0) {
    throw new Error(`No agency matching "${name}"`);
  }
  if (matches.length > 1) {
    console.log("Multiple matches:");
    console.table(matches);
    throw new Error(
      `Be more specific. ${matches.length} agencies matched "${name}".`
    );
  }
  return matches[0];
}

async function findOrCreateProfile(agencyId: string, name: string) {
  let profile = await prisma.styleProfile.findFirst({
    where: { agencyId, name },
  });
  if (!profile) {
    profile = await prisma.styleProfile.create({
      data: {
        agencyId,
        name,
        isDefault: true,
        referencePhotos: [],
      },
    });
    console.log(`Created StyleProfile "${name}" (${profile.id})`);
  } else {
    console.log(`Reusing StyleProfile "${name}" (${profile.id})`);
  }
  return profile;
}

async function listJpegs(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const ext = extname(e.name).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".tif", ".tiff"].includes(ext)) {
      out.push(resolve(folder, e.name));
    }
  }
  return out;
}

async function uploadOne(
  agencyId: string,
  profileId: string,
  localPath: string
): Promise<string> {
  const key = `${agencyId}/style-references/${profileId}/${basename(localPath)}`;
  // Skip if already there (re-running is safe and resumable).
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return key; // already uploaded
  } catch {
    /* fall through to upload */
  }
  const body = await fs.readFile(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: localPath.endsWith(".png") ? "image/png" : "image/jpeg",
    })
  );
  return key;
}

async function main() {
  const { agency, folder, profileName, limit, dryRun } = parseArgs();
  if (!agency || !folder) {
    console.error(
      "Usage: ingest-style-references --agency <name> --folder <path> [--profile <name>] [--limit N]"
    );
    process.exit(1);
  }
  if (!BUCKET) {
    console.error("AWS_S3_BUCKET env var not set");
    process.exit(1);
  }

  const ag = await findAgency(agency);
  console.log(`Agency: ${ag.name} (${ag.id})`);

  const allFiles = await listJpegs(resolve(folder));
  const files = allFiles.slice(0, limit);
  console.log(
    `Found ${allFiles.length} JPEG/PNG/TIFF files in ${folder}; using ${files.length}.`
  );

  if (files.length === 0) {
    console.log("Nothing to ingest.");
    return;
  }

  if (dryRun) {
    console.log("Dry run; exiting before upload/learn.");
    return;
  }

  const profile = await findOrCreateProfile(ag.id, profileName);

  // Upload in parallel waves of 8 so a 1000-file ingest doesn't
  // saturate the network or hit S3 rate limits.
  const WAVE = 8;
  const keys: string[] = [];
  for (let i = 0; i < files.length; i += WAVE) {
    const wave = files.slice(i, i + WAVE);
    const uploaded = await Promise.all(
      wave.map((f) => uploadOne(ag.id, profile.id, f))
    );
    keys.push(...uploaded);
    process.stdout.write(
      `\rUploaded ${Math.min(i + WAVE, files.length)} / ${files.length}`
    );
  }
  process.stdout.write("\n");

  // Merge new keys into the profile's existing references (idempotent).
  const merged = Array.from(new Set([...profile.referencePhotos, ...keys]));
  await prisma.styleProfile.update({
    where: { id: profile.id },
    data: { referencePhotos: merged },
  });
  console.log(
    `StyleProfile now has ${merged.length} reference photos. Triggering profile-learner Lambda...`
  );

  const invoke = await lambda.send(
    new InvokeCommand({
      FunctionName: LAMBDA_NAME,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({ body: JSON.stringify({ profileId: profile.id }) })
      ),
    })
  );
  const payload = invoke.Payload
    ? Buffer.from(invoke.Payload).toString("utf-8")
    : "";
  console.log("Lambda response:", payload.slice(0, 600));
  console.log(
    "\nDone. Re-run any HDR shoot for this agency to see the matched output."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
