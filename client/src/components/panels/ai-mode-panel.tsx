import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeOutput } from "@/components/code-output";
import { DimensionSelector } from "@/components/dimension-selector";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import type { AIProvider, AIGenerateResponse } from "@shared/schema";

const AI_MODELS = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Fast)" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Advanced)" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Fast)" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
};

const EXAMPLE_PROMPTS = [
  "Create a 2D platformer player controller with double jump",
  "Make an enemy AI that patrols between waypoints and chases the player",
  "Write a health system with damage, healing, and death signals",
  "Create a save/load system using JSON files",
  "Make a simple inventory system with item stacking",
  "Write a dialogue system with branching conversations",
  "Build a camera following system with smooth smoothing",
  "Create a particle system for explosion effects",
  "Write a level manager that loads different scenes",
  "Make a UI menu with buttons and animations",
  "Create a collision system for projectiles",
  "Write a resource manager for item spawning",
];

export function AIModePanel() {
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [model, setModel] = useState(AI_MODELS.gemini[0].id);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [complexity, setComplexity] = useState<"simple" | "moderate" | "advanced">("moderate");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const [generatedCode, setGeneratedCode] = useState("");
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const fullPrompt = context 
        ? `${prompt}\n\nAdditional context: ${context}\n\nCode complexity: ${complexity}\n\nGame dimension: ${dimension}`
        : `${prompt}\n\nCode complexity: ${complexity}\n\nGame dimension: ${dimension}`;
      
      const response = await apiRequest("POST", "/api/ai/generate", {
        provider,
        model,
        prompt: fullPrompt,
      });
      return await response.json() as AIGenerateResponse;
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      toast({
        title: "Code Generated!",
        description: "Your GDScript code is ready",
      });
    },
    onError: (error: Error) => {
      const message = error.message || "Failed to generate code";
      const apiKeyHint = message.includes("401") || message.includes("API") 
        ? " - Check your API keys in environment variables"
        : "";
      toast({
        title: "Generation Failed",
        description: message + apiKeyHint,
        variant: "destructive",
      });
    },
  });

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setModel(AI_MODELS[newProvider][0].id);
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Code Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DimensionSelector dimension={dimension} onDimensionChange={setDimension} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">AI Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => handleProviderChange(v as AIProvider)}
                >
                  <SelectTrigger id="provider" data-testid="select-ai-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model" data-testid="select-ai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS[provider].map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Describe what you want to create</Label>
              <Textarea
                id="prompt"
                placeholder="e.g., Create a player controller with movement, jumping, and animations for a 2D platformer game..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                data-testid="textarea-ai-prompt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Additional Context (Optional)</Label>
              <Textarea
                id="context"
                placeholder="Describe your game genre, mechanics, or any project-specific details..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[80px] resize-none"
                data-testid="textarea-ai-context"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complexity">Code Complexity</Label>
              <Select value={complexity} onValueChange={(v: any) => setComplexity(v)}>
                <SelectTrigger id="complexity" data-testid="select-complexity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple (Basic functionality)</SelectItem>
                  <SelectItem value="moderate">Moderate (Production-ready)</SelectItem>
                  <SelectItem value="advanced">Advanced (Optimized &amp; featured)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!prompt.trim() || generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-ai"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate GDScript
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Example Prompts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExampleClick(example)}
                  className="text-xs"
                  data-testid={`button-example-prompt-${i}`}
                >
                  {example.length > 40 ? example.slice(0, 40) + "..." : example}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:w-[450px]">
        <CodeOutput
          code={generatedCode}
          title="AI Generated Code"
          onCodeChange={setGeneratedCode}
          onClear={() => setGeneratedCode("")}
        />
      </div>
    </div>
  );
}
