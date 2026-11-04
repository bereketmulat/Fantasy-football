#!/usr/bin/env bash
# One-time setup. Run from the nfl-app folder:  bash setup.sh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Installing API deps..."
(cd "$ROOT/api" && npm install)

echo "▶ Creating Expo app (latest SDK, so it matches the Expo Go in your app store)..."
cd "$ROOT"
npx create-expo-app@latest mobile --template blank-typescript --no-install
cd mobile
npm install
npx expo install expo-router expo-constants expo-linking expo-status-bar react-native-screens react-native-safe-area-context

echo "▶ Copying app source..."
rm -f App.tsx index.ts index.js
cp -R "$ROOT/mobile-src/." .

echo "▶ Wiring up Expo Router..."
node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync("package.json"));
p.main="expo-router/entry";
fs.writeFileSync("package.json",JSON.stringify(p,null,2));
const a=JSON.parse(fs.readFileSync("app.json"));
a.expo.scheme="nflapp";
a.expo.userInterfaceStyle="dark";
fs.writeFileSync("app.json",JSON.stringify(a,null,2));
'

echo ""
echo "✅ Done. Now run these in two terminals:"
echo "   Terminal 1:  cd api    && npm run dev"
echo "   Terminal 2:  cd mobile && npx expo start"
echo "Then scan the QR code with Expo Go (phone must be on the same Wi-Fi)."
