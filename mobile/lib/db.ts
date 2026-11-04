import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export const configured = SUPABASE_URL.startsWith("https://") && SUPABASE_KEY.length > 20;

export type Session = { code: string; memberId: string; username: string; name?: string | null };
export type Member = { id: string; username: string };
export type Pick = { member_id: string; game_id: string; team_id: string };

async function rest(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  // Legacy anon keys are JWTs and go in Authorization too; new publishable keys don't.
  if (SUPABASE_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) throw new Error(body?.message ?? `Request failed (${res.status})`);
  return body;
}

// ---- sessions: every lobby you're in, remembered on this phone ----
const OLD_KEY = "nfl.session";   // old single-lobby key (migrated below)
const SKEY = "nfl.sessions";
const AKEY = "nfl.active";

export async function getSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(SKEY);
  const list: Session[] = raw ? JSON.parse(raw) : [];
  const old = await AsyncStorage.getItem(OLD_KEY);
  if (old) {
    const s: Session = JSON.parse(old);
    if (!list.some((x) => x.code === s.code)) list.push(s);
    await AsyncStorage.setItem(SKEY, JSON.stringify(list));
    await AsyncStorage.removeItem(OLD_KEY);
    if (!(await AsyncStorage.getItem(AKEY))) await AsyncStorage.setItem(AKEY, s.code);
  }
  return list;
}
export const saveSessions = (list: Session[]) => AsyncStorage.setItem(SKEY, JSON.stringify(list));
export const getActive = () => AsyncStorage.getItem(AKEY);
export const setActive = (code: string | null) =>
  code ? AsyncStorage.setItem(AKEY, code) : AsyncStorage.removeItem(AKEY);

// Look up the current names of lobbies (names are set when a lobby is created).
export async function lobbyNames(codes: string[]): Promise<Record<string, string | null>> {
  if (!codes.length) return {};
  try {
    const rows: { code: string; name: string | null }[] = await rest(`/lobbies?code=in.(${codes.join(",")})&select=code,name`);
    return Object.fromEntries(rows.map((r) => [r.code, r.name]));
  } catch {
    return {}; // "name" column not added yet; the app still works without names
  }
}

// ---- lobbies & members ----
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = () =>
  Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

function cleanName(name: string) {
  const n = name.trim();
  if (n.length < 2 || n.length > 20) throw new Error("Username must be 2-20 characters.");
  return n;
}

async function addMember(code: string, username: string): Promise<Session> {
  const rows = await rest("/members", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ lobby_code: code, username }),
  });
  return { code, memberId: rows[0].id, username };
}

export async function createLobby(username: string, lobbyName?: string): Promise<Session> {
  const name = cleanName(username);
  const title = (lobbyName ?? "").trim().slice(0, 30) || null;
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    try {
      await rest("/lobbies", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ code, name: title }),
      });
      return { ...(await addMember(code, name)), name: title };
    } catch (e: any) {
      if (/column|schema cache/i.test(e.message)) throw new Error("Lobby names need a one-time database update. Run lobby-names.sql in Supabase first.");
      if (!/duplicate/i.test(e.message)) throw e; // only retry code collisions
    }
  }
  throw new Error("Couldn't create a lobby, try again.");
}

export async function joinLobby(codeInput: string, username: string): Promise<Session> {
  const name = cleanName(username);
  const code = codeInput.trim().toUpperCase();
  if (code.length !== 5) throw new Error("Lobby codes are 5 characters.");
  const lobby = await rest(`/lobbies?code=eq.${code}&select=code`);
  const names = await lobbyNames([code]);
  if (!lobby?.length) throw new Error("No lobby with that code.");
  const members: Member[] = await listMembers(code);
  const existing = members.find((m) => m.username.toLowerCase() === name.toLowerCase());
  if (existing) return { code, memberId: existing.id, username: existing.username, name: names[code] ?? null }; // rejoin
  return { ...(await addMember(code, name)), name: names[code] ?? null };
}

export const listMembers = (code: string): Promise<Member[]> =>
  rest(`/members?lobby_code=eq.${code}&select=id,username&order=created_at`);

// ---- picks ----
export async function listPicks(code: string, gameIds: string[]): Promise<Pick[]> {
  if (!gameIds.length) return [];
  return rest(`/picks?lobby_code=eq.${code}&game_id=in.(${gameIds.join(",")})&select=member_id,game_id,team_id`);
}

export async function upsertPick(p: { code: string; memberId: string; gameId: string; teamId: string; kickoff: string }) {
  await rest("/picks?on_conflict=member_id,game_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      member_id: p.memberId, lobby_code: p.code, game_id: p.gameId, team_id: p.teamId, kickoff: p.kickoff,
    }),
  });
}

// ---- username sign-in (step 1, remembered on this phone) ----
const UKEY = "nfl.username";
export const getUsername = () => AsyncStorage.getItem(UKEY);
export async function signIn(name: string): Promise<string> {
  const n = cleanName(name);
  await AsyncStorage.setItem(UKEY, n);
  return n;
}
export async function signOut() {
  await AsyncStorage.removeItem(UKEY);
  await AsyncStorage.removeItem(SKEY);
  await AsyncStorage.removeItem(AKEY);
  await AsyncStorage.removeItem(OLD_KEY);
}
