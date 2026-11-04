import Constants from "expo-constants";

// Auto-detects your computer's LAN IP from Expo's dev server address,
// so your phone can reach the Next.js API with zero config in dev.
// In production, set EXPO_PUBLIC_API_URL to your deployed Vercel URL.
function getBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:3000`;
}

export const API_URL = getBaseUrl();

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export type TeamSide = {
  id: string; name: string; abbreviation: string; logo?: string;
  color?: string; score: number; record?: string; winner?: boolean;
};
export type Game = {
  id: string; date: string; state: "pre" | "in" | "post"; statusText: string;
  clock?: string; period?: number; venue?: string; broadcast?: string;
  home: TeamSide; away: TeamSide;
};
