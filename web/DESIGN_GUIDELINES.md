# Clinic App - Design Guidelines & Aesthetics

This document serves as the single source of truth for the visual identity and UI/UX patterns of the Clinic Scheduling System. Any future pages, components, or features must strictly adhere to these guidelines to ensure a cohesive, premium, and professional aesthetic.

## 1. Core Principles

- **Premium & Minimalist**: Favour whitespace (padding/margins) over dividing lines.
- **Glassmorphism**: Use subtle translucent backgrounds with blur effects for overlays, modals, and floating cards.
- **Accessibility**: Ensure high contrast for text. Use subtle colors for decorative elements.

## 2. Typography

- **Primary Font**: `Inter` (or `Geist`).
- **Headings**: Clean, high contrast (`text-zinc-900` in light mode, `text-zinc-50` in dark mode). Tracking should be slightly tight (`tracking-tight`) for H1/H2.
- **Body Text**: Legible and softer (`text-zinc-600` in light mode, `text-zinc-400` in dark mode).

## 3. Color Palette (Strictly Enforced)

To maintain visual consistency across all pages (Booking, Dashboard, Settings, etc.), we use a unified single primary accent color.

- **Primary Brand Color (Accent)**: **Indigo 600** (HEX: `#4F46E5`)
  - _Usage_: Call To Action (CTA) buttons, active active tabs, selected states, checkboxes, and primary links.
  - _Hover State_: `hover:bg-indigo-700`
  - _Focus Ring_: `focus:ring-indigo-500`

- **Backgrounds (Neutrals)**: **Zinc / Slate**
  - _App Background (Light)_: `bg-zinc-50`
  - _App Background (Dark)_: `bg-zinc-950`
  - _Cards/Containers (Light)_: `bg-white`
  - _Cards/Containers (Dark)_: `bg-zinc-900`

- **Status Colors (Pills & Badges)**:
  - _Success / Confirmed_: Soft Emerald (`bg-emerald-50 text-emerald-700` | border: `border-emerald-200`)
  - _Pending / Warning_: Soft Amber (`bg-amber-50 text-amber-700` | border: `border-amber-200`)
  - _Cancelled / Destructive_: Soft Red / Rose (`bg-rose-50 text-rose-700` | border: `border-rose-200`)
  - _Completed_: Soft Blue (`bg-blue-50 text-blue-700` | border: `border-blue-200`)

## 4. Components & Interactions

- **Borders**: Extremely subtle. Use `border-zinc-200` (Light) and `border-zinc-800` (Dark).
- **Border Radius**: Use rounded corners standard `rounded-md` (6px) to `rounded-lg` (8px). Avoid overly pill-shaped buttons unless it's a specific badge.
- **Animations**: All interactive elements (buttons, rows, cards) must have smooth transitions. Use Tailwind's default `transition-all duration-200 ease-in-out`.
- **Shadows**: Use very soft shadows. Avoid harsh drop shadows. `shadow-sm` for standard cards, `shadow-lg` for modals.

## 5. Layout Structures (Desktop-First)

- **Public Interfaces**: Max-width containers (`max-w-7xl`, `mx-auto`) to keep content centered on ultra-wide monitors. Let the background bleed.
- **Admin Dashboard**: Permanent left-sidebar (`w-64`) with the main content area taking the remaining width (`flex-1`).
- **Data Tables**: Full-width, clean headers, right-aligned action buttons.

> **AI Instruction for Future Devs**: Whenever asked to build or refactor a UI component in this project, load this `.md` file first and extract the color variables and aesthetic rules before writing the HTML/Tailwind classes.
