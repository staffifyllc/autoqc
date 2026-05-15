import { NextRequest, NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/profiles/[id]/learn — kick off reference-photo analysis.
//
// Invokes the photoqc-profile-learner Lambda ASYNCHRONOUSLY (Event mode)
// and returns 202 immediately. The Lambda writes learned values back to
// the StyleProfile row directly (psycopg2), so the client polls the
// profile endpoint until colorTempAvg flips non-null to know it's done.
//
// Why async: real-world reference sets routinely take 90-120s through
// the Claude Vision pass plus aggregation. The Vercel function ceiling
// is 60s (Hobby) or 300s (Pro) and Safari aborts long idle fetches at
// roughly 60-90s regardless. Async + polling means Safari users see a
// consistent UX whether the Lambda takes 5s or 4 minutes, and a closed
// tab no longer kills the analysis.
//
// Previously this was synchronous (RequestResponse). Customers on
// Safari reported "load failed" / 504s every time the Lambda crossed
// 60s. Switched 2026-05-13.

const LEARNER_FUNCTION =
  process.env.PROFILE_LEARNER_FUNCTION ?? "photoqc-profile-learner";

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Validation + the async Lambda invoke both finish in well under 5s.
// We only need the default Vercel timeout here.
export const maxDuration = 10;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAgency();

    const profile = await prisma.styleProfile.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (!profile.referencePhotos.length) {
      return NextResponse.json(
        { error: "Upload reference photos first" },
        { status: 400 }
      );
    }

    // Async invocation. The Lambda runs on its own thread, writes the
    // learned values back to the StyleProfile row when it finishes.
    // The client polls /api/profiles/[id] (refetch via fetchProfile())
    // and sees the learned-state flip when colorTempAvg goes non-null.
    const cmd = new InvokeCommand({
      FunctionName: LEARNER_FUNCTION,
      InvocationType: "Event",
      Payload: Buffer.from(
        JSON.stringify({ body: JSON.stringify({ profileId: profile.id }) })
      ),
    });

    const result = await lambda.send(cmd);

    // Event-mode invokes return StatusCode 202 when accepted. Anything
    // else means the SDK couldn't even hand the job off — that's the
    // only failure mode worth surfacing here. Per-photo errors and
    // database writes happen inside the Lambda after we have already
    // told the client we're working on it.
    if (result.StatusCode !== 202) {
      console.error(
        "[profile/learn] Lambda invoke returned",
        result.StatusCode,
        result.FunctionError,
      );
      return NextResponse.json(
        {
          error:
            "Couldn't hand off the analysis job. Try again, or email hello@autoqc.io if it keeps failing.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        status: "started",
        photoCount: profile.referencePhotos.length,
        message:
          "Analysis running in the background. This page will update when it finishes (usually 30s to 3 min).",
      },
      { status: 202 },
    );
  } catch (err: any) {
    console.error("[profile/learn] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to start learning" },
      { status: 500 }
    );
  }
}
