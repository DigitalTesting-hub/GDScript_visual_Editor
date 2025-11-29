import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CodeOutput } from "@/components/code-output";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Wand2, Loader2, Flame, Cloud, Bomb, Droplets, Zap, CloudRain, Wind, Star } from "lucide-react";
import { particlePresets } from "@/lib/templates";
import type { ParticlePreset } from "@shared/schema";

const presetIcons: Record<string, React.ElementType> = {
  fire: Flame,
  smoke: Cloud,
  explosion: Bomb,
  blood: Droplets,
  sparks: Zap,
  rain: CloudRain,
  dust: Wind,
  magic: Star,
  "fire-3d": Flame,
  "smoke-3d": Cloud,
  "explosion-3d": Bomb,
  "blood-3d": Droplets,
  "sparks-3d": Zap,
  "rain-3d": CloudRain,
  "dust-3d": Wind,
  "magic-3d": Star,
};

export function ParticlesPanel() {
  const [selectedPreset, setSelectedPreset] = useState<ParticlePreset | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, number | string>>({});
  const [generatedCode, setGeneratedCode] = useState("");
  const { toast } = useToast();

  const handlePresetSelect = (preset: ParticlePreset) => {
    setSelectedPreset(preset);
    const defaults: Record<string, number | string> = {};
    if (preset && preset.parameters) {
      preset.parameters.forEach((p: any) => {
        defaults[p.name] = p.type === "bool" 
          ? p.defaultValue 
          : parseFloat(p.defaultValue) || 0;
      });
    }
    setParameterValues(defaults);
    setGeneratedCode("");
  };

  const handleParameterChange = (name: string, value: number | string) => {
    setParameterValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/particles/generate", {
        particleType: selectedPreset?.type || "GPUParticles2D",
        amount: Number(parameterValues.amount) || 100,
        lifetime: Number(parameterValues.lifetime) || 2.0,
        speed: Number(parameterValues.speed) || 100,
      });
      return await response.json() as { code: string };
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      toast({
        title: "Particle Effect Generated!",
        description: `Generated ${selectedPreset?.name} effect`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateCode = () => {
    if (!selectedPreset) return;
    generateMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Particle Effects
          </CardTitle>
          <CardDescription className="text-xs">
            Pre-configured particle effect templates for common VFX
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-row gap-6 h-full min-h-0 flex-1">
        <div className="w-[350px] space-y-4 min-h-0 flex-none">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-4">
              {particlePresets && Array.isArray(particlePresets) ? particlePresets.map((preset) => {
                const Icon = presetIcons[preset.id] || Sparkles;
                return (
                  <Card
                    key={preset.id}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      selectedPreset?.id === preset.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => handlePresetSelect(preset)}
                    data-testid={`card-particle-${preset.id}`}
                  >
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-sm">{preset.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {preset.description}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {preset.type}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                );
              }) : null}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 space-y-4 min-h-0">
        {selectedPreset && selectedPreset.parameters ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = presetIcons[selectedPreset.id] || Sparkles;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <CardTitle className="text-lg">{selectedPreset.name}</CardTitle>
                </div>
                <Badge>{selectedPreset.type}</Badge>
              </div>
              <CardDescription>{selectedPreset.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[350px]">
                <div className="space-y-6 pr-4">
                  {selectedPreset.parameters && Object.entries(
                    selectedPreset.parameters.reduce((acc: any, p: any) => {
                      const cat = p.category || "Other";
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(p);
                      return acc;
                    }, {})
                  ).map(([category, params]: any) => (
                    <div key={category} className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">{category}</h4>
                      <div className="space-y-4">
                        {params.map((param: any) => (
                    <div key={param.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{param.name}</Label>
                        <Badge variant="outline" className="text-xs">
                          {param.type}
                        </Badge>
                      </div>
                      
                      {param.type === "bool" ? (
                        <div className="flex gap-2">
                          <Button
                            variant={parameterValues[param.name] === "true" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleParameterChange(param.name, "true")}
                          >
                            True
                          </Button>
                          <Button
                            variant={parameterValues[param.name] === "false" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleParameterChange(param.name, "false")}
                          >
                            False
                          </Button>
                        </div>
                      ) : param.min !== undefined && param.max !== undefined ? (
                        <div className="space-y-2">
                          {param.name === "hue" ? (
                            <div 
                              className="w-full h-2 rounded-full mb-2"
                              style={{
                                background: `linear-gradient(to right, 
                                  hsl(0, 100%, 50%),
                                  hsl(30, 100%, 50%),
                                  hsl(60, 100%, 50%),
                                  hsl(120, 100%, 50%),
                                  hsl(180, 100%, 50%),
                                  hsl(210, 100%, 50%),
                                  hsl(240, 100%, 50%),
                                  hsl(270, 100%, 50%),
                                  hsl(300, 100%, 50%),
                                  hsl(330, 100%, 50%),
                                  hsl(360, 100%, 50%)
                                )`,
                              }}
                            />
                          ) : null}
                          <Slider
                            value={[Number(parameterValues[param.name]) || 0]}
                            onValueChange={(v) => handleParameterChange(param.name, v[0])}
                            min={param.min}
                            max={param.max}
                            step={param.type === "int" ? 1 : 0.1}
                            className="w-full"
                            data-testid={`slider-param-${param.name}`}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{param.min}</span>
                            <span className="font-medium">
                              {typeof parameterValues[param.name] === 'number' 
                                ? (parameterValues[param.name] as number).toFixed(param.type === "int" ? 0 : 1)
                                : param.defaultValue}
                            </span>
                            <span>{param.max}</span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          value={parameterValues[param.name] || ""}
                          onChange={(e) => handleParameterChange(param.name, parseFloat(e.target.value) || 0)}
                          placeholder={param.defaultValue}
                          className="h-9"
                          data-testid={`input-param-${param.name}`}
                        />
                      )}
                    </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                onClick={generateCode}
                disabled={generateMutation.isPending}
                className="w-full"
                data-testid="button-generate-particle"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Particle Effect
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">
                  Select a particle effect preset from the left panel
                  <br />
                  to configure and generate code
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        </div>

        <div className="flex-1 min-h-0">
          <CodeOutput
            code={generatedCode}
            title="Particle Code"
            onCodeChange={setGeneratedCode}
            onClear={() => setGeneratedCode("")}
          />
        </div>
      </div>
    </div>
  );
}
