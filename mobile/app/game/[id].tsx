import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getGame } from "../../lib/api";

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Awaited<ReturnType<typeof getGame>>>();

  useEffect(() => {
    const load = () => getGame(id).then(setData).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [id]);

  if (!data) return <ActivityIndicator style={{ flex: 1 }} color="#fff" />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
        {data.teams.map((t) => (
          <View key={t.id} style={{ alignItems: "center" }}>
            {t.logo ? <Image source={{ uri: t.logo }} style={{ width: 56, height: 56 }} /> : null}
            <Text style={{ color: "#fff", fontWeight: "700", marginTop: 4 }}>{t.abbreviation}</Text>
            <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800" }}>{t.score}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: "#8b93a7", textAlign: "center", marginBottom: 16 }}>{data.statusText}</Text>

      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Recent plays</Text>
      {data.plays.length === 0 && <Text style={{ color: "#8b93a7" }}>No plays yet.</Text>}
      {data.plays.map((p) => (
        <View key={p.id} style={{ backgroundColor: "#161a22", borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <Text style={{ color: "#8b93a7", fontSize: 12 }}>Q{p.period} · {p.clock}</Text>
          <Text style={{ color: "#fff", marginTop: 2 }}>{p.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
