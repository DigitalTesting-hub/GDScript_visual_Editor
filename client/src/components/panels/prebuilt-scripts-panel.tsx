import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeOutput } from "@/components/code-output";
import { useToast } from "@/hooks/use-toast";
import { FileCode, Wand2, Sword, Target, Car, Users, LayoutGrid, Skull, Loader2 } from "lucide-react";
import { templates, getTemplatesByCategory } from "@/lib/templates";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { TemplateCategory, Template } from "@shared/schema";

const categoryIcons: Record<string, React.ElementType> = {
  enemy: Skull,
  player: Target,
  vehicle: Car,
  combat: Sword,
  multiplayer: Users,
  ui: LayoutGrid,
};

const categoryLabels: Record<string, string> = {
  enemy: "Enemy AI",
  player: "Player",
  vehicle: "Vehicles",
  combat: "Combat",
  multiplayer: "Multiplayer",
  ui: "UI",
};

export function PreBuiltScriptsPanel() {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("enemy");
  const [selectedScript, setSelectedScript] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedCode, setGeneratedCode] = useState("");
  const [mode, setMode] = useState<"Multiplayer" | "Solo">("Multiplayer");
  const [syncVariables, setSyncVariables] = useState<string[]>([]);
  const [useAI, setUseAI] = useState(false);
  const { toast } = useToast();

  const aiGenerateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch("/api/ai/template-generate", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload) 
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      setSyncVariables(data.syncVariables || []);
      setUseAI(false);
      toast({
        title: "AI Generated!",
        description: "Code generated with smart RPC and sync suggestions",
      });
    },
    onError: () => {
      setUseAI(false);
      toast({
        title: "Error",
        description: "Failed to generate code with AI",
        variant: "destructive",
      });
    },
  });

  const categoryScripts = getTemplatesByCategory(selectedCategory);

  const handleScriptSelect = (script: Template) => {
    setSelectedScript(script);
    const defaults: Record<string, string> = {};
    script.variables.forEach((v: any) => {
      defaults[v.name] = v.defaultValue;
    });
    setVariableValues(defaults);
    setGeneratedCode("");
  };


  const generateWithAI = () => {
    if (!selectedScript) return;
    setUseAI(true);
    setSyncVariables([]);
    aiGenerateMutation.mutate({
      templateId: selectedScript.id,
      templateCode: selectedScript.code,
      mode,
      variables: variableValues,
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/30">
        <span className="text-xs">✓ All configured for Multiplayer Mode</span>
      </Badge>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCode className="h-5 w-5 text-primary" />
            Pre-Built Scripts
          </CardTitle>
          <CardDescription className="text-xs">
            Ready-to-use script templates for common patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {Object.entries(categoryLabels).map(([key, label]: [string, string]) => {
              const Icon = categoryIcons[key] || FileCode;
              const count = getTemplatesByCategory(key as TemplateCategory).length;
              return (
                <Button
                  key={key}
                  variant={selectedCategory === key ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={() => setSelectedCategory(key as TemplateCategory)}
                  data-testid={`btn-category-${key}`}
                >
                  <Icon className="h-3 w-3" />
                  {label} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0 flex-1">
        <div className="lg:w-[350px] space-y-4 min-h-0 flex-1 lg:flex-none">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-4">
              {categoryScripts.map((script) => (
                <Card
                  key={script.id}
                  className={`cursor-pointer hover-elevate ${
                    selectedScript?.id === script.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleScriptSelect(script)}
                  data-testid={`card-script-${script.id}`}
                >
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm">{script.name}</CardTitle>
                    <CardDescription className="text-xs">{script.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 space-y-4 min-h-0">
          {selectedScript ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Multiplayer">Multiplayer</SelectItem>
                      <SelectItem value="Solo">Solo</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{selectedScript.name}</CardTitle>
                  <CardDescription className="text-xs">{selectedScript.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-4 pr-4">
                      {selectedScript.variables.map((v) => (
                        <div key={v.name} className="space-y-1">
                          <Label className="text-xs">{v.name}</Label>
                          <Input
                            value={variableValues[v.name] || ""}
                            onChange={(e) => setVariableValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                            placeholder={v.defaultValue}
                            className="h-8 text-xs"
                            data-testid={`input-var-${v.name}`}
                          />
                          <p className="text-xs text-muted-foreground">{v.description}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button onClick={generateWithAI} size="sm" className="w-full" disabled={useAI || aiGenerateMutation.isPending} data-testid="button-generate-ai">
                    {useAI || aiGenerateMutation.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-3 w-3" />
                    )}
                    Generate with AI
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center min-h-[300px]">
                <p className="text-muted-foreground text-sm">Select a script to configure</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex-1 min-h-0 space-y-4 flex flex-col">
          <CodeOutput
            code={generatedCode}
            title="Generated Script"
            onCodeChange={setGeneratedCode}
            onClear={() => { setGeneratedCode(""); setSyncVariables([]); }}
          />
          
          {syncVariables.length > 0 && (
            <Card className="flex-shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">MultiplayerSynchronizer Variables</CardTitle>
                <CardDescription className="text-xs">Recommended for automatic sync</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {syncVariables.map((varName) => (
                    <Badge key={varName} variant="secondary" className="text-xs">
                      {varName}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
