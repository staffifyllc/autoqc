import { NextRequest, NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/profiles/[id]/learn — analyze reference photos and write
// learned style parameters back onto the profile.
//
// Invokes the photoqc-profile-learner Lambda synchronously (RequestResponse)
// so the user sees a real result rather than a "we'll get back to you" lie.
// The Lambda timeout is 300s, well within the 60s default Vercel function
// budget if invoked Async, but the Lambda finishes in seconds for typical
// reference sets so we just wait.
//
// Was previously a stub that returned status:"learning" without ever
// invoking the Lambda — that's why uploaded reference photos sat there
// forever without any learned values.

const LEARNER_FUNCTION =
  process.env.PROFILE_LEARNER_FUNCTION ?? "photoqc-profile-learner";

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const maxDuration = 60;

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

    const cmd = new InvokeCommand({
      FunctionName: LEARNER_FUNCTION,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({ body: JSON.stringify({ profileId: profile.id }) })
      ),
    });

    const result = await lambda.send(cmd);
    const payloadText = result.Payload
      ? Buffer.from(result.Payload).toString("utf8")
      : "";
    let parsed: { statusCode?: number; body?: string } = {};
    try {
      parsed = JSON.parse(payloadText);
    } catch {
      parsed = {};
    }

    if (result.FunctionError) {
      console.error("[profile/learn] Lambda error", result.FunctionError, payloadText);
      return NextResponse.json(
        {
          error:
            "We hit an error analyzing your photos. The team has been notified.",
        },
        { status: 502 }
      );
    }

    if (parsed.statusCode && parsed.statusCode >= 400) {
      return NextResponse.json(
        { error: parsed.body ?? "Profile learning failed" },
        { status: parsed.statusCode }
      );
    }

    let learned: any = null;
    try {
      learned = parsed.body ? JSON.parse(parsed.body) : null;
    } catch {
      learned = null;
    }

    return NextResponse.json({
      status: "completed",
      photosAnalyzed: learned?.photos_analyzed ?? profile.referencePhotos.length,
      learned,
    });
  } catch (err: any) {
    console.error("[profile/learn] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to start learning" },
      { status: 500 }
    );
  }
}
