# Visual GDScript Generator

## Overview

A web-based visual code generator for Godot 4.4 that helps developers create GDScript code through multiple interfaces: AI-powered generation, visual block sequencing, node-based API exploration, signal connections, multiplayer/RPC setup, pre-built templates, and particle system generation. The tool bridges the gap between visual programming (like Scratch) and Godot's scripting needs, making it easier to generate valid, working GDScript without writing code from scratch.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**Routing**: Wouter for lightweight client-side routing with a single main page (Home) and a 404 fallback.

**UI Component System**: Shadcn/ui (New York style) with Radix UI primitives for accessible, composable components. The design follows Material Design 3 principles combined with VS Code interface patterns for a familiar developer experience optimized for productivity tools.

**State Management**: TanStack Query (React Query) for server state management with aggressive caching (staleTime: Infinity) and disabled automatic refetching. Local component state via React hooks for UI interactions.

**Styling**: Tailwind CSS with custom design tokens defined in CSS variables for theming (dark/light mode support). Typography uses Inter for UI and JetBrains Mono for code display.

**Layout Strategy**: Tab-based navigation with fixed left sidebar (64px width), flexible center workspace panel, and conditional right panel (384px width) for code output. The interface uses a horizontal split layout optimized for information density.

### Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript, serving both API endpoints and static client assets.

**Build Process**: Dual build system - Vite for client bundling and esbuild for server bundling. The server bundle uses selective dependency inclusion (allowlist) to reduce cold start times by minimizing file system calls.

**API Design**: RESTful JSON API with two primary endpoints:
- `/api/ai/generate` - AI code generation using Gemini or Groq
- `/api/sequence/generate` - Visual block sequence to GDScript conversion

**Code Generation Logic**: 
- Server-side code generators (`code-generator.ts`) transform structured block sequences into valid GDScript
- AI integrations (`gemini.ts`, `groq.ts`) use provider-specific APIs with system prompts tuned for Godot 4.4 best practices
- Template system with variable interpolation for pre-built script generation

**Request Validation**: Zod schemas (defined in shared directory) validate all API requests and enforce type safety across client-server boundary.

### Data Storage Solutions

**Current Implementation**: In-memory storage using Map data structures (`MemStorage` class) for user data. This is a placeholder implementation suitable for development.

**Database Ready**: Drizzle ORM configured with PostgreSQL dialect, ready to connect to a database when `DATABASE_URL` environment variable is provided. Schema definitions exist in `shared/schema.ts`.

**Session Management**: Infrastructure in place for express-session with PostgreSQL store (`connect-pg-simple`) - currently unused but configured.

### External Dependencies

**AI Service Integrations**:
- **Google Gemini AI**: Using `@google/genai` SDK with models `gemini-2.5-flash` and `gemini-2.5-pro`. Requires `GEMINI_API_KEY` environment variable.
- **Groq**: HTTP API integration via fetch with models including `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, and `mixtral-8x7b-32768`. Requires `GROQ_API_KEY` environment variable.

Both AI integrations use carefully crafted system prompts that enforce Godot 4.4 best practices, including proper type hints, modern API usage, and code simplicity.

**Database**: 
- PostgreSQL via Neon serverless driver (`@neondatabase/serverless`)
- Drizzle ORM for type-safe database queries
- Migration system configured via `drizzle.config.ts`

**Godot API Integration**: Static data structures containing Godot 4.4 node definitions, properties, methods, and signals. The application includes 141 nodes across 9 categories with comprehensive API information sourced from official Godot documentation.

**Development Tools**:
- Replit-specific plugins for error overlays, cartographer, and dev banners (only in non-production Replit environments)
- Source map support via `@jridgewell/trace-mapping`

**UI Component Libraries**:
- Radix UI primitives for 20+ accessible component patterns
- Lucide React for consistent iconography
- CMDK for command palette functionality
- React Day Picker for calendar/date inputs

### Application Features

**Eight Main Panels** ✅ (3 Complete):
1. ✅ **AI Mode** - Free-form text-to-code generation with Gemini/Groq provider selection, model picker, and prompt history
2. ✅ **Sequencer** - Drag-and-drop visual block programming with 6 trigger types, 10+ action blocks, and real-time code output
3. ✅ **Scratch Blocks** - Scratch-style visual block builder with AI-powered Godot 4.4 code generation, node type selection (AnimationPlayer, AnimatedSprite2D, Label, AudioStreamPlayer, etc.), block tooltips, Save/Load/Export sequences
4. ⏳ **Nodes** - Browse all 141 Godot nodes with API details and code generation
5. ⏳ **Signals** - Configure signal connections between nodes with parameter mapping
6. ⏳ **Multiplayer** - RPC function generator with mode, transfer type, and channel configuration
7. ⏳ **Templates** - Pre-built scripts (enemy AI, player controllers, vehicles, combat systems) with variable customization
8. ⏳ **Particles** - Particle system presets (fire, smoke, explosions, etc.) with parameter tuning

**Scratch Blocks Features** (Completed):
- 12 block types: Key Input, Movement, Animation, Label, Wait, Sound, Condition, Loop, Property, Sprite, Particles, Debug Print
- AI-powered code generation with proper function nesting (_ready, _input, _process)
- Node type selection for each block (AnimationPlayer vs AnimatedSprite2D, Label vs Label3D, etc)
- Block descriptions with hover tooltips (info icon)
- Save sequences to browser localStorage
- Load previously saved sequences
- Export sequences as JSON for sharing/backup
- Clear all blocks
- Up/Down arrows to reorder blocks
- Real-time Gemini-powered code generation respecting exact block sequence

**Code Generation Philosophy**: All generators prioritize simple, readable GDScript over complex solutions. Code includes type hints, modern Godot 4.4 syntax, appropriate annotations (@export, @onready), and brief explanatory comments.

**Built-in Function Selection**: Users can target different Godot lifecycle functions (_ready, _process, _physics_process, _input, etc.) for generated code placement.