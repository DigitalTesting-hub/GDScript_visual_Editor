import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeOutput } from "@/components/code-output";
import { DimensionSelector } from "@/components/dimension-selector";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Radio, Wand2, Plus, Trash2, Loader2 } from "lucide-react";
import type { SignalType } from "@shared/schema";

interface SignalConfig {
  type: SignalType;
  sourceNode: string;
  signalName: string;
  targetMethod: string;
  parameters: string[];
}

const COMMON_SIGNALS: Record<string, { signals: { name: string; params: string[] }[] }> = {
  button: {
    signals: [
      { name: "pressed", params: [] },
      { name: "button_down", params: [] },
      { name: "button_up", params: [] },
      { name: "toggled", params: ["toggled_on: bool"] },
    ],
  },
  area: {
    signals: [
      { name: "body_entered", params: ["body: Node2D"] },
      { name: "body_exited", params: ["body: Node2D"] },
      { name: "area_entered", params: ["area: Area2D"] },
      { name: "area_exited", params: ["area: Area2D"] },
    ],
  },
  timer: {
    signals: [
      { name: "timeout", params: [] },
    ],
  },
  animation: {
    signals: [
      { name: "animation_finished", params: ["anim_name: StringName"] },
      { name: "animation_started", params: ["anim_name: StringName"] },
      { name: "animation_looped", params: [] },
    ],
  },
  collision: {
    signals: [
      { name: "body_entered", params: ["body: Node"] },
      { name: "body_exited", params: ["body: Node"] },
      { name: "sleeping_state_changed", params: [] },
    ],
  },
};

export function SignalsPanel() {
  const [signalType, setSignalType] = useState<SignalType>("button");
  const [sourceNode, setSourceNode] = useState("$Button");
  const [selectedSignal, setSelectedSignal] = useState("");
  const [targetMethod, setTargetMethod] = useState("_on_button_pressed");
  const [customSignals, setCustomSignals] = useState<{ name: string; params: string }[]>([]);
  const [newSignalName, setNewSignalName] = useState("");
  const [newSignalParams, setNewSignalParams] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const signalInfo = COMMON_SIGNALS[signalType]?.signals.find((s) => s.name === selectedSignal);
      const params = signalInfo ? signalInfo.params.join(", ") : "";
      const response = await apiRequest("POST", "/api/signals/generate", {
        sourceNode,
        signalName: selectedSignal,
        targetMethod,
        signalParams: params,
      });
      return await response.json() as { code: string };
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      toast({ title: "Code Generated!", description: "Signal connection code is ready" });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAddCustomSignal = () => {
    if (!newSignalName.trim()) return;
    setCustomSignals([
      ...customSignals,
      { name: newSignalName, params: newSignalParams },
    ]);
    setNewSignalName("");
    setNewSignalParams("");
  };

  const handleRemoveCustomSignal = (index: number) => {
    setCustomSignals(customSignals.filter((_, i) => i !== index));
  };

  const generateConnectionCode = () => {
    if (!sourceNode || !selectedSignal || !targetMethod) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    generateMutation.mutate();
  };

  const generateCustomSignalCode = () => {
    if (customSignals.length === 0) {
      toast({
        title: "No Custom Signals",
        description: "Add at least one custom signal",
        variant: "destructive",
      });
      return;
    }

    let code = `extends Node\n\n`;
    
    customSignals.forEach(({ name, params }) => {
      if (params.trim()) {
        code += `signal ${name}(${params})\n`;
      } else {
        code += `signal ${name}\n`;
      }
    });

    code += `\nfunc _ready() -> void:\n`;
    customSignals.forEach(({ name }) => {
      code += `\t${name}.connect(_on_${name})\n`;
    });

    code += `\n`;
    customSignals.forEach(({ name, params }) => {
      code += `func _on_${name}(${params}) -> void:\n`;
      code += `\tpass\n\n`;
    });

    setGeneratedCode(code);
    toast({
      title: "Code Generated!",
      description: "Custom signal code is ready",
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5 text-primary" />
              Signal Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="connect" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="connect" data-testid="tab-connect-signals">
                  Connect Signals
                </TabsTrigger>
                <TabsTrigger value="custom" data-testid="tab-custom-signals">
                  Custom Signals
                </TabsTrigger>
              </TabsList>

              <TabsContent value="connect" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Signal Type</Label>
                    <Select
                      value={signalType}
                      onValueChange={(v) => {
                        setSignalType(v as SignalType);
                        setSelectedSignal("");
                      }}
                    >
                      <SelectTrigger data-testid="select-signal-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="button">Button Signals</SelectItem>
                        <SelectItem value="area">Area Signals</SelectItem>
                        <SelectItem value="timer">Timer Signals</SelectItem>
                        <SelectItem value="animation">Animation Signals</SelectItem>
                        <SelectItem value="collision">Collision Signals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Signal</Label>
                    <Select value={selectedSignal} onValueChange={setSelectedSignal}>
                      <SelectTrigger data-testid="select-signal-name">
                        <SelectValue placeholder="Choose signal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_SIGNALS[signalType]?.signals.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {s.name}({s.params.join(", ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Source Node Path</Label>
                  <Input
                    value={sourceNode}
                    onChange={(e) => setSourceNode(e.target.value)}
                    placeholder="$Button, $Area2D, etc."
                    data-testid="input-source-node"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Target Method Name</Label>
                  <Input
                    value={targetMethod}
                    onChange={(e) => setTargetMethod(e.target.value)}
                    placeholder="_on_button_pressed"
                    data-testid="input-target-method"
                  />
                </div>

                <Button
                  onClick={generateConnectionCode}
                  disabled={generateMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-signal-code"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Connection Code
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Signal Name</Label>
                      <Input
                        value={newSignalName}
                        onChange={(e) => setNewSignalName(e.target.value)}
                        placeholder="my_custom_signal"
                        data-testid="input-new-signal-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parameters (optional)</Label>
                      <Input
                        value={newSignalParams}
                        onChange={(e) => setNewSignalParams(e.target.value)}
                        placeholder="value: int, name: String"
                        data-testid="input-new-signal-params"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleAddCustomSignal}
                    variant="outline"
                    className="w-full"
                    data-testid="button-add-custom-signal"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Signal
                  </Button>
                </div>

                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {customSignals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No custom signals added yet
                      </p>
                    ) : (
                      customSignals.map((signal, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded bg-muted/50"
                        >
                          <code className="text-sm font-mono">
                            signal {signal.name}
                            {signal.params && `(${signal.params})`}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRemoveCustomSignal(i)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <Button
                  onClick={generateCustomSignalCode}
                  disabled={customSignals.length === 0}
                  className="w-full"
                  data-testid="button-generate-custom-signals"
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Custom Signals
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="lg:w-[450px]">
        <CodeOutput
          code={generatedCode}
          title="Signal Code"
          onCodeChange={setGeneratedCode}
          onClear={() => setGeneratedCode("")}
        />
      </div>
    </div>
  );
}
