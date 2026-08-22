---
name: Futrix
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#10131a'
  on-background: '#e1e2ec'
  surface-variant: '#32353c'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  title-md:
    fontFamily: Sora
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  container-padding: 2rem
  gutter: 1.5rem
---

## Brand & Style
The design system is engineered for a high-stakes, high-reward academic environment that borrows visual cues from premium gaming dashboards and futuristic command centers. The target audience—students and professionals—expects an immersive, "flow-state" experience that reduces anxiety through clean layouts while maintaining engagement through subtle gamification.

The aesthetic follows a **Cyber-Minimalist** approach, blending the precision of **Minimalism** with the depth of **Glassmorphism**. Interface elements feel like light-projected interfaces—sharp, luminous, and layered. The goal is to evoke a sense of "prestige tech," where every interaction feels deliberate and high-fidelity.

## Colors
The palette is rooted in a "Deep Space" hierarchy. The primary background (#0f172a) provides a void-like canvas that allows functional elements to pop. 

- **Primary Accent:** Neon Blue (#3b82f6) is used for "Active" states, progress indicators, and primary CTAs. It should always be accompanied by a soft 10-20px outer glow (drop-shadow) to simulate luminosity.
- **Surfaces:** Card colors (#1e293b) use reduced opacity (60-80%) to allow background blurs to seep through.
- **Functional Colors:** Success Green and Danger Red are reserved for immediate feedback—grading, time warnings, and validation.

## Typography
This design system utilizes **Sora** for headlines to convey a geometric, futuristic confidence. Its wide stance and technical apertures make it ideal for high-impact titles and XP counters. 

For all functional text, reading material, and UI labels, **Geist** is employed. Its monospaced-influenced proportions provide the precision needed for complex exam questions and technical data points. 

**Formatting Rules:**
- Use `label-sm` with 5% letter spacing and uppercase for section headers and metadata.
- Body text should maintain a 1.6x line height to ensure legibility during long reading sessions.

## Layout & Spacing
The layout follows a **12-column fluid grid** for desktop and a **single-column fluid stack** for mobile. 

**Core Principles:**
- **The Command Center:** Important telemetry (timer, progress, XP) should be pinned to the top or sides in fixed-position glass panels.
- **Content Focus:** The main exam questions reside in a central container that spans 8 columns on desktop to prevent eye strain.
- **Rhythm:** Use a strict 4px/8px modular scale. Components are separated by `lg` (24px) spacing, while internal element padding usually follows the `md` (16px) unit.

## Elevation & Depth
Depth is created through **Glassmorphism** rather than traditional drop shadows. 

1.  **Level 0 (Floor):** Background Main (#0f172a).
2.  **Level 1 (Surface):** Secondary background (#111827) for sidebar/nav areas.
3.  **Level 2 (Cards):** Card Color (#1e293b) at 70% opacity with a `20px` backdrop-blur. 
4.  **Level 3 (Pop-ups/Modals):** Card Color at 90% opacity with a `1px` solid border using a `white/10%` stroke to catch "light" edges.

**Interaction Depth:** Elements that are focused or hovered should increase their border-opacity and add a subtle `0 0 15px` glow using the Primary color.

## Shapes
The shape language is **Modern Rounded**. A base radius of `0.5rem` (8px) is applied to all standard components (buttons, inputs, cards). 

- **Progress Tracks:** Use fully rounded (pill-shaped) ends to feel more organic and "game-like."
- **Badges/XP Chips:** Use the `rounded-lg` (16px) setting to differentiate them from functional inputs.
- **Borders:** Use thin, 1px strokes. Avoid thick borders; the depth should be carried by the backdrop-blur and color contrast.

## Components
### Buttons
- **Primary:** Solid Neon Blue background, Sora SemiBold text, 15px outer glow on hover.
- **Secondary:** Transparent background with a 1px Blue border and soft backdrop blur.

### Inputs
- **Floating Fields:** Background is `transparent`, border is `white/20%`. On focus, the border transitions to `Primary Blue` and the internal background gains a subtle gradient.
- **Labels:** Labels float above the border line when active, rendered in `label-sm`.

### Cards & Progress
- **Glass Cards:** Must include `backdrop-filter: blur(20px)`.
- **XP Bars:** The track is a dark neutral; the fill is a horizontal gradient from `Primary Blue` to a slightly lighter cyan. Add a "scanning" light animation that travels across the bar every 5 seconds.

### Gamification Elements
- **Badges:** Circular containers with a glass effect and a central icon. Use an inner glow to make the icon appear "powered on."
- **Timer:** High-contrast Sora font. When time is < 5:00, the text color transitions to `Danger Red` with a slow pulse animation.