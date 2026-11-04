import { NextResponse } from "next/server";
import { getScoreboard } from "@/lib/espn";

export async function GET() {
  try {
    return NextResponse.json(await getScoreboard());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
