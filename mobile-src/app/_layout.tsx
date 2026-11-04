import { Link, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#071a12" },
          headerTintColor: "#f4f1e8",
          headerTitleStyle: { fontWeight: "900", letterSpacing: 1 },
          contentStyle: { backgroundColor: "#0a2218" },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "🏈 NFL PICK'EM",
            headerRight: () => (
              <Link href="/scores" style={{ color: "#fff", fontWeight: "700" }}>🏈 Scores</Link>
            ),
          }}
        />
        <Stack.Screen name="scores" options={{ title: "🏈 Scoreboard" }} />
        <Stack.Screen name="game/[id]" options={{ title: "Game" }} />
      </Stack>
    </>
  );
}
