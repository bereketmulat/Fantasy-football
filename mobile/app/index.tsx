import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Stack } from "expo-router";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Share, Text, TextInput, View,
} from "react-native";
import { getScoreboard, type Game, type TeamSide } from "../lib/api";
import { WeekBar, type Sel } from "../components/WeekBar";
import * as db from "../lib/db";

// Night-game palette: turf green, chalk white, first-down-line yellow
const C = { bg: "#0a2218", card: "#0f2c20", mute: "#8fb09f", good: "#3ddc84", bad: "#ff5a5f", acc: "#f5c518", line: "#1d4733", chalk: "#f4f1e8" };
const DISPLAY = Platform.select({ ios: "AvenirNext-CondensedHeavy", android: "sans-serif-condensed", default: "Impact, 'Arial Narrow', sans-serif" });

/* Alert.alert does nothing on the web build, so use the browser's own dialogs there */
const notify = (title: string, msg: string) => {
  if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};
const confirmAsk = (title: string, msg: string, okLabel: string, onOk: () => void) => {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${msg}`)) onOk();
  } else {
    Alert.alert(title, msg, [
      { text: "Cancel", style: "cancel" },
      { text: okLabel, style: "destructive", onPress: onOk },
    ]);
  }
};

/* yard lines painted across the whole screen */
function Field({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <View key={i} style={{ position: "absolute", top: i * 64, left: 0, right: 0, height: i % 5 === 0 ? 3 : 1.5,
            backgroundColor: i % 5 === 0 ? "rgba(244,241,232,0.10)" : "rgba(244,241,232,0.05)" }} />
        ))}
      </View>
      {children}
    </View>
  );
}

const isLocked = (g: Game) => g.state !== "pre" || Date.now() >= Date.parse(g.date);
const winnerOf = (g: Game) =>
  g.state !== "post" ? undefined : g.home.winner ? g.home.id : g.away.winner ? g.away.id : undefined;

/* ---------- small UI pieces ---------- */
function Btn({ label, onPress, kind = "primary", disabled }: { label: string; onPress: () => void; kind?: "primary" | "ghost"; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress} disabled={disabled}
      style={{
        paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 10, opacity: disabled ? 0.5 : 1,
        backgroundColor: kind === "primary" ? C.acc : "transparent", borderWidth: kind === "ghost" ? 1 : 0, borderColor: "#2f6048",
      }}
    >
      <Text style={{ color: kind === "primary" ? C.bg : C.chalk, fontWeight: "900", letterSpacing: 0.5, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={C.mute}
      {...props}
      style={{ backgroundColor: C.card, color: C.chalk, padding: 14, borderRadius: 12, fontSize: 16, marginTop: 10, borderWidth: 1, borderColor: C.line }}
    />
  );
}

/* ---------- STEP 1: sign in with just a username ---------- */
function SignIn({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState<string>();

  const go = async () => {
    try { onDone(await db.signIn(name)); } catch (e: any) { setErr(e.message); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 56, textAlign: "center" }}>🏈</Text>
        <Text style={{ color: C.chalk, fontSize: 54, fontFamily: DISPLAY, letterSpacing: 3, textAlign: "center", marginTop: 4 }}>NFL PICK'EM</Text>
        <View style={{ height: 5, width: 90, backgroundColor: C.acc, alignSelf: "center", marginTop: 6, borderRadius: 2 }} />
        <Text style={{ color: C.mute, textAlign: "center", marginTop: 14, fontSize: 16 }}>Call every game. Settle it with the group chat.</Text>
        <Text style={{ color: C.chalk, fontWeight: "800", marginTop: 28, fontSize: 16 }}>What's your name, coach?</Text>
        <Input placeholder="Your username" value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} maxLength={20} onSubmitEditing={go} returnKeyType="go" />
        <Btn label="Kick off" onPress={go} />
        {err ? <Text style={{ color: C.bad, marginTop: 16, textAlign: "center" }}>{err}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- STEP 2: your lobbies, plus create or join another ---------- */
function LobbyHub({ username, sessions, onOpen, onAdd, onSignOut }: {
  username: string; sessions: db.Session[]; onOpen: (s: db.Session) => void; onAdd: (s: db.Session) => void; onSignOut: () => void;
}) {
  const [lobbyName, setLobbyName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const run = async (fn: () => Promise<db.Session>) => {
    setBusy(true); setErr(undefined);
    try { const s = await fn(); await onAdd(s); setLobbyName(""); setCode(""); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: C.mute }}>Signed in as</Text>
        <Text style={{ color: C.acc, fontSize: 38, fontFamily: DISPLAY, letterSpacing: 1.5 }}>{username}</Text>

        {sessions.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={{ color: C.chalk, fontFamily: DISPLAY, fontSize: 24, letterSpacing: 1, marginBottom: 8 }}>YOUR LOBBIES</Text>
            {sessions.map((s) => (
              <Pressable key={s.code} onPress={() => onOpen(s)}
                style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.line, borderLeftWidth: 5, borderLeftColor: C.acc, flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.chalk, fontFamily: DISPLAY, fontSize: 24, letterSpacing: 0.5 }} numberOfLines={1}>{s.name || `Lobby ${s.code}`}</Text>
                  <Text style={{ color: C.mute, marginTop: 2 }}>Code {s.code}</Text>
                </View>
                <Text style={{ color: C.acc, fontSize: 28, fontWeight: "900" }}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={{ color: C.chalk, fontFamily: DISPLAY, fontSize: 24, letterSpacing: 1, marginTop: 22 }}>START A NEW LOBBY</Text>
        <Input placeholder="Lobby name (like Family League)" value={lobbyName} onChangeText={setLobbyName} maxLength={30} />
        <Btn label="Create lobby" disabled={busy} onPress={() => run(() => db.createLobby(username, lobbyName))} />

        <Text style={{ color: C.chalk, fontFamily: DISPLAY, fontSize: 24, letterSpacing: 1, marginTop: 26 }}>JOIN WITH A CODE</Text>
        <Input placeholder="Lobby code (5 characters)" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={5} />
        <Btn kind="ghost" label="Join lobby" disabled={busy} onPress={() => run(() => db.joinLobby(code, username))} />

        {busy && <ActivityIndicator style={{ marginTop: 16 }} color="#fff" />}
        {err ? <Text style={{ color: C.bad, marginTop: 16, textAlign: "center" }}>{err}</Text> : null}

        <Pressable onPress={onSignOut} style={{ marginTop: 28 }}>
          <Text style={{ color: C.mute, textAlign: "center" }}>Not {username}? Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- a team row with a Pick button ---------- */
function TeamRow({ t, showScore, selected, locked, result, onPress }: {
  t: TeamSide; showScore: boolean; selected: boolean; locked: boolean; result?: "win" | "lose"; onPress: () => void;
}) {
  const bg = selected ? (result === "win" ? C.good : result === "lose" ? C.bad : C.acc) : locked ? "#163a2a" : C.chalk;
  const fg = selected ? (result ? "#fff" : C.bg) : locked ? C.mute : C.bg;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
      {t.logo ? <Image source={{ uri: t.logo }} style={{ width: 40, height: 40, marginRight: 12 }} /> : <View style={{ width: 40, height: 40, marginRight: 12 }} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.chalk, fontSize: 19, fontFamily: DISPLAY, letterSpacing: 0.5 }} numberOfLines={1}>{t.name}</Text>
        <Text style={{ color: C.mute, fontSize: 12 }}>{t.record ?? ""}</Text>
      </View>
      {showScore ? <Text style={{ color: C.chalk, fontSize: 28, fontFamily: DISPLAY, marginRight: 12, minWidth: 34, textAlign: "right" }}>{t.score}</Text> : null}
      <Pressable onPress={onPress} disabled={locked}
        style={{ minWidth: 96, paddingVertical: 11, borderRadius: 10, alignItems: "center", backgroundColor: bg }}>
        <Text style={{ color: fg, fontWeight: "900", letterSpacing: 0.5 }}>{selected ? "✓ PICKED" : locked ? "🔒" : "PICK"}</Text>
      </Pressable>
    </View>
  );
}

/* ---------- the spreadsheet board ---------- */
const ROW_H = 46, HEAD_H = 40, COL_W = 82, LABEL_W = 100;

function Board({ games, members, picks, meId }: { games: Game[]; members: db.Member[]; picks: db.Pick[]; meId: string }) {
  const pickOf = (mid: string, gid: string) => picks.find((p) => p.member_id === mid && p.game_id === gid)?.team_id;
  const isComplete = (mid: string) => games.length > 0 && games.every((g) => pickOf(mid, g.id));

  const cell = (m: db.Member, g: Game) => {
    const pk = pickOf(m.id, g.id);
    const visible = m.id === meId || isComplete(m.id) || isLocked(g);
    if (!visible) return { text: pk ? "✓" : "…", color: C.mute };
    const team = pk === g.home.id ? g.home : pk === g.away.id ? g.away : undefined;
    if (!team) return { text: "—", color: C.mute };
    const w = winnerOf(g);
    return { text: team.abbreviation, color: w ? (pk === w ? C.good : C.bad) : "#fff" };
  };

  const correct = (m: db.Member) =>
    games.filter((g) => { const w = winnerOf(g); return w && pickOf(m.id, g.id) === w; }).length;

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 12, flexDirection: "row" }}>
      {/* left: game labels */}
      <View style={{ width: LABEL_W }}>
        <View style={{ height: HEAD_H, justifyContent: "center" }}><Text style={{ color: C.mute, fontWeight: "700" }}>GAME</Text></View>
        {games.map((g) => (
          <View key={g.id} style={{ height: ROW_H, justifyContent: "center", borderTopWidth: 1, borderColor: C.line }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>{g.away.abbreviation} @ {g.home.abbreviation}</Text>
            <Text style={{ color: C.mute, fontSize: 11 }}>{g.state === "pre" ? "upcoming" : g.state === "in" ? "LIVE" : `${g.away.score}-${g.home.score}`}</Text>
          </View>
        ))}
        <View style={{ height: ROW_H, justifyContent: "center", borderTopWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.mute, fontWeight: "700" }}>✓ CORRECT</Text>
        </View>
      </View>

      {/* right: one column per player */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row", height: HEAD_H }}>
            {members.map((m) => (
              <View key={m.id} style={{ width: COL_W, justifyContent: "center", alignItems: "center" }}>
                <Text numberOfLines={1} style={{ color: m.id === meId ? C.acc : "#fff", fontWeight: "800", maxWidth: COL_W - 6 }}>{m.username}</Text>
              </View>
            ))}
          </View>
          {games.map((g) => (
            <View key={g.id} style={{ flexDirection: "row", height: ROW_H, borderTopWidth: 1, borderColor: C.line }}>
              {members.map((m) => {
                const c = cell(m, g);
                return (
                  <View key={m.id} style={{ width: COL_W, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: c.color, fontWeight: "800", fontSize: 15 }}>{c.text}</Text>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={{ flexDirection: "row", height: ROW_H, borderTopWidth: 1, borderColor: C.line }}>
            {members.map((m) => (
              <View key={m.id} style={{ width: COL_W, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{correct(m)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- the lobby ---------- */
function Lobby({ session, onLeave, onBack }: { session: db.Session; onLeave: () => void; onBack: () => void }) {
  const [tab, setTab] = useState<"mine" | "board">("mine");
  const [showPicks, setShowPicks] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [sel, setSel] = useState<Sel>();
  const [year, setYear] = useState<number>();
  const [games, setGames] = useState<Game[]>([]);
  const [members, setMembers] = useState<db.Member[]>([]);
  const [picks, setPicks] = useState<db.Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const req = useRef(0);

  const refresh = useCallback(async (s?: Sel, y?: number) => {
    const id = ++req.current;
    try {
      const sb = await getScoreboard(s ? { year: y, seasonType: s.seasonType, week: s.week } : undefined);
      const [m, p] = await Promise.all([db.listMembers(session.code), db.listPicks(session.code, sb.games.map((g) => g.id))]);
      if (id !== req.current) return;
      setGames(sb.games); setMembers(m); setPicks(p); setError(undefined);
      if (!s) { setYear(sb.year); setSel({ seasonType: sb.seasonType, week: sb.week ?? 1 }); }
    } catch (e: any) {
      if (id === req.current) setError(e.message);
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [session.code]);

  useEffect(() => {
    refresh(sel, year);
    const t = setInterval(() => refresh(sel, year), 12000);
    return () => clearInterval(t);
  }, [sel, year, refresh]);

  const pickOf = (mid: string, gid: string) => picks.find((p) => p.member_id === mid && p.game_id === gid)?.team_id;

  const choose = async (g: Game, teamId: string) => {
    if (isLocked(g)) return;
    const prev = picks;
    setPicks((p) => [...p.filter((x) => !(x.member_id === session.memberId && x.game_id === g.id)), { member_id: session.memberId, game_id: g.id, team_id: teamId }]);
    try {
      await db.upsertPick({ code: session.code, memberId: session.memberId, gameId: g.id, teamId, kickoff: g.date });
    } catch (e: any) {
      setPicks(prev);
      notify("Couldn't save pick", e.message);
    }
  };

  const countFor = (mid: string) => games.filter((g) => pickOf(mid, g.id)).length;
  const myCount = countFor(session.memberId);
  const myPicked = games.flatMap((g) => {
    const id = pickOf(session.memberId, g.id);
    const team = id === g.home.id ? g.home : id === g.away.id ? g.away : undefined;
    if (!team) return [];
    const opp = team === g.home ? g.away : g.home;
    return [{ g, team, opp, away: team === g.away }];
  });
  const correctFor = (mid: string) => games.filter((g) => { const w = winnerOf(g); return w && pickOf(mid, g.id) === w; }).length;
  const rows = members
    .map((m) => ({ ...m, made: countFor(m.id), correct: correctFor(m.id) }))
    .sort((a, b) => b.correct - a.correct || b.made - a.made || a.username.localeCompare(b.username));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Link href="/scores" style={{ color: "#fff", fontWeight: "700", marginRight: 16 }}>🏈 Scores</Link>
              <Pressable onPress={() => setShowPicks(true)} style={{ backgroundColor: C.acc, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
                <Text style={{ color: C.bg, fontWeight: "900" }}>My Picks ({myPicked.length})</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <Modal visible={showLeave} transparent animationType="fade" onRequestClose={() => setShowLeave(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: C.acc, fontSize: 28, fontFamily: DISPLAY, letterSpacing: 1 }}>LEAVE LOBBY?</Text>
            <Text style={{ color: C.mute, marginTop: 8 }}>You can rejoin later with the lobby code and the same username. Your picks stay saved.</Text>
            <Btn label="Leave" onPress={() => { setShowLeave(false); onLeave(); }} />
            <Btn kind="ghost" label="Stay" onPress={() => setShowLeave(false)} />
          </View>
        </View>
      </Modal>
      <Modal visible={showPicks} transparent animationType="slide" onRequestClose={() => setShowPicks(false)}>
        <Pressable onPress={() => setShowPicks(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" }}>
            <Text style={{ color: C.acc, fontSize: 28, fontFamily: DISPLAY, letterSpacing: 1 }}>{session.username.toUpperCase()}'S PICKS TO WIN</Text>
            <Text style={{ color: C.mute, marginTop: 2, marginBottom: 10 }}>{myPicked.length} of {games.length} games picked this week</Text>
            <ScrollView>
              {myPicked.length === 0 ? (
                <Text style={{ color: C.mute, paddingVertical: 20, textAlign: "center" }}>No picks yet. Tap Pick on a team to choose a winner.</Text>
              ) : myPicked.map(({ g, team, opp, away }) => {
                const w = winnerOf(g);
                const color = w ? (team.id === w ? C.good : C.bad) : "#fff";
                return (
                  <View key={g.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderColor: C.line }}>
                    {team.logo ? <Image source={{ uri: team.logo }} style={{ width: 36, height: 36, marginRight: 12 }} /> : <View style={{ width: 36, height: 36, marginRight: 12 }} />}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color, fontWeight: "800", fontSize: 16 }}>{team.name}</Text>
                      <Text style={{ color: C.mute, fontSize: 12 }}>{away ? "@" : "vs"} {opp.name}</Text>
                    </View>
                    <Text style={{ color: C.mute, fontSize: 12 }}>{w ? (team.id === w ? "✅ Won" : "❌ Lost") : g.state === "in" ? "LIVE" : "🔒"}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <Btn label="Close" onPress={() => setShowPicks(false)} />
          </Pressable>
        </Pressable>
      </Modal>
      <WeekBar year={year} sel={sel} onPick={(s) => { setLoading(true); setGames([]); setPicks([]); setSel(s); }} />
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#fff" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Pressable onPress={onBack} style={{ paddingBottom: 10 }}>
            <Text style={{ color: C.acc, fontWeight: "900", fontSize: 16 }}>‹ My lobbies</Text>
          </Pressable>

          {/* lobby header */}
          <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                {session.name ? <Text style={{ color: C.chalk, fontSize: 30, fontFamily: DISPLAY, letterSpacing: 0.5, marginBottom: 4 }} numberOfLines={1}>{session.name}</Text> : null}
                <Text style={{ color: C.mute, fontSize: 12, fontWeight: "600" }}>LOBBY CODE</Text>
                <Text style={{ color: C.acc, fontSize: 40, fontFamily: DISPLAY, letterSpacing: 6 }}>{session.code}</Text>
              </View>
              <Pressable onPress={() => Share.share({ message: `Join my NFL pick'em lobby${session.name ? ` "${session.name}"` : ""}! Code: ${session.code}` })}
                style={{ backgroundColor: C.acc, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}>
                <Text style={{ fontWeight: "900", color: C.bg }}>Share</Text>
              </Pressable>
            </View>

            <Text style={{ color: "#fff", fontWeight: "800", marginTop: 16, marginBottom: 6 }}>In this lobby ({members.length})</Text>
            {rows.map((r) => {
              const done = games.length > 0 && r.made === games.length;
              return (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5 }}>
                  <Text style={{ color: r.id === session.memberId ? C.acc : "#fff", flex: 1, fontWeight: "700" }}>
                    {r.username}{r.id === session.memberId ? " (you)" : ""}
                  </Text>
                  <Text style={{ color: done ? C.good : C.mute, marginRight: 12 }}>{done ? "✅ all picks in" : `${r.made}/${games.length} picked`}</Text>
                  <Text style={{ color: "#fff", fontWeight: "800", width: 36, textAlign: "right" }}>{r.correct} ✓</Text>
                </View>
              );
            })}
          </View>

          {/* tabs */}
          <View style={{ flexDirection: "row", backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 12 }}>
            {([["mine", "My picks"], ["board", "Everyone's board"]] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setTab(k)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center", backgroundColor: tab === k ? C.acc : "transparent" }}>
                <Text style={{ fontWeight: "900", color: tab === k ? C.bg : C.chalk }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={{ color: C.bad, marginBottom: 12 }}>Problem: {error}</Text> : null}
          {games.length === 0 && !error ? <Text style={{ color: C.mute, textAlign: "center" }}>No games this week.</Text> : null}

          {tab === "mine" ? (
            <>
              {games.length > 0 && (
                <Text style={{ color: myCount === games.length ? C.good : C.mute, fontWeight: "700", marginBottom: 10 }}>
                  {myCount === games.length ? "✅ All your picks are in!" : `Tap Pick on a team for each game · ${myCount}/${games.length} done`}
                </Text>
              )}
              {games.map((g) => {
                const locked = isLocked(g);
                const mine = pickOf(session.memberId, g.id);
                const w = winnerOf(g);
                const res = (id: string) => (mine === id && w ? (id === w ? "win" : "lose") : undefined);
                return (
                  <View key={g.id} style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.line, borderLeftWidth: 5, borderLeftColor: mine ? C.acc : C.line }}>
                    <Text style={{ color: g.state === "in" ? C.bad : C.mute, fontSize: 12, fontWeight: "600" }}>
                      {g.state === "in" ? "● LIVE · " : ""}{g.statusText}{locked ? "  🔒 picks locked" : ""}
                    </Text>
                    <TeamRow t={g.away} showScore={g.state !== "pre"} selected={mine === g.away.id} locked={locked} result={res(g.away.id)} onPress={() => choose(g, g.away.id)} />
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
                      <Text style={{ color: C.mute, fontSize: 11, fontWeight: "900", marginHorizontal: 8 }}>VS</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
                    </View>
                    <TeamRow t={g.home} showScore={g.state !== "pre"} selected={mine === g.home.id} locked={locked} result={res(g.home.id)} onPress={() => choose(g, g.home.id)} />
                  </View>
                );
              })}
            </>
          ) : (
            games.length > 0 && (
              <>
                <Board games={games} members={members} picks={picks} meId={session.memberId} />
                <Text style={{ color: C.mute, fontSize: 12, marginTop: 10 }}>
                  A player's picks show up here once they've picked every game this week (or once each game kicks off). "✓" means picked but hidden, "…" means not picked yet.
                </Text>
              </>
            )
          )}

          <Btn kind="ghost" label="Leave lobby" onPress={() => setShowLeave(true)} />
        </ScrollView>
      )}
    </View>
  );
}

