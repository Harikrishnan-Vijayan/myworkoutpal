# myWorkoutPal

Workout planner and tracker for Android. Accounts and all workout data are stored on a
Railway backend, so uninstalling the app or switching phones never loses anything — just log in again.

## What's in here

| Folder | What it is |
|---|---|
| `android/` | Android Studio project (Java). A WebView shell that runs the app from `app/src/main/assets/www`. |
| `android/app/src/main/assets/www/` | The app itself: `index.html`, `app.js`, `app.css`, and `config.js` (backend URL). |
| `backend/index.ts` | The API, deployed on Railway as a Bun function. Kept here for reference/version control. |
| `.github/workflows/build-apk.yml` | Builds the APK on GitHub for you. |

## Backend (already live)

- URL: `https://myworkoutpal-api-production.up.railway.app`
- Railway: service **myworkoutpal-api** inside the **ClockIn** project, using ClockIn's Postgres.
  Tables are prefixed `mwp_` (`mwp_users`, `mwp_sessions`, `mwp_user_data`), so ClockIn's data is untouched.
- Passwords are hashed with argon2id; the app holds a session token (valid 180 days).

Endpoints: `POST /api/signup`, `POST /api/login`, `GET /api/me`, `PUT /api/data`, `POST /api/logout`, `GET /health`.

To change the API, edit `backend/index.ts` and paste it into the function's source in Railway
(or ask Claude to update the function).

## Build the APK — option A: GitHub (no Android Studio needed)

1. Create an empty GitHub repo and push this whole folder to the `main` branch.
2. Open the repo's **Actions** tab → **Build APK** → wait ~4 minutes.
3. Download the **myWorkoutPal-apk** artifact, unzip it, copy `app-debug.apk` to your phone and open it
   (allow "Install unknown apps" for your file manager or browser when Android asks).

## Build the APK — option B: Android Studio

1. Open the `android/` folder in Android Studio (Ladybug or newer) and let Gradle sync.
2. **Build › Build App Bundle(s) / APK(s) › Build APK(s)**.
3. The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.
   Or plug in your phone with USB debugging on and press **Run**.

Command line equivalent (needs the Android SDK and JDK 17): `cd android && ./gradlew assembleDebug`
(`gradlew.bat assembleDebug` on Windows).

## Notes

- The debug APK is fine for installing on your own phones. For the Play Store, create a release
  keystore and replace the debug `signingConfig` in `android/app/build.gradle.kts`.
- The app needs internet to log in. After that it keeps a copy on the phone, works offline,
  and syncs when the connection is back (the dot next to the logo shows Saved / Saving / Offline).
