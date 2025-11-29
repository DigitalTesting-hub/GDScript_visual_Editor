import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info, BookOpen, Lightbulb } from "lucide-react";

interface AppHeaderProps {
  onLearnClick?: () => void;
  onDocsClick?: () => void;
}

export function AppHeader({ onLearnClick, onDocsClick }: AppHeaderProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3 h-16">
          <div>
            <h1 className="text-lg font-bold text-primary">Visual GDScript Generator</h1>
            <p className="text-xs text-muted-foreground">Godot 4.4 Code Generation Tool</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLearnClick}
              className="gap-2"
              data-testid="button-learn-gdscript"
            >
              <Lightbulb className="h-4 w-4" />
              Learn GDScript
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDocsClick}
              className="gap-2"
              data-testid="button-godot-docs"
            >
              <BookOpen className="h-4 w-4" />
              Godot Docs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGuideOpen(true)}
              className="gap-2"
              data-testid="button-user-guide"
            >
              <BookOpen className="h-4 w-4" />
              User Guide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAboutOpen(true)}
              className="gap-2"
              data-testid="button-about"
            >
              <Info className="h-4 w-4" />
              About
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* About Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-about">
          <DialogHeader>
            <DialogTitle>About Visual GDScript Generator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">What is this?</h3>
              <p className="text-sm text-muted-foreground">
                A web-based visual code generator for Godot 4.4 that helps developers create GDScript code through multiple interfaces: AI-powered generation, visual block sequencing, node-based API exploration, signal connections, multiplayer/RPC setup, pre-built templates, and particle system generation.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Key Features</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✨ AI-Powered Code Generation (Gemini & Groq)</li>
                <li>🧩 Visual Scratch-style Block Builder</li>
                <li>📚 Godot 4.4 API Browser (141+ nodes)</li>
                <li>🔌 Signal Connection Designer</li>
                <li>🎮 Multiplayer/RPC Generator</li>
                <li>📄 Pre-built Script Templates</li>
                <li>🎆 Particle System Creator</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Developed by</h3>
              <p className="text-sm">
                <span className="font-medium">Sanjay Meher</span>
              </p>
              <p className="text-sm text-primary hover:underline cursor-pointer">
                <a href="https://www.youtube.com/@Champ_gaming" target="_blank" rel="noopener noreferrer">
                  YouTube: Champ Gaming
                </a>
              </p>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-4">
              <p>Built with React, TypeScript, Tailwind CSS, and Express.js</p>
              <p>Powered by Google Gemini AI and Groq API</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Guide Dialog */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]" data-testid="dialog-user-guide">
          <DialogHeader>
            <DialogTitle>User Guide - How to Use This App</DialogTitle>
            <DialogDescription>
              Complete guide for each tab and feature
            </DialogDescription>
          </DialogHeader>

          <div className="h-[calc(85vh-140px)] overflow-y-auto pr-4">
            <div className="space-y-6">
              {/* AI Mode */}
              <div>
                <h3 className="font-semibold mb-2 text-base">✨ AI Mode</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Generate GDScript code using natural language prompts powered by AI.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Select AI provider: <span className="font-medium">Gemini</span> or <span className="font-medium">Groq</span></li>
                  <li>• Choose a model from dropdown</li>
                  <li>• Type your request (e.g., "create a player controller with jump")</li>
                  <li>• Click <span className="font-medium">Generate</span> to create code</li>
                  <li>• View history and copy generated code</li>
                </ul>
              </div>

              {/* Sequencer */}
              <div>
                <h3 className="font-semibold mb-2 text-base">📊 Sequencer</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Build game logic by connecting trigger and action blocks visually with 3 code output modes.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <span className="font-medium">Code Output Mode:</span> Choose how to wrap generated code:</li>
                  <li className="ml-4">→ Built-in Function (_ready, _process, _input, etc.)</li>
                  <li className="ml-4">→ Custom Function (define your own function name)</li>
                  <li className="ml-4">→ Signal Emission (emit custom signals with code)</li>
                  <li>• Select triggers (OnReady, OnProcess, OnInput, OnCollision, OnTimer, OnCustom)</li>
                  <li>• Add action blocks (Move, Rotate, Play Animation, Emit Sound, etc.)</li>
                  <li>• Configure each block with parameters</li>
                  <li>• See real-time code generation on the right</li>
                  <li>• Copy or export the generated sequence</li>
                </ul>
              </div>

              {/* Scratch Blocks */}
              <div>
                <h3 className="font-semibold mb-2 text-base">🧩 Scratch Blocks</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Visual drag-and-drop block builder similar to Scratch.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• 12 block types: Key Input, Movement, Animation, Label, Wait, Sound, etc.</li>
                  <li>• Select node types for each block (AnimationPlayer, Sprite2D, Label, etc.)</li>
                  <li>• Drag blocks to reorder using up/down arrows</li>
                  <li>• AI generates code respecting exact block sequence</li>
                  <li>• Save sequences to browser, load, or export as JSON</li>
                </ul>
              </div>

              {/* Node API */}
              <div>
                <h3 className="font-semibold mb-2 text-base">⚡ Node API Browser</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Browse all 141 Godot 4.4 nodes with complete API documentation.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Search for nodes by name</li>
                  <li>• View properties, methods, and signals</li>
                  <li>• Read descriptions and usage examples</li>
                  <li>• Generate code snippets for selected nodes</li>
                </ul>
              </div>

              {/* Signals */}
              <div>
                <h3 className="font-semibold mb-2 text-base">📡 Signals</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Connect signals between nodes with parameter mapping.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Select emitter node and signal</li>
                  <li>• Choose receiver node and callback function</li>
                  <li>• Map signal parameters to function parameters</li>
                  <li>• Generate connection code automatically</li>
                </ul>
              </div>

              {/* Multiplayer */}
              <div>
                <h3 className="font-semibold mb-2 text-base">👥 Multiplayer RPC</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Generate RPC function code for multiplayer games.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Set RPC mode (any_peer, authority)</li>
                  <li>• Choose transfer type (reliable, unreliable)</li>
                  <li>• Configure channel and call_local settings</li>
                  <li>• Define function parameters and generate code</li>
                </ul>
              </div>

              {/* Scripts */}
              <div>
                <h3 className="font-semibold mb-2 text-base">📄 Pre-built Script Templates</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  27 ready-to-use templates across 6 categories.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <span className="font-medium">Enemy AI:</span> Enemy behavior patterns</li>
                  <li>• <span className="font-medium">Player:</span> Controllers and cameras</li>
                  <li>• <span className="font-medium">Vehicles:</span> Car/bike mechanics</li>
                  <li>• <span className="font-medium">Combat:</span> Damage systems</li>
                  <li>• <span className="font-medium">Multiplayer:</span> Network systems</li>
                  <li>• <span className="font-medium">UI:</span> Menu and HUD templates</li>
                </ul>
              </div>

              {/* Particles */}
              <div>
                <h3 className="font-semibold mb-2 text-base">🎆 Particles</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Create and customize particle effects (Fire, Smoke, Explosions, etc.).
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Select particle preset (Fire, Smoke, Dust, Blood, etc.)</li>
                  <li>• Customize parameters (amount, lifetime, velocity, color)</li>
                  <li>• Preview effect settings</li>
                  <li>• Generate CPUParticles2D/3D code</li>
                </ul>
              </div>

              {/* Functions */}
              <div>
                <h3 className="font-semibold mb-2 text-base">🪄 Functions Tab</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Extract functions from scripts and regenerate them with AI.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Upload a .gd file or select from templates</li>
                  <li>• Parser automatically extracts all functions</li>
                  <li>• Multi-select functions you want to keep</li>
                  <li>• Use AI to regenerate with improvements</li>
                  <li>• Configure variables and generate optimized code</li>
                </ul>
              </div>

              {/* Scene Gen */}
              <div>
                <h3 className="font-semibold mb-2 text-base">📦 Scene Generator</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Convert GDScript to .tscn (Godot scene) format.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Upload a GDScript file or paste code</li>
                  <li>• Parser extracts node hierarchy and properties</li>
                  <li>• Generate valid .tscn scene structure</li>
                  <li>• Copy scene code for use in Godot editor</li>
                </ul>
              </div>

              {/* Node Inspector */}
              <div>
                <h3 className="font-semibold mb-2 text-base">🔍 Node Inspector</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Analyze Godot scene screenshots with AI to detect nodes and generate initialization code.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Upload a screenshot of your Godot scene</li>
                  <li>• AI analyzes the image to detect nodes and hierarchy</li>
                  <li>• View detected nodes with types and variable names</li>
                  <li>• Generate @onready variable declarations and initialization code</li>
                  <li>• Copy the generated code directly into your script</li>
                </ul>
              </div>

              {/* Code Analyzer */}
              <div>
                <h3 className="font-semibold mb-2 text-base">⚙️ Code Analyzer</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Real-time analysis of GDScript code with suggestions and improvements.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Paste or write GDScript code in the editor (left 75%)</li>
                  <li>• Get instant analysis results (right 25%)</li>
                  <li>• View errors, warnings, and optimization suggestions</li>
                  <li>• Identify issues with type hints, syntax, and best practices</li>
                  <li>• Learn from suggestions to improve your code</li>
                </ul>
              </div>

              {/* Code Debugger */}
              <div>
                <h3 className="font-semibold mb-2 text-base">🐛 Code Debugger</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Debug GDScript code using error logs and error screenshots with AI analysis.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Paste GDScript code in the editor (left side)</li>
                  <li>• Enter error message or upload error screenshot (right side)</li>
                  <li>• AI extracts error details from text or image (uses Gemini Vision)</li>
                  <li>• Get AI-powered suggestions for fixing the error</li>
                  <li>• Understand root cause and recommended solutions</li>
                </ul>
              </div>

              {/* Learn GDScript */}
              <div>
                <h3 className="font-semibold mb-2 text-base">📚 Learn GDScript</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Interactive GDScript tutorial and reference guide.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Click the "Learn GDScript" button in the header</li>
                  <li>• Access comprehensive tutorial for GDScript basics</li>
                  <li>• Learn syntax, variables, functions, and game development patterns</li>
                  <li>• Ideal for beginners and those new to GDScript</li>
                </ul>
              </div>

              {/* Tips */}
              <div className="bg-muted p-3 rounded-lg">
                <h3 className="font-semibold mb-2 text-base">💡 Pro Tips</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• All generated code includes type hints and modern Godot 4.4 syntax</li>
                  <li>• Use multiple tabs together for complex systems</li>
                  <li>• Save your sequences and templates for reuse</li>
                  <li>• Copy code and paste directly into Godot editor</li>
                  <li>• Experiment with AI models - Gemini is faster, Groq is very accurate</li>
                </ul>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
