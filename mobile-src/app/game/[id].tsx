import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api";

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>();

  useEffect(() => {
    const load = () => api(`/api/game/${id}`).then(setData).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [id]);

  if (!data) return <ActivityIndicator style={{ flex: 1 }} color="#fff" />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: "#8b93a7", marginBottom: 12 }}>{data.statusText}</Text>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Recent plays</Text>
      {data.plays?.map((p: any) => (
        <View key={p.id} style={{ backgroundColor: "#161a22", borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <Text style={{ color: "#8b93a7", fontSize: 12 }}>Q{p.period} · {p.clock}</Text>
          <Text style={{ color: "#fff", marginTop: 2 }}>{p.text}</Text>
        </View>
      ))}
      <Text style={{ color: "#8b93a7", marginTop: 16 }}>Box score, leaders & more coming next.</Text>
    </ScrollView>
  );
}
