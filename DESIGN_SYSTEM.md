# Creative Library - Design System Documentation

## 📐 Architecture Overview

This document outlines the complete design system and UI architecture of the Creative Library application. Use this as your reference when planning UI changes.

---

## 🎯 Core Files Structure

### Root Entry Point
```
frontend/
├── public/
│   └── index.html          # HTML template (title, meta tags)
├── src/
│   ├── index.tsx           # React app entry point
│   ├── index.css           # Global CSS & design tokens
│   ├── App.tsx             # Root component & routing
│   └── tailwind.config.js  # Tailwind CSS configuration
```

---

## 🎨 Design Token System

### Location: `/frontend/src/index.css`

The entire design system uses **CSS Custom Properties (variables)** defined in `index.css`. All colors, spacing, shadows, and fonts are tokenized.

### Light Mode Colors (`:root`)
```css
:root {
  /* Background & Foreground */
  --background: oklch(0.9755 0.0045 258.3245);      /* Light gray background */
  --foreground: oklch(0.2558 0.0433 268.0662);      /* Dark text */

  /* Card */
  --card: oklch(0.9341 0.0132 251.5628);
  --card-foreground: oklch(0.2558 0.0433 268.0662);

  /* Primary Color (Blue) */
  --primary: oklch(0.4815 0.1178 263.3758);
  --primary-foreground: oklch(0.9856 0.0278 98.0540);

  /* Secondary Color (Yellow) */
  --secondary: oklch(0.8567 0.1164 81.0092);
  --secondary-foreground: oklch(0.2558 0.0433 268.0662);

  /* Muted */
  --muted: oklch(0.9202 0.0080 106.5563);
  --muted-foreground: oklch(0.4815 0.1178 263.3758);

  /* Accent */
  --accent: oklch(0.6896 0.0714 234.0387);
  --accent-foreground: oklch(0.9856 0.0278 98.0540);

  /* Destructive (Red) */
  --destructive: oklch(0.2611 0.0376 322.5267);
  --destructive-foreground: oklch(0.9856 0.0278 98.0540);

  /* Border & Input */
  --border: oklch(0.7791 0.0156 251.1926);
  --input: oklch(0.6896 0.0714 234.0387);
  --ring: oklch(0.8567 0.1164 81.0092);

  /* Sidebar Specific */
  --sidebar: oklch(0.9341 0.0132 251.5628);
  --sidebar-foreground: oklch(0.2558 0.0433 268.0662);
  --sidebar-primary: oklch(0.4815 0.1178 263.3758);
  --sidebar-border: oklch(0.7791 0.0156 251.1926);

  /* Typography */
  --font-sans: Actor, ui-sans-serif, sans-serif, system-ui;

  /* Border Radius */
  --radius: 0.5rem;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* Shadows */
  --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
  --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10);
  --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 4px 6px -1px hsl(0 0% 0% / 0.10);
  --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10);
  --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
}
```

### Dark Mode Colors (`.dark`)
```css
.dark {
  --background: oklch(0.2204 0.0198 275.8439);      /* Dark background */
  --foreground: oklch(0.9366 0.0129 266.6974);      /* Light text */
  --card: oklch(0.2703 0.0407 281.3036);
  --primary: oklch(0.4815 0.1178 263.3758);         /* Same blue */
  --secondary: oklch(0.9097 0.1440 95.1120);        /* Lighter yellow */
  --destructive: oklch(0.5280 0.1200 357.1130);     /* Brighter red */
  /* ... other dark mode colors */
}
```

---

## 🎭 Tailwind CSS Configuration

### Location: `/frontend/tailwind.config.js`

Tailwind is configured to use the CSS variables defined in `index.css`:

```javascript
module.exports = {
  darkMode: 'class',  // Dark mode toggled via class on <html>
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        // ... more color mappings
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      boxShadow: {
        '2xs': 'var(--shadow-2xs)',
        xs: 'var(--shadow-xs)',
        // ... shadow mappings
      }
    }
  }
}
```

**Usage in Components:**
```tsx
<div className="bg-background text-foreground border border-border rounded-lg shadow-md">
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Click me
  </button>
</div>
```

---

## 🏗️ Layout Architecture

### 1. Root HTML Template
**File:** `/frontend/public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### 2. React Entry Point
**File:** `/frontend/src/index.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';  // ← Imports global CSS and design tokens
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 3. App Root Component
**File:** `/frontend/src/App.tsx`

```tsx
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>  {/* Auth context wrapper */}
        <AppRoutes />   {/* All route definitions */}
      </AuthProvider>
    </BrowserRouter>
  );
}
```

**Routes Structure:**
- `/login` → LoginPage
- `/` → DashboardPage (wrapped in DashboardLayout)
- `/media` → MediaLibraryPage (wrapped in DashboardLayout)
- `/analytics` → AnalyticsPage (admin only)
- `/settings` → UserSettingsPage
- `/s/:token` → PublicLinkPage (no auth required)

