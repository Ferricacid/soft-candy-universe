# Soft Candy Universe / 软糖小宇宙

An interactive browser squishy inspired by Jelly-style pointer-local soft-body deformation. Press, hold, drag, and release the candy to deform it.

## Features

- Pointer-local deformation instead of a whole-element scale transform
- Adjustable rebound speed and charge speed
- Ten muscle levels controlling press strength
- Five color presets plus a custom color picker
- Custom text rendered on the candy without distorting the text itself
- Synthesized press and release sound effects
- Mouse, touch, and keyboard interaction
- Responsive single-page layout

## Run locally

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Validation:

```bash
npm test
```

## Main implementation

- `app/page.tsx` contains the canvas rendering, deformation simulation, controls, and Web Audio synthesis.
- `app/globals.css` contains the responsive layout and visual palette.
- `tests/` covers the deformation model, parameter ranges, palette, and rendered page.

The app is client-side only. It does not require a database, uploads, user accounts, environment secrets, or external API calls.

## Hosting question

The current ChatGPT Sites deployment works, but its workspace rejects the `public` access mode with:

> Publishing Sites to the internet is not enabled for this workspace.

The code is being shared so another developer or AI can recommend the simplest public deployment path. A suitable alternative should support this vinext/Vite application, or adapt it to a conventional static/SSR host with minimal source changes.

## Stack

- React 19
- TypeScript
- vinext / Vite
- Canvas 2D
- Web Audio API
