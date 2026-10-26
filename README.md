# myWorkoutPal

**Plan it. Lift it. Log it.**

myWorkoutPal is a workout planner and tracker for Android. You set up a weekly plan, follow it set by set
in the gym, and keep a history of every workout. Your account and all workout data live on a backend
hosted on Railway, so uninstalling the app or switching phones never loses anything. Just log in again.

## Features

- **Accounts.** Sign up with your name, email and password, then log in on any phone and get your data back.
- **Weekly plan (Plan tab).** Give each day of the week a workout or make it a rest day. The plan repeats
  every week. Each day shows as Today, Planned, Done, Missed or Rest.
- **Workout library.** Comes with five starter workouts (Push, Pull, Legs, Upper Body, Full Body). You can
  build your own with the workout builder: name it, add exercises (or quick-add common ones like Squat,
  Deadlift or Bench Press), and set sets, reps and weight for each. Custom workouts can be deleted.
- **Today tab.** Shows today's workout with each exercise's target, plus what you did last time.
  - Adjust weight (steps of 2.5 kg / 5 lb) and reps for each set, tick sets off as you go, or add extra sets.
  - Tap the "Prev" value to copy last time's weight and reps. An ↑ marks sets where you beat it.
  - A live progress bar shows sets done, and running totals show volume, reps and exercises.
  - **Finish workout** saves it to your history.
- **History tab.** A bar chart of weekly volume for the last 6 weeks, and a card for each workout with its sets,
  reps, volume and top set per exercise. A **PR** badge marks a workout that beat your best volume so far.
- **Account sheet.** Shows how many workouts you've logged and saved, lets you switch between kg and lb,
  shows sync status, and has the log-out button.
- **Works offline.** Data is cached on the phone. Changes save to the server about 0.7 seconds after you
  make them. If you're offline they wait on the phone and sync when you reconnect. The dot next to the logo
  shows *Saved*, *Saving…* or *Offline · will sync*.
- **Light and dark mode**, toggled from the header. The Android status bar follows the theme.

## How it's built

```
┌──────────────────────────────┐        HTTPS + Bearer token        ┌──────────────────────────────┐
│ Android app (Java)           │ ─────────────────────────────────▶ │ Railway Function (Bun + Hono)│
│  WebView shell               │                                    │  backend/index.ts            │
│   └─ assets/www (HTML/JS/CSS)│ ◀───────────────────────────────── │        │                     │
│      cache in localStorage   │         JSON (user + data)         │        ▼                     │
└──────────────────────────────┘                                    │  Postgres (mwp_* tables)     │
                                                                    └──────────────────────────────┘
```

- **Android shell:** `MainActivity.java` hosts the web app in a `WebView`. It serves the bundled files with
  `androidx.webkit.WebViewAssetLoader`. Min SDK 26 (Android 8.0), target/compile SDK 35, Java 17, Gradle 8.14.
- **App:** a small single-page app with no framework, in `android/app/src/main/assets/www/`.
  `app.js` holds the state, the views (Today, Plan, History, picker, builder, account) and the sync logic.
- **Backend:** one TypeScript file, `backend/index.ts`. It's a [Hono](https://hono.dev) app running on Bun as
  a Railway Function, using Bun's built-in Postgres client.

## Project structure

| Path | What it is |
|---|---|
| `android/` | Android Studio project (Gradle Kotlin DSL). |
| `android/app/src/main/java/app/myworkoutpal/MainActivity.java` | WebView host activity. |
| `android/app/src/main/assets/www/index.html` | App entry page. |
| `android/app/src/main/assets/www/app.js` | All app logic and views. |
| `android/app/src/main/assets/www/app.css` | Styles, including dark mode. |
| `android/app/src/main/assets/www/config.js` | Backend URL (`window.MWP_API`). |
| `android/app/src/main/res/` | Launcher icon, colors, theme, strings. |
| `backend/index.ts` | The API. Kept here for reference and version control. |
| `.github/workflows/build-apk.yml` | GitHub Action that builds the debug APK on every push to `main`. |

