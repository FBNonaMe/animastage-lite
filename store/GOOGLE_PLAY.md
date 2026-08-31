# Publishing AnimaStage Lite on Google Play

Step-by-step guide for the **Android app only** (`com.webmmd.suite`).

---

## Already prepared in this repo

| Item | Status |
|------|--------|
| Capacitor 7 + Android API 35 | Done |
| Portrait mode, icon, splash | Done |
| Release signing (`keystore.properties`) | One-time setup |
| Privacy policy | `public/privacy-policy.html` |
| Store listing text | `store/play-listing.txt` |
| Data safety answers | `store/data-safety.txt` |
| Content rating notes | `store/content-rating.txt` |
| AAB build | `npm run release:android` |

---

## Step 1 — Developer account

1. Open [Google Play Console](https://play.google.com/console)
2. Pay the developer registration fee (**$25**, one time)
3. Complete your developer profile (name, email: `Boyko2005maxim@gmail.com`)

---

## Step 2 — App signing (one time)

If you do not have `android/keystore.properties` yet:

```powershell
npm run setup:android-signing
```

**Keep forever:**
- the `.keystore` file (default: `%USERPROFILE%\keys\webmmd-release.keystore`)
- keystore password
- alias (`webmmd`)

Without these you **cannot update** the app on Play Store.

> `android/keystore.properties` must not be committed to git (listed in `.gitignore`).

---

## Step 3 — Build the AAB

```powershell
npm run release:android
```

Output:
- `android/app/build/outputs/bundle/release/app-release.aab`
- copy: `store/releases/AnimaStage-Lite-v1.2.3-6.aab`

Play Console requires an **AAB**, not an APK.

### New version before release

```powershell
.\scripts\bump-android-version.ps1 -VersionName 1.2.4 -VersionCode 7
npm run release:android
```

`versionCode` must **increase** with every release.

---

## Step 4 — Create the app in Play Console

1. **Create app**
2. **App name:** `AnimaStage Lite`
3. **Default language:** English (US)
4. **App / Game:** App
5. **Free / Paid:** Free

---

## Step 5 — Store listing

Copy from `store/play-listing.txt`:

| Field | Value |
|-------|-------|
| App name | AnimaStage Lite |
| Short description | ≤80 chars (English) |
| Full description | English text from play-listing |
| App icon | 512×512 PNG — scale from `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` |
| Feature graphic | 1024×500 PNG — see `store/assets/README.md` |
| Phone screenshots | min 2, JPG/PNG 9:16 — see `store/assets/README.md` |
| Privacy policy URL | `https://animastage-lite.app/privacy-policy.html` |
| Website | `https://animastage-lite.app` |

### Graphics

Place source files in `store/assets/`:
- `icon-512.png`
- `feature-graphic-1024x500.png`
- `screenshot-01.png`, `screenshot-02.png` (portrait 1080×1920 or 9:16)

---

## Step 6 — App content (required forms)

### Privacy policy
URL: **https://animastage-lite.app/privacy-policy.html**

Deploy the site first (`npm run build` → dist) and verify the URL in a browser.

### Data safety
Answers in `store/data-safety.txt`  
Summary: **no data collected**, files processed locally.

### Content rating
Complete the IARC questionnaire. Hints in `store/content-rating.txt`  
Note that users upload **their own** content (PMX/VMD).

### Target audience
Not a children's app (or 13+) unless you join the Families program.

### Ads
**No** — the app has no ads.

### News / COVID / Government apps
**No** for all.

---

## Step 7 — Release

Recommended order:

1. **Internal testing** — upload AAB, add your email as tester
2. Test on a real phone: PMX import, VMD playback, MP4 export
3. **Closed testing** (optional) — 10–20 testers
4. **Production** — after verification

In each track:
- **Create new release** → upload `app-release.aab`
- Release notes — from `store/play-listing.txt` (Release notes section)
- **Review release** → **Start rollout**

### Play App Signing
On first upload Google will offer **Play App Signing** — accept (recommended).  
Your upload key comes from `keystore.properties`.

---

## Step 8 — After publication

1. Update `src/landing/androidRelease.ts`:
   - `playStoreUrl` — link from Play Console
   - `playStoreStatus: 'published'`
2. Update landing: replace “Google Play coming soon” with a “Get on Google Play” button
3. Add the link in `README.md`

---

## Pre-submission checklist

- [ ] AAB built with `release:android`, unique versionCode
- [ ] Privacy policy opens over HTTPS
- [ ] 512×512 icon uploaded
- [ ] ≥2 phone screenshots
- [ ] Feature graphic 1024×500
- [ ] Data safety = No collection
- [ ] Content rating completed
- [ ] English descriptions filled in
- [ ] Support email set
- [ ] Test on Android 10+ and at least one API 23 device

---

## Commands (cheatsheet)

| Command | Purpose |
|---------|---------|
| `npm run setup:android-signing` | Create keystore + properties |
| `npm run build:android` | Debug APK for sideload (website) |
| `npm run release:android` | **Signed AAB for Google Play** |
| `.\scripts\bump-android-version.ps1 -VersionName X -VersionCode N` | Bump version |

---

## Listing contacts

- **Developer:** FBNonaMe
- **Site:** https://animastage-lite.app
- **Email:** Boyko2005maxim@gmail.com
