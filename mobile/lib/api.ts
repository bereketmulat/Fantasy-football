// Talks to ESPN directly from the phone: no server needed.
const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

export type TeamSide = {
  id: string; name: string; abbreviation: string; logo?: string;
  color?: string; score: number; record?: string; winner?: boolean;
};
export type Game = {
  id: string; date: string; state: "pre" | "in" | "post"; statusText: string;
  clock?: string; period?: number; venue?: string; broadcast?: string;
  home: TeamSide; away: TeamSide;
};

async function espn(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

function mapTeam(c: any): TeamSide {
  return {
    id: c?.team?.id,
    name: c?.team?.displayName,
    abbreviation: c?.team?.abbreviation,
    logo: c?.team?.logo,
    color: c?.team?.color ? `#${c.team.color}` : undefined,
    score: Number(c?.score ?? 0),
    record: c?.records?.[0]?.summary,
    winner: c?.winner,
  };
}

export async function getScoreboard(opts?: { year?: number; seasonType?: number; week?: number }) {
  const q = opts?.week
    ? `?dates=${opts.year}&seasontype=${opts.seasonType}&week=${opts.week}`
    : "";
  const data = await espn(`/scoreboard${q}`);
  const games: Game[] = (data.events ?? []).map((e: any) => {
    const comp = e.competitions?.[0];
    const find = (side: string) => comp?.competitors?.find((c: any) => c.homeAway === side);
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
      home: mapTeam(find("home")),
      away: mapTeam(find("away")),
    };
  });
  return {
    week: data.week?.number as number | undefined,
    seasonType: (data.season?.type ?? 2) as number,
    year: (data.season?.year ?? new Date().getFullYear()) as number,
    games,
  };
}

export async function getGame(id: string) {
  const data = await espn(`/summary?event=${id}`);
  const header = data.header?.competitions?.[0];
  return {
    id,
    statusText: header?.status?.type?.detail as string | undefined,
    teams: (header?.competitors ?? []).map(mapTeam) as TeamSide[],
    plays: (data.plays ?? []).slice(-25).reverse().map((p: any) => ({
      id: String(p.id),
      text: p.text as string,
      clock: p.clock?.displayValue as string | undefined,
      period: p.period?.number as number | undefined,
    })),
  };
}