### 4. Dashboard Layout
**File:** `/frontend/src/components/layout/DashboardLayout.tsx`

```tsx
export function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />  {/* Fixed left sidebar */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="container mx-auto p-6">
          {children}  {/* Page content */}
        </div>
      </main>
    </div>
  );
}
```

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Sidebar (256px) │  Main Content     │
│                 │                    │
│ • Dashboard     │  Page content      │
│ • Media Library │  rendered here     │
│ • Teams         │                    │
│ • Analytics     │                    │
│ • Settings      │                    │
│                 │                    │
└─────────────────────────────────────┘
```

### 5. Sidebar Component
**File:** `/frontend/src/components/layout/Sidebar.tsx`

**Key Features:**
- 256px fixed width (`w-64`)
- Full height (`h-full`)
- Light mode: `bg-sidebar` (light gray)
- Dark mode: `bg-sidebar` (dark gray)
- Border right: `border-r border-sidebar-border`

**Navigation Structure:**
```tsx
const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Media Library', href: '/media', icon: Image },
  { name: 'File Requests', href: '/file-requests', icon: Inbox },
  { name: 'Starred', href: '/starred', icon: Star },
  { name: 'Recents', href: '/recents', icon: Clock },
  { name: 'Shared with me', href: '/shared-with-me', icon: UserCheck },
  { name: 'Trash', href: '/trash', icon: Trash2 },
  { name: 'Shared by You', href: '/shared-by-me', icon: Share2 },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Settings', href: '/settings', icon: User },
];

const adminOnlyNavigation = [
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Editors', href: '/editors', icon: Users },
  { name: 'Workload', href: '/workload', icon: BarChart3 },
  { name: 'Metadata Extraction', href: '/metadata', icon: Tags },
];
```

**Active State Styling:**
```tsx
isActive(href)
  ? "bg-sidebar-accent text-sidebar-accent-foreground"  // Blue background
  : "text-sidebar-foreground hover:bg-sidebar-accent/50" // Hover effect
```

---

## 🧩 Reusable UI Components

### Location: `/frontend/src/components/ui/`

### Button Component
**File:** `Button.tsx`

```tsx
<Button variant="default" size="default">Click me</Button>
```

**Variants:**
- `default` - Blue background (`bg-primary`)
- `destructive` - Red background (`bg-destructive`)
- `outline` - Border only (`border border-input`)
- `secondary` - Yellow background (`bg-secondary`)
- `ghost` - No background, hover effect only

**Sizes:**
- `default` - h-10 px-4
- `sm` - h-9 px-3
- `lg` - h-11 px-8

### Card Component
**File:** `Card.tsx`

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>Footer actions</CardFooter>
</Card>
```

**Styling:**
- Background: `bg-card`
- Border: `border`
- Shadow: `shadow-sm`
- Rounded: `rounded-lg`

### Input Component
**File:** `Input.tsx`

```tsx
<Input type="text" placeholder="Enter text" />
```

**Styling:**
- Background: `bg-background`
- Border: `border border-input`
- Focus ring: `focus:ring-2 focus:ring-ring`

---

## 🎨 Color System Breakdown

### Primary Colors (Blue)
Used for: Primary actions, links, active states
- Light mode: `oklch(0.4815 0.1178 263.3758)` - Medium blue
- Dark mode: Same
- Tailwind class: `bg-primary`, `text-primary`

### Secondary Colors (Yellow)
Used for: Secondary actions, highlights
- Light mode: `oklch(0.8567 0.1164 81.0092)` - Bright yellow
- Dark mode: `oklch(0.9097 0.1440 95.1120)` - Lighter yellow
- Tailwind class: `bg-secondary`, `text-secondary`

### Destructive Colors (Red)
Used for: Delete buttons, error states
- Light mode: `oklch(0.2611 0.0376 322.5267)` - Dark red
- Dark mode: `oklch(0.5280 0.1200 357.1130)` - Bright red
- Tailwind class: `bg-destructive`, `text-destructive`

### Slack Integration Colors (Purple)
Used for: Slack-specific features
- Tailwind: `bg-purple-600`, `text-purple-600`
- Used in ShareDialog Slack tab

---

## 📱 Responsive Design

### Breakpoints (Tailwind default)
```css
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large */
2xl: 1536px /* 2X large */
```

### Usage:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

---

## 🌓 Dark Mode Implementation

### Toggle Method
Dark mode is controlled by adding/removing the `dark` class on the `<html>` element:

```tsx
// Enable dark mode
document.documentElement.classList.add('dark');

// Disable dark mode
document.documentElement.classList.remove('dark');
```

### CSS Variables Update
When `.dark` class is added, all CSS variables automatically update to dark mode values defined in `index.css`.

