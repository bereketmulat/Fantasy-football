// The app only ever sees these shapes, so swapping data providers later
// means changing lib/espn.ts and nothing in the mobile app.
export type TeamSide = {
  id: string;
  name: string;
  abbreviation: string;
  logo?: string;
  color?: string;
  score: number;
  record?: string;
  winner?: boolean;
};

export type Game = {
  id: string;
  date: string;
  state: "pre" | "in" | "post";
  statusText: string; // "Q3 4:21", "Final", "Sun 4:25 PM"
  clock?: string;
  period?: number;
  venue?: string;
  broadcast?: string;
  home: TeamSide;
  away: TeamSide;
};
