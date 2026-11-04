import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { getScoreboard, type Game } from "../lib/api";
import { GameCard } from "../components/GameCard";

type Sel = { seasonType: number; week: number };

const CHIPS: { label: string; seasonType: number; week: number }[] = [
  ...Array.from({ length: 18 }, (_, i) => ({ label: `${i + 1}`, seasonType: 2, week: i + 1 })),
  { label: "WC", seasonType: 3, week: 1 },
  { label: "DIV", seasonType: 3, week: 2 },
  { label: "CONF", seasonType: 3, week: 3 },
  { label: "SB", seasonType: 3, week: 5 },
];
const CHIP_W = 52;

export default function Scoreboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [year, setYear] = useState<number>();
  const [sel, setSel] = useState<Sel>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const bar = useRef<ScrollView>(null);

  const load = useCallback(async (s?: Sel, y?: number) => {
    try {
      const data = await getScoreboard(s ? { year: y, ...s } : undefined);
      setGames(data.games);
      setError(undefined);
      if (!s) {
        // First load: adopt whatever week ESPN says is current
        setYear(data.year);
        const cur = { seasonType: data.seasonType, week: data.week ?? 1 };
        setSel(cur);
        const idx = CHIPS.findIndex((c) => c.seasonType === cur.seasonType && c.week === cur.week);
        setTimeout(() => bar.current?.scrollTo({ x: Math.max(0, idx * CHIP_W - 120), animated: false }), 50);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load the selected week, then refresh every 15s (matters for live games)
  useEffect(() => {
    load(sel, year);
    const t = setInterval(() => load(sel, year), 15000);
    return () => clearInterval(t);
  }, [sel, year, load]);

  const pick = (c: Sel) => {
    setLoading(true);
    setGames([]);
    setSel({ seasonType: c.seasonType, week: c.week });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: 12 }}>
        <Text style={{ color: "#8b93a7", fontWeight: "600", marginLeft: 16, marginBottom: 8 }}>
          {year ?? ""} SEASON · TAP A WEEK
        </Text>
        <ScrollView ref={bar} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {CHIPS.map((c) => {
            const on = sel?.seasonType === c.seasonType && sel?.week === c.week;
            return (
              <Pressable
                key={`${c.seasonType}-${c.week}`}
                onPress={() => pick(c)}
                style={{
                  width: CHIP_W - 6, marginRight: 6, paddingVertical: 10, borderRadius: 12,
                  alignItems: "center", backgroundColor: on ? "#fff" : "#161a22",
                }}
              >
                <Text style={{ color: on ? "#0d1017" : "#fff", fontWeight: "700" }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#fff" />
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor="#fff"
              onRefresh={() => { setRefreshing(true); load(sel, year); }} />
          }
          ListEmptyComponent={
            <View style={{ padding: 24 }}>
              <Text style={{ color: "#fff", textAlign: "center" }}>
                {error ? `Couldn't load scores (${error}). Pull down to retry.` : "No games this week."}
              </Text>
            </View>
          }
          renderItem={({ item }) => <GameCard game={item} />}
        />
      )}
    </View>
  );
}
