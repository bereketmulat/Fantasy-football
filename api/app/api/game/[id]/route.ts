import { NextResponse } from "next/server";
import { getGame } from "@/lib/espn";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await getGame(id));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
