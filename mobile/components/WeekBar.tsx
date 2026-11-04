import { useEffect, useRef, type ComponentRef } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

const DISPLAY = Platform.select({ ios: "AvenirNext-CondensedHeavy", android: "sans-serif-condensed", default: "Impact, 'Arial Narrow', sans-serif" });

export type Sel = { seasonType: number; week: number };

const CHIPS: (Sel & { label: string })[] = [
  ...Array.from({ length: 18 }, (_, i) => ({ label: `${i + 1}`, seasonType: 2, week: i + 1 })),
  { label: "WC", seasonType: 3, week: 1 },
  { label: "DIV", seasonType: 3, week: 2 },
  { label: "CONF", seasonType: 3, week: 3 },
  { label: "SB", seasonType: 3, week: 5 },
];
const CHIP_W = 52;

export function WeekBar({ year, sel, onPick }: { year?: number; sel?: Sel; onPick: (s: Sel) => void }) {
  const bar = useRef<ComponentRef<typeof ScrollView>>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!sel || !first.current) return;
    first.current = false;
    const idx = CHIPS.findIndex((c) => c.seasonType === sel.seasonType && c.week === sel.week);
    setTimeout(() => bar.current?.scrollTo({ x: Math.max(0, idx * CHIP_W - 120), animated: false }), 50);
  }, [sel]);

  return (
    <View style={{ paddingTop: 12 }}>
      <Text style={{ color: "#f4f1e8", fontFamily: DISPLAY, fontSize: 24, letterSpacing: 1.5, marginLeft: 16, marginBottom: 8 }}>
        {year ?? ""} SEASON
      </Text>
      <ScrollView ref={bar} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {CHIPS.map((c) => {
          const on = sel?.seasonType === c.seasonType && sel?.week === c.week;
          return (
            <Pressable
              key={`${c.seasonType}-${c.week}`}
              onPress={() => onPick({ seasonType: c.seasonType, week: c.week })}
              style={{
                width: CHIP_W - 6, marginRight: 6, paddingVertical: 10, borderRadius: 12,
                alignItems: "center", backgroundColor: on ? "#f5c518" : "#0f2c20", borderWidth: 1, borderColor: on ? "#f5c518" : "#1d4733",
              }}
            >
              <Text style={{ color: on ? "#0a2218" : "#f4f1e8", fontWeight: "900" }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
