import type { Game, TeamSide } from "./types";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

async function espn(path: string, revalidate: number) {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${path}`);
  return res.json();
}

function mapTeam(c: any): TeamSide {
  return {
    id: c.team?.id,
    name: c.team?.displayName,
    abbreviation: c.team?.abbreviation,
    logo: c.team?.logo,
    color: c.team?.color ? `#${c.team.color}` : undefined,
    score: Number(c.score ?? 0),
    record: c.records?.[0]?.summary,
    winner: c.winner,
  };
}

function mapEvent(e: any): Game {
  const comp = e.competitions?.[0];
  const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
  const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
  const st = e.status?.type;
  return {
    id: e.id,
    date: e.date,
    state: st?.state ?? "pre",
    statusText: st?.shortDetail ?? st?.detail ?? "",
    clock: e.status?.displayClock,
    period: e.status?.period,
    venue: comp?.venue?.fullName,
    broadcast: comp?.broadcasts?.[0]?.names?.[0],
    home: mapTeam(home),
    away: mapTeam(away),
  };
}

export async function getScoreboard(): Promise<{ week?: number; games: Game[] }> {
  // Short cache: protects the upstream API while staying "live enough".
  const data = await espn("/scoreboard", 10);
  return { week: data.week?.number, games: (data.events ?? []).map(mapEvent) };
}

export async function getGame(id: string) {
  const data = await espn(`/summary?event=${id}`, 10);
  const header = data.header?.competitions?.[0];
  return {
    id,
    statusText: header?.status?.type?.detail,
    teams: (header?.competitors ?? []).map(mapTeam),
    boxscore: data.boxscore?.teams ?? [],
    leaders: data.leaders ?? [],
    plays: (data.plays ?? []).slice(-25).reverse().map((p: any) => ({
      id: p.id,
      text: p.text,
      clock: p.clock?.displayValue,
      period: p.period?.number,
    })),
  };
}
