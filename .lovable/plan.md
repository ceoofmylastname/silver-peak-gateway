

# Fix: Remove Default Vite CSS Overrides

## Problem
`src/App.css` contains default Vite/React template styles that constrain the layout:
- `#root { max-width: 1280px; margin: 0 auto; padding: 2rem; text-align: center; }` — this limits the page width and adds unwanted padding, breaking the full-bleed hero and nav.

This file is likely a leftover from the original Vite scaffold and was never cleaned up.

## Fix
**Clear `src/App.css`** — remove all contents. The landing page styles come from Tailwind classes in `Index.tsx` and the theme in `src/index.css`, so this file's styles are purely interfering.

No other files need to change. The landing page code in `Index.tsx` is intact and correct. The ChatWidget overlay in `App.tsx` is properly wired. This single CSS fix will restore the original full-width, dark-themed landing page appearance.

