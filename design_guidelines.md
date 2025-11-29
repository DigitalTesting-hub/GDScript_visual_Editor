# Visual GDScript Generator - Design Guidelines

## Design Approach

**Selected System:** Material Design 3 + VS Code Interface Patterns
**Justification:** Productivity tool requiring information density, clear hierarchy, and familiar developer experience. Combines Material's structured component system with VS Code's proven code editor patterns.

**Key Principles:**
1. Information density over visual flair
2. Clear functional zones with consistent navigation
3. Optimized for keyboard shortcuts and rapid workflows
4. Progressive disclosure for complex features

## Typography System

**Font Stack:** 
- UI Text: Inter (Google Fonts) - weights 400, 500, 600
- Code/Monospace: JetBrains Mono - weight 400

**Hierarchy:**
- H1: text-2xl font-semibold (Tab headers, main sections)
- H2: text-lg font-medium (Panel titles, subsections)
- H3: text-base font-medium (Component labels, groups)
- Body: text-sm font-normal (General content, descriptions)
- Code: text-sm font-mono (Generated code, API examples)
- Labels: text-xs font-medium uppercase tracking-wide (Input labels, categories)

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 3, 4, 6, 8
- Component padding: p-4
- Section spacing: space-y-4 or gap-4
- Tight spacing: gap-2
- Large sections: p-6 or p-8

**Grid Structure:**
```
Main Layout: Horizontal split
├─ Left Sidebar: w-64 (Navigation tabs, fixed)
├─ Center Panel: flex-1 (Primary workspace)
└─ Right Panel: w-96 (Context help, code output, conditional)
```

## Component Library

### Core Navigation
**Tab Sidebar** (Left, w-64, fixed):
- Vertical tab list with icons (Heroicons)
- Each tab: h-12, px-4, flex items-center gap-3
- Active state: distinguished styling
- Tabs: AI Mode, Sequencer, Nodes, Signals, Multiplayer, Templates, Particles

### Primary Workspace Panels

**AI Mode Panel:**
- Model selector dropdown (h-10, full-width)
- Textarea for prompts (min-h-32, resize-y)
- Action buttons: flex gap-2, h-10
- Code output: Monaco-style editor component, min-h-64

**Sequencer Builder:**
- Block container: min-h-screen, p-6
- Drag zones: border-2 border-dashed, min-h-24, p-4
- Block cards: rounded-lg, p-4, shadow-sm, draggable
- Block structure: Event trigger → Actions → Outputs (vertical stack, gap-3)
- Add block button: w-full, h-10, border-dashed

**Node Dropdown/API Explorer:**
- Category accordion: space-y-2
- Node list: grid grid-cols-1, gap-2
- Node card: p-3, cursor-pointer, hover:shadow
- Details panel (slide-in): Fixed right, w-96, p-6, overflow-y-auto
- Property inputs: space-y-3, each input h-10
- Generate button: sticky bottom-0, w-full, h-12

**Signal Interface:**
- Signal type tabs (horizontal): flex gap-2, mb-4
- Connection builder: grid md:grid-cols-2 gap-6
- Source/Target selectors: h-10 each
- Signal parameters: space-y-3

**Template Gallery:**
- Grid: grid md:grid-cols-2 lg:grid-cols-3 gap-4
- Template cards: aspect-video, p-4, rounded-lg
- Preview code: max-h-48, overflow-auto, text-xs
- Config panel: space-y-3, toggle switches + inputs

### Form Components
**Standard Input:** h-10, px-3, rounded-md, border, w-full
**Dropdown/Select:** h-10, px-3, appearance-none, custom arrow icon
**Checkbox/Toggle:** h-5 w-9 (toggle switch style)
**Textarea:** min-h-24, p-3, resize-y
**Number Input:** h-10, w-32, text-center

### Code Display
**Output Container:**
- Monaco editor integration (read-only mode)
- Line numbers enabled
- Syntax highlighting for GDScript
- Action bar: flex justify-between, h-10, px-4 (Copy/Edit/Clear buttons)

### Action Buttons
**Primary:** h-10, px-6, rounded-md, font-medium
**Secondary:** h-10, px-4, rounded-md, border
**Icon Button:** h-8 w-8, rounded, flex items-center justify-center

## Icons
**Library:** Heroicons (via CDN)
**Usage:**
- Navigation tabs: size-6
- Action buttons: size-5
- Inline labels: size-4
- Status indicators: size-3

## Layout Patterns

### Three-Panel Workspace
```
[Sidebar Nav] | [Main Content Area] | [Context/Output Panel]
   w-64       |      flex-1         |        w-96
```

### Two-Panel (when context not needed)
```
[Sidebar Nav] | [Full Workspace]
   w-64       |     flex-1
```

### Responsive Behavior
- Desktop (lg+): Full three-panel layout
- Tablet (md): Collapsible sidebar, two-panel
- Mobile (base): Single panel with hamburger nav

## Interaction Patterns

**Drag & Drop (Sequencer):**
- Draggable cards: cursor-move, active:opacity-50
- Drop zones: border-2 border-dashed, transition on drag-over

**Modals/Dialogs:**
- Overlay: fixed inset-0, backdrop-blur-sm
- Dialog: max-w-2xl, mx-auto, mt-20, rounded-lg, p-6
- Close button: absolute top-4 right-4

**Accordions:**
- Header: h-12, px-4, flex items-center justify-between
- Content: p-4, space-y-3, animate slide-down

**Code Generation Flow:**
1. Input configuration (forms/sequencer)
2. Generate button triggers
3. Loading state (h-10 with spinner)
4. Code appears in output panel
5. Action buttons (copy/edit/clear) enabled

## Accessibility

- All inputs: proper labels, aria-labels
- Keyboard navigation: tab order logical, focus visible
- Code editors: aria-live for updates
- Drag operations: keyboard alternatives
- Color-independent states (icons + text labels)

## Animations

**Minimal, Purposeful Only:**
- Panel slide-ins: transition-transform duration-200
- Accordion expand: transition-all duration-150
- Button feedback: transition-colors duration-100
- No decorative animations

## Critical UX Patterns

**Progressive Disclosure:**
- Default view: Clean, focused
- Advanced options: Collapsible sections
- Context help: Toggleable right panel

**Workflow Continuity:**
- Persistent code output visible during edits
- Undo/redo for sequencer
- Auto-save state to localStorage

**Developer-Friendly:**
- Keyboard shortcuts displayed
- Tooltips for complex features (hover: delay-300)
- Monospace fonts for all code/technical content