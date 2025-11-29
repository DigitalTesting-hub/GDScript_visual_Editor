import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AIModePanel } from "@/components/panels/ai-mode-panel";
import { SequencerPanel } from "@/components/panels/sequencer-panel";
import { VisualSequencerPanel } from "@/components/panels/visual-sequencer-panel";
import { NodesPanel } from "@/components/panels/nodes-panel";
import { SignalsPanel } from "@/components/panels/signals-panel";
import { MultiplayerPanel } from "@/components/panels/multiplayer-panel";
import { PreBuiltScriptsPanel } from "@/components/panels/prebuilt-scripts-panel";
import { ParticlesPanel } from "@/components/panels/particles-panel";
import { FunctionsPanel } from "@/components/panels/functions-panel";
import { SceneGeneratorPanel } from "@/components/panels/scene-generator-panel";
import { NodeInspectorPanel } from "@/components/panels/node-inspector-panel";
import { CodeAnalyzerPanel } from "@/components/panels/code-analyzer-panel";
import { CodeDebuggerPanel } from "@/components/panels/code-debugger-panel";
import { LearnGDScriptPanel } from "@/components/panels/learn-gdscript-panel";
import { GodotDocsPanel } from "@/components/panels/godot-docs-panel";
import {
  Sparkles,
  Layers,
  Radio,
  Users,
  FileCode,
  Flame,
  Menu,
  X,
  Code2,
  Zap,
  Blocks,
  Wand2,
  FileJson,
  Eye,
  Bug,
  BookMarked,
  BookOpen,
} from "lucide-react";

type TabId = "ai" | "sequencer" | "visual" | "nodelist" | "signals" | "multiplayer" | "prebuiltscripts" | "particles" | "functions" | "scenegen" | "nodeinspector" | "analyzer" | "debugger" | "learn" | "docs";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  { id: "ai", label: "AI Mode", icon: Sparkles, description: "Generate code with AI" },
  { id: "sequencer", label: "Sequencer", icon: Layers, description: "Build visual sequences" },
  { id: "visual", label: "Scratch Blocks", icon: Blocks, description: "Drag-drop visual blocks" },
  { id: "nodelist", label: "Node API", icon: Zap, description: "Godot 4.4 nodes" },
  { id: "signals", label: "Signals", icon: Radio, description: "Signal connections" },
  { id: "multiplayer", label: "Multiplayer", icon: Users, description: "RPC generation" },
  { id: "prebuiltscripts", label: "Scripts", icon: FileCode, description: "Pre-built templates" },
  { id: "particles", label: "Particles", icon: Flame, description: "Particle effects" },
  { id: "functions", label: "Functions", icon: Wand2, description: "Extract and regenerate functions" },
  { id: "scenegen", label: "Scene Gen", icon: FileJson, description: "Convert script to .tscn" },
  { id: "nodeinspector", label: "Node Inspector", icon: Eye, description: "Analyze node structure" },
  { id: "analyzer", label: "Code Analyzer", icon: Zap, description: "Realtime code analysis" },
  { id: "debugger", label: "Code Debugger", icon: Bug, description: "Debug with error logs" },
  { id: "learn", label: "Learn GDScript", icon: BookMarked, description: "Interactive tutorials" },
  { id: "docs", label: "Godot Docs", icon: BookOpen, description: "Official Godot 4.4 docs" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("particles");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderPanel = () => {
    switch (activeTab) {
      case "ai":
        return <AIModePanel />;
      case "sequencer":
        return <SequencerPanel />;
      case "visual":
        return <VisualSequencerPanel />;
      case "nodelist":
        return <NodesPanel />;
      case "signals":
        return <SignalsPanel />;
      case "multiplayer":
        return <MultiplayerPanel />;
      case "prebuiltscripts":
        return <PreBuiltScriptsPanel />;
      case "particles":
        return <ParticlesPanel />;
      case "functions":
        return <FunctionsPanel />;
      case "scenegen":
        return <SceneGeneratorPanel />;
      case "nodeinspector":
        return <NodeInspectorPanel />;
      case "analyzer":
        return <CodeAnalyzerPanel />;
      case "debugger":
        return <CodeDebuggerPanel />;
      case "learn":
        return <LearnGDScriptPanel />;
      case "docs":
        return <GodotDocsPanel />;
      default:
        return <ParticlesPanel />;
    }
  };

  const handleLearnClick = () => {
    setActiveTab("learn");
  };

  const handleDocsClick = () => {
    setActiveTab("docs");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader onLearnClick={handleLearnClick} onDocsClick={handleDocsClick} />
      <div className="flex flex-1 min-h-0">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0 md:w-16"
        } flex-shrink-0 border-r bg-sidebar transition-all duration-300 overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Code2 className="h-6 w-6 text-primary" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-sm truncate">GDScript Generator</h1>
                <p className="text-xs text-muted-foreground">Godot 4.4</p>
              </div>
            )}
          </div>

          <Separator />

          <ScrollArea className="flex-1 p-2">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-3 h-11 ${
                      !sidebarOpen ? "px-3" : ""
                    }`}
                    onClick={() => setActiveTab(item.id)}
                    data-testid={`nav-${item.id}`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <div className="flex-1 text-left min-w-0">
                        <span className="block text-sm font-medium truncate">
                          {item.label}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {item.description}
                        </span>
                      </div>
                    )}
                  </Button>
                );
              })}
            </nav>
          </ScrollArea>

          <Separator />

          <div className="p-3">
            {sidebarOpen ? (
              <div className="rounded-md bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    Pro Tip
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Use particles for VFX, AI mode for scripts, or sequencer for visual coding.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 h-14 px-4 border-b bg-card/50">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-toggle-sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div>
              <h2 className="font-semibold text-base">
                {navItems.find((item) => item.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {navItems.find((item) => item.id === activeTab)?.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden md:flex">
              Godot 4.4 Compatible
            </Badge>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {renderPanel()}
        </main>
      </div>
      </div>
    </div>
  );
}
