

# Restore Landing Page to Original Design

## Problem
The current landing page (dark theme, "Elevate Your Insurance Business" headline) does not match the original design shown in the screenshot. The original had a light/cream theme, bold "STOP SELLING. START WINNING." headline, floating 3D glassmorphic shapes, and different copy/buttons.

## Changes Required

### 1. Update `src/index.css` — Switch to Light Theme
- Change CSS variables from dark palette to light/cream:
  - Background: warm cream/off-white (~`40 30% 96%`)
  - Foreground: dark charcoal
  - Primary: navy blue (`215 80% 25%`)
  - Accent: gold (keep existing `38 90% 55%`)
  - Card, muted, border: light warm grays
- Add a serif/italic font import (e.g. Playfair Display) for the subheading

### 2. Rewrite `src/pages/Index.tsx` — Match Screenshot Layout
- **Nav**: Logo left, "CLAIM YOUR SPOT" dark blue rounded-full button right
- **Hero** (centered, full viewport):
  - "BY INVITATION ONLY" pill badge (light border, uppercase, tracking-widest)
  - "STOP SELLING. START WINNING." — large bold uppercase headline, dark/gold color
  - Italic serif subtext: "The plan your clients have been waiting for — and the opportunity your competition will never see."
  - Gold "GET APPOINTED NOW" rounded CTA button
- **Floating 3D decorative shapes**: Rounded squares and circles positioned around the edges with subtle shadows, glass/frosted effect, partially off-screen
- **Bottom gradient**: Subtle blue-to-purple gradient fade at the very bottom
- **Survey section**: Keep the existing iframe reveal logic (on CTA click, scroll to embedded survey)
- **Footer**: Keep as-is, adapt colors to light theme
- Remove the trust signals grid (not in screenshot)

### 3. No changes to:
- `ChatWidget.tsx` (keep the RAG chat widget)
- `App.tsx` (already correct)
- Edge functions (unchanged)