## Backend

- **URL:** `https://myworkoutpal-api-production.up.railway.app`
- **Railway:** service **myworkoutpal-api** in the **ClockIn** project. It uses ClockIn's Postgres, but every
  table is prefixed `mwp_`, so ClockIn's data is untouched.

### API

All request and response bodies are JSON. Endpoints marked 🔒 need an `Authorization: Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Service info. |
| `GET` | `/health` | Checks the database connection. |
| `POST` | `/api/signup` | `{ name, email, password, data? }` → `{ token, user, data, updatedAt }` |
| `POST` | `/api/login` | `{ email, password }` → `{ token, user, data, updatedAt }` |
| `GET` | `/api/me` 🔒 | Returns the current user and their saved data. |
| `PUT` | `/api/data` 🔒 | `{ data }` replaces the user's saved data (max ~2 MB). |
| `POST` | `/api/logout` 🔒 | Ends the current session. |

### Database

| Table | Columns |
|---|---|
| `mwp_users` | `id`, `email` (unique), `name`, `pass_hash`, `created_at` |
| `mwp_sessions` | `token` (primary key), `user_id`, `created_at`, `last_seen` |
| `mwp_user_data` | `user_id` (primary key), `data` (JSONB), `updated_at` |

The backend creates these tables on startup if they don't exist. Each user's data is stored as one JSON
document:

```jsonc
{
  "v": 1,
  "templates": [ { "id", "name", "custom", "exercises": [ { "name", "sets", "reps", "weight" } ] } ],
  "schedule": [ /* 7 entries, Mon–Sun: a template id or null (rest day) */ ],
  "history": [ { "id", "date", "name", "sets", "reps", "vol", "pr", "top", "unit" } ],
  "lastPerf": { "<exercise name>": { "date", "sets": [[weight, reps], ...] } },
  "log": { /* today's in-progress workout */ },
  "settings": { "unit": "kg" }
}
```

### Security

- Passwords are hashed with **argon2id** (`Bun.password`).
- Sessions use random 256-bit tokens that stay valid for **180 days**.
- Signup and login are rate-limited to 20 attempts per minute per IP.
- Passwords must be 6–200 characters, and emails are lower-cased and checked for a valid format.

### Changing the API

Edit `backend/index.ts`, then paste it into the function's source in Railway (or ask Claude to update the
function). `DATABASE_URL` and `PORT` come from Railway's environment variables. To point the app at a
different backend, change `config.js`.

## Build the APK

### Option A: GitHub Actions (no Android Studio needed)

1. Push to the `main` branch, or run the workflow by hand from the **Actions** tab (**Build APK** → **Run workflow**).
2. Wait about 4 minutes for the build to finish.
3. Download the **myWorkoutPal-apk** artifact, unzip it, copy `app-debug.apk` to your phone and open it.
   When Android asks, allow "Install unknown apps" for your file manager or browser.

### Option B: Android Studio

1. Open the `android/` folder in Android Studio (Ladybug or newer) and let Gradle sync.
2. Choose **Build › Build App Bundle(s) / APK(s) › Build APK(s)**.
3. The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
   Or plug in your phone with USB debugging on and press **Run**.

From the command line (needs the Android SDK and JDK 17):

```bash
cd android
./gradlew assembleDebug
```

On Windows, use `gradlew.bat assembleDebug`.

## Notes

- The debug APK is fine for installing on your own phones. Release builds are also signed with the debug
  key for now. Before publishing to the Play Store, create a release keystore and replace the
  `signingConfig` in `android/app/build.gradle.kts`.
- The app needs internet to log in. After that it keeps a copy on the phone, works offline, and syncs
  when the connection is back.
- The app needs only two permissions: `INTERNET` and `ACCESS_NETWORK_STATE`.
