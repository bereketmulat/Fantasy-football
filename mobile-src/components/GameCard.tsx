import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Game, TeamSide } from "../lib/api";

function Row({ team, dim }: { team: TeamSide; dim: boolean }) {
  return (
    <View style={styles.row}>
      {team.logo ? <Image source={{ uri: team.logo }} style={styles.logo} /> : <View style={styles.logo} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, dim && styles.dim]}>{team.name}</Text>
        {team.record ? <Text style={styles.record}>{team.record}</Text> : null}
      </View>
      <Text style={[styles.score, dim && styles.dim]}>{team.score}</Text>
    </View>
  );
}

export function GameCard({ game }: { game: Game }) {
  const router = useRouter();
  const live = game.state === "in";
  const final = game.state === "post";
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/game/${game.id}`)}>
      <View style={styles.status}>
        {live && <View style={styles.liveDot} />}
        <Text style={[styles.statusText, live && { color: "#ff4d4f" }]}>{game.statusText}</Text>
      </View>
      <Row team={game.away} dim={final && !game.away.winner} />
      <Row team={game.home} dim={final && !game.home.winner} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#161a22", borderRadius: 16, padding: 16, marginBottom: 12 },
  status: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  statusText: { color: "#8b93a7", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4d4f", marginRight: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  logo: { width: 36, height: 36, marginRight: 12 },
  name: { color: "#fff", fontSize: 16, fontWeight: "600" },
  record: { color: "#8b93a7", fontSize: 12 },
  score: { color: "#fff", fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] },
  dim: { opacity: 0.45 },
});
