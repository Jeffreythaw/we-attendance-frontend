# WE Attendance Frontend

React + Vite frontend for the WE Attendance system, now packaged for Android with Capacitor.

## Web

```bash
cd /Users/kojeffrey/we-attendance/we-attendance-frontend
npm install
npm run dev
```

Development API proxy defaults to `http://localhost:5242`.

To point the dev server at the production API:

```bash
VITE_DEV_API_TARGET=https://kjapi.gys.com.mm npm run dev
```

## Production Web Build

```bash
npm run build
```

Production builds use:

```env
VITE_API_BASE_URL=https://kjapi.gys.com.mm
```

## Android App

Capacitor Android project location:

`/Users/kojeffrey/we-attendance/we-attendance-frontend/android`

Useful commands:

```bash
npm run cap:sync
npm run android:open
```

Direct Gradle build:

```bash
cd /Users/kojeffrey/we-attendance/we-attendance-frontend/android
./gradlew assembleDebug
```

If Gradle says SDK location is missing, create `android/local.properties`:

```properties
sdk.dir=/Users/<your-user>/Library/Android/sdk
```

Then install/build from Android Studio or Gradle.

## Mobile Notes

- Native geolocation uses Capacitor Geolocation on Android.
- Employee mobile tabs now expose `Clock`, `Schedule`, `Leave`, `History`, and `Settings`.
- Backend CORS must allow `http://localhost` and `capacitor://localhost` for native app API calls.
