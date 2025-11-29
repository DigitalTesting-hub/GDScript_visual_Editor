import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CodeOutput } from "@/components/code-output";
import { DimensionSelector } from "@/components/dimension-selector";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp, 
  Loader2, Wand2, Keyboard, Zap, Radio, Play, 
  Move, Volume2, Settings, Code
} from "lucide-react";
import { triggerBlocks, actionBlocks, conditionBlocks, type BlockDefinition, type BlockInput } from "@/lib/sequence-blocks";
import type { SequenceBlock } from "@shared/schema";

const iconMap: Record<string, React.ElementType> = {
  Keyboard, Zap, Radio, Play, Move, Volume2, Settings, Code,
  Gamepad2: Keyboard, Square: Zap, Clock: Settings, Film: Play,
  ArrowUpRight: Move, Plus, Trash2, ArrowDownToLine: Move, 
  Users: Settings, GitBranch: Code, Layers: Settings,
};

export function SequencerPanel() {
  const [blocks, setBlocks] = useState<SequenceBlock[]>([]);
  const [selectedBlockType, setSelectedBlockType] = useState<string>("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [mode, setMode] = useState<"builtin" | "custom-function" | "signal">("builtin");
  const [builtInFunction, setBuiltInFunction] = useState("_physics_process");
  const [customFunctionName, setCustomFunctionName] = useState("my_function");
  const [signalName, setSignalName] = useState("my_signal");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const { toast } = useToast();

  const allBlockDefs = [...triggerBlocks, ...actionBlocks, ...conditionBlocks];

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sequence/generate", {
        blocks,
        mode,
        builtInFunction,
        customFunctionName,
        signalName,
        dimension,
      });
      return await response.json() as { code: string };
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      toast({
        title: "Code Generated!",
        description: "Sequence converted to GDScript",
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

  const addBlock = () => {
    if (!selectedBlockType) return;
    
    const blockDef = allBlockDefs.find(b => b.label === selectedBlockType);
    if (!blockDef) return;

    const newBlock: SequenceBlock = {
      id: `block-${Date.now()}`,
      type: blockDef.type,
      label: blockDef.label,
      description: blockDef.description,
      inputs: blockDef.inputs.reduce((acc, input) => {
        acc[input.name] = input.defaultValue || "";
        return acc;
      }, {} as Record<string, any>),
      color: blockDef.color,
      order: blocks.length,
    };

    setBlocks([...blocks, newBlock]);
    setSelectedBlockType("");
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const updateBlockInput = (blockId: string, inputName: string, value: any) => {
    setBlocks(blocks.map(b => 
      b.id === blockId 
        ? { ...b, inputs: { ...b.inputs, [inputName]: value } }
        : b
    ));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    
    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const getBlockDef = (label: string): BlockDefinition | undefined => {
    return allBlockDefs.find(b => b.label === label);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className="flex-1 space-y-2 flex flex-col">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code className="h-5 w-5 text-primary" />
              Visual Sequence Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <DimensionSelector dimension={dimension} onDimensionChange={setDimension} />
            <div className="space-y-2">
              <Label>Code Output Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "builtin" | "custom-function" | "signal")} data-testid="select-sequence-mode">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builtin">Built-in Function</SelectItem>
                  <SelectItem value="custom-function">Custom Function</SelectItem>
                  <SelectItem value="signal">Signal Emission</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {mode === "builtin" && (
                <div className="space-y-2">
                  <Label>Built-in Function</Label>
                  <Select value={builtInFunction} onValueChange={setBuiltInFunction}>
                    <SelectTrigger data-testid="select-builtin-function">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ready">_ready()</SelectItem>
                      <SelectItem value="_process">_process(delta)</SelectItem>
                      <SelectItem value="_physics_process">_physics_process(delta)</SelectItem>
                      <SelectItem value="_input">_input(event)</SelectItem>
                      <SelectItem value="_unhandled_input">_unhandled_input(event)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {mode === "custom-function" && (
                <div className="space-y-2">
                  <Label>Function Name</Label>
                  <Input 
                    value={customFunctionName} 
                    onChange={(e) => setCustomFunctionName(e.target.value)}
                    placeholder="my_function"
                    data-testid="input-custom-function-name"
                  />
                </div>
              )}
              {mode === "signal" && (
                <div className="space-y-2">
                  <Label>Signal Name</Label>
                  <Input 
                    value={signalName} 
                    onChange={(e) => setSignalName(e.target.value)}
                    placeholder="my_signal"
                    data-testid="input-signal-name"
                  />
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Add Block</Label>
                <div className="flex gap-2">
                  <Select value={selectedBlockType} onValueChange={setSelectedBlockType}>
                    <SelectTrigger className="flex-1" data-testid="select-block-type">
                      <SelectValue placeholder="Choose a block..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__triggers__" disabled className="text-xs font-semibold opacity-50">Triggers</SelectItem>
                      {triggerBlocks.map((b) => (
                        <SelectItem key={b.label} value={b.label}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: b.color }} 
                            />
                            {b.label}
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="__actions__" disabled className="text-xs font-semibold opacity-50">Actions</SelectItem>
                      {actionBlocks.map((b) => (
                        <SelectItem key={b.label} value={b.label}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: b.color }} 
                            />
                            {b.label}
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="__conditions__" disabled className="text-xs font-semibold opacity-50">Conditions</SelectItem>
                      {conditionBlocks.map((b) => (
                        <SelectItem key={b.label} value={b.label}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: b.color }} 
                            />
                            {b.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addBlock} disabled={!selectedBlockType} data-testid="button-add-block">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => generateMutation.mutate()} disabled={blocks.length === 0 || generateMutation.isPending} className="w-full" data-testid="button-generate-sequence">
          {generateMutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<><Wand2 className="mr-2 h-4 w-4" />Generate GDScript</>)}
        </Button>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-4">
            {blocks.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center min-h-[100px]">
                  <p className="text-muted-foreground text-xs text-center">
                    Add blocks to build your sequence.<br />Start with a trigger, then add actions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              blocks.map((block, index) => {
                const blockDef = getBlockDef(block.label);
                const IconComponent = blockDef ? iconMap[blockDef.icon] || Code : Code;
                return (
                  <Card key={block.id} className="relative" style={{ borderLeftColor: block.color, borderLeftWidth: 4 }}>
                    <CardHeader className="py-2 px-3 flex flex-row items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <IconComponent className="h-4 w-4" style={{ color: block.color }} />
                      <span className="font-medium text-sm flex-1">{block.label}</span>
                      <Badge variant="outline" className="text-xs">{block.type}</Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBlock(index, "up")} disabled={index === 0}><ChevronUp className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveBlock(index, "down")} disabled={index === blocks.length - 1}><ChevronDown className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlock(block.id)} data-testid={`button-remove-block-${index}`}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </CardHeader>
                    {blockDef && blockDef.inputs.length > 0 && (
                      <CardContent className="py-2 px-3 pt-0">
                        <div className="grid grid-cols-2 gap-2">
                          {blockDef.inputs.map((input: BlockInput) => (
                            <div key={input.name} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{input.label}</Label>
                              {input.type === "select" && input.options ? (
                                <Select value={block.inputs[input.name] || ""} onValueChange={(v) => updateBlockInput(block.id, input.name, v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {input.options.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input value={block.inputs[input.name] || ""} onChange={(e) => updateBlockInput(block.id, input.name, e.target.value)} placeholder={input.placeholder} className="h-8 text-xs" type={input.type === "number" ? "number" : "text"} />
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="lg:w-[450px]">
        <CodeOutput
          code={generatedCode}
          title="Sequence Code"
          onCodeChange={setGeneratedCode}
          onClear={() => setGeneratedCode("")}
        />
      </div>
    </div>
  );
}