/* ---------- the app's front door ---------- */
function Screen() {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [sessions, setSessions] = useState<db.Session[]>([]);
  const [active, setActiveCode] = useState<string | null>(null);

  const persist = async (list: db.Session[]) => { setSessions(list); await db.saveSessions(list); };

  useEffect(() => {
    (async () => {
      const [u, list, act] = await Promise.all([db.getUsername(), db.getSessions(), db.getActive()]);
      setUsername(u ?? list[0]?.username ?? null);
      setSessions(list);
      setActiveCode(act && list.some((x) => x.code === act) ? act : null);
      setReady(true);
      // pick up lobby names (also for lobbies saved before names existed)
      const names = await db.lobbyNames(list.map((x) => x.code));
      const fresh = list.map((x) => (names[x.code] !== undefined ? { ...x, name: names[x.code] } : x));
      if (JSON.stringify(fresh) !== JSON.stringify(list)) persist(fresh);
    })();
  }, []);

  const openLobby = async (code: string | null) => { setActiveCode(code); await db.setActive(code); };
  const addLobby = async (s: db.Session) => {
    await persist([...sessions.filter((x) => x.code !== s.code), s]);
    await openLobby(s.code);
  };
  const leaveLobby = async (code: string) => {
    await persist(sessions.filter((x) => x.code !== code));
    await openLobby(null);
  };

  if (!db.configured) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 }}>One setup step left</Text>
        <Text style={{ color: C.mute }}>
          Open mobile/lib/config.ts and paste your Supabase Project URL and anon key between the quotes, save, then reload the app.
        </Text>
      </View>
    );
  }
  if (!ready) return <ActivityIndicator style={{ flex: 1 }} color="#fff" />;
  if (!username) return <SignIn onDone={setUsername} />;

  const current = sessions.find((x) => x.code === active);
  if (!current) {
    return (
      <LobbyHub username={username} sessions={sessions} onOpen={(s) => openLobby(s.code)} onAdd={addLobby}
        onSignOut={async () => { await db.signOut(); setSessions([]); setActiveCode(null); setUsername(null); }} />
    );
  }
  return <Lobby key={current.code} session={current} onBack={() => openLobby(null)} onLeave={() => leaveLobby(current.code)} />;
}

export default function Home() {
  return <Field><Screen /></Field>;
}
