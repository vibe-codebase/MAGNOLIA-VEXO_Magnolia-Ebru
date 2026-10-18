# Magnolia Ebru

By **MAGNOLIA VEXO** · package `com.magnoliavexo.magnoliaebru` · Expo owner `894-895`.

A one-touch game for Android about Turkish paper marbling. You hold a finger on the bath to pour each colour and drag a stylus or comb through the floating ink. Then you lay down a sheet of paper and pull the print. You follow a recipe step by step, and the drops turn into hearts, chevrons, tulips and carnations.

- 24 patterns in three chapters:
  - **Battal:** stone ebru made from drops.
  - **Tarak:** stylus and comb work.
  - **Çiçek:** flowers made with strokes that stop partway.
- The marbling is real mathematics. Every drop and stroke is an exact, tear-free deformation of the whole bath, after Jaffer and Lu. The ink therefore behaves the way it does on water.
- Stars are tulips, earned for how true the print is to the pattern. Every print you pull is kept in the portfolio and re-marbled from your own strokes.
- Visuals: a lamp-lit walnut trough with a copper lip, pigment grain and rims, laid paper with a deckled edge, and buttons cut from marbled paper the game makes itself.
- Sound: a ney and drone, kanun plucks, drips, a trickle while pouring, and the stylus hissing through the size.

## Structure

| Path | What it is |
| --- | --- |
| `web/src/game/sim.ts` | Pure marbling model: drop and stroke maps, adaptive boundary refinement, rasterised likeness |
| `web/src/game/levels.ts` | The 24 recipes, stone grounds and tulip thresholds |
| `web/src/game/bot.ts` | Test marbler with human imprecision; it sets and checks the thresholds |
| `web/tools/` | `sheet.mjs` renders every target to a contact sheet; `stars.ts` derives the thresholds |
| `src/native/` | Expo WebView shell |

```bash
npm install && npm run web:install
npm run web:test     # 33 tests
npm run build:game && npm run validate:assets && npm run android
```

## Release builds

The Android release is configured for Google Play: target and compile SDK 36, R8 minification and resource shrinking, a non-debuggable release build, no Internet permission, and the game served offline from the app's own assets. Builds run on EAS; `eas.json` has two profiles:

```bash
npm install -g eas-cli && eas login
eas init                     # once: links this folder to your Expo project
npm run eas:apk              # preview profile: a signed APK for testing on devices
npm run eas:aab              # production profile: an AAB for Google Play (versionCode auto-increments)
```
