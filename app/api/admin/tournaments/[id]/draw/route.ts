import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../lib/apiGuard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const guard = await requireApiUser({ requireAdmin: true });
  if ("error" in guard) {
    return guard.error;
  }

  return NextResponse.json(
    { error: "Draw API not implemented." },
    { status: 501 }
  );
}
