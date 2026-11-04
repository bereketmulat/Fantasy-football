# NFL Live App

- `api/`        Next.js backend (proxies + caches NFL data, hides API keys)
- `mobile-src/` Expo Router app source (setup.sh drops it into a fresh `mobile/` Expo project)

## Run it
```bash
bash setup.sh                 # one time

# terminal 1
cd api && npm run dev         # http://localhost:3000/api/scoreboard

# terminal 2
cd mobile && npx expo start   # scan QR with Expo Go
```
Phone and computer must be on the same Wi-Fi.

## Windows?
Run `setup.sh` in Git Bash or WSL, or do the steps by hand:
1. `cd api && npm install`
2. `npx create-expo-app@latest mobile --template blank-typescript`
3. in `mobile`: `npx expo install expo-router expo-constants expo-linking expo-status-bar react-native-screens react-native-safe-area-context`
4. Delete `App.tsx`/`index.ts`, copy everything from `mobile-src/` into `mobile/`
5. In `mobile/package.json` set `"main": "expo-router/entry"`; in `app.json` add `"scheme": "nflapp"`

## Troubleshooting
- "Can't reach the API": confirm `api` is running and `http://<your-computer-IP>:3000/api/scoreboard` opens in your phone's browser. A firewall may need to allow port 3000.
- Offseason/bye weeks: the scoreboard may be empty or show last/next week's games.