### Component Usage
```tsx
<div className="bg-background dark:bg-background">
  {/* Background automatically adjusts via CSS variable */}
</div>

<div className="bg-white dark:bg-gray-800">
  {/* Explicit dark mode override */}
</div>
```

---

## 🔧 Utility Functions

### Location: `/frontend/src/lib/utils.ts`

### `cn()` - Class Name Merger
Combines Tailwind classes intelligently:

```tsx
import { cn } from '../lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  'override-class'
)}>
```

Uses `clsx` + `tailwind-merge` to handle conflicts properly.

### Other Utilities
```tsx
formatBytes(1024)          // "1 KB"
formatDate('2024-01-01')   // "Jan 1, 2024"
formatNumber(1000000)      // "1,000,000"
```

---

## 📦 Component Pattern Examples

### Modal/Dialog Pattern
```tsx
{isOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-card rounded-lg w-full max-w-lg p-6">
      {/* Modal content */}
    </div>
  </div>
)}
```

### Loading State Pattern
```tsx
{loading ? (
  <div className="flex items-center justify-center h-32">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
) : (
  /* Content */
)}
```

### Error State Pattern
```tsx
{error && (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
  </div>
)}
```

### Success State Pattern
```tsx
{success && (
  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
    <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
  </div>
)}
```

---

## 🎯 Key Design Decisions

### 1. **CSS Variables for Theme Tokens**
   - **Why:** Easy theme switching, centralized control
   - **How:** All colors/sizes defined in `:root` and `.dark`

### 2. **Tailwind CSS for Styling**
   - **Why:** Rapid development, consistent spacing
   - **How:** Configured to use CSS variables

### 3. **OKLCH Color Space**
   - **Why:** Better perceptual uniformity than RGB/HSL
   - **How:** All colors defined in `oklch()` format

### 4. **Component-Based UI Library**
   - **Why:** Reusability, consistency
   - **Location:** `src/components/ui/`

### 5. **Layout-Content Separation**
   - **Why:** DRY principle, consistent structure
   - **How:** DashboardLayout wraps all authenticated pages

---

## 🚀 How to Customize the UI

### Changing Colors

**1. Update CSS Variables in `index.css`:**
```css
:root {
  --primary: oklch(0.5 0.2 200);  /* New blue */
}
```

**2. Colors automatically propagate everywhere:**
- Tailwind classes (`bg-primary`)
- Components (Button, Card, etc.)
- All pages using the color

### Changing Typography

**1. Update font in `index.css`:**
```css
:root {
  --font-sans: 'Inter', ui-sans-serif, sans-serif;
}
```

**2. Import font in `index.html`:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Changing Border Radius

```css
:root {
  --radius: 1rem;  /* More rounded */
}
```

### Changing Shadows

```css
:root {
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.2);  /* Stronger shadow */
}
```

### Changing Layout

**Sidebar width:** Edit `Sidebar.tsx`
```tsx
<div className="w-64">  {/* Change to w-72 for wider */}
```

**Container max width:** Edit `DashboardLayout.tsx`
```tsx
<div className="container mx-auto max-w-7xl p-6">
```

---

## 📚 Reference Quick Links

| File | Purpose | Key Contents |
|------|---------|--------------|
| `index.css` | Design tokens | Colors, fonts, shadows, radius |
| `tailwind.config.js` | Tailwind setup | Color mappings, breakpoints |
| `App.tsx` | Routing | All page routes |
| `DashboardLayout.tsx` | Main layout | Sidebar + content structure |
| `Sidebar.tsx` | Navigation | Menu items, icons |
| `Button.tsx` | Button component | Variants, sizes |
| `Card.tsx` | Card component | Card structure |
| `utils.ts` | Helper functions | `cn()`, formatters |

---

## 🎨 Color Palette Visual Reference

### Light Mode
- **Background:** Very light gray (#F5F5F7)
- **Text:** Dark gray (#1D1D1F)
- **Primary:** Blue (#4A5FDB)
- **Secondary:** Yellow (#E8C547)
- **Destructive:** Dark Red (#4A1C1C)
- **Border:** Light gray (#C5C7D0)

### Dark Mode
- **Background:** Very dark blue-gray (#1A1B2E)
- **Text:** Off-white (#EBEBF0)
- **Primary:** Blue (#4A5FDB) - same
- **Secondary:** Bright yellow (#F0DE6F)
- **Destructive:** Bright red (#D64747)
- **Border:** Medium gray (#3E4057)

---

## 📝 Notes for UI Redesign

1. **Start with `index.css`** - Change color tokens first
2. **Test dark mode** - Make sure both themes look good
3. **Update reusable components** - Button, Card styling
4. **Check responsive design** - Test on mobile/tablet/desktop
5. **Maintain accessibility** - Keep contrast ratios compliant
6. **Document changes** - Update this file with new tokens

---

**Last Updated:** January 2026
**Version:** 1.0
**Maintainer:** Creative Library Team
