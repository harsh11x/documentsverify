import { NextResponse } from "next/server";
export async function GET() {
  return new NextResponse("Legacy stitch pages are retired.", { status: 410 });
}
