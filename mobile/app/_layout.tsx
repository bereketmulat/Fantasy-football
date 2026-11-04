import { Link, Stack, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";

// A back button that is always visible, on the web and on phones
function Back({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ paddingVertical: 6, paddingRight: 12 }}>
      <Text style={{ color: "#f5c518", fontWeight: "900", fontSize: 17 }}>{label}</Text>
    </Pressable>
  );
}

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
        <Stack.Screen name="scores" options={{ title: "🏈 Scoreboard", headerBackVisible: false, headerLeft: () => <Back label="‹ Picks" /> }} />
        <Stack.Screen name="game/[id]" options={{ title: "Game", headerBackVisible: false, headerLeft: () => <Back label="‹ Back" /> }} />
      </Stack>
    </>
  );
}
