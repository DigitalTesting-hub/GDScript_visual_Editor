import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VisualBlock } from "@/components/visual-block";
import { Plus, Wand2, Loader2, Save, Upload, Trash2, Download } from "lucide-react";
import { visualBlockDefs, type VisualBlockDef } from "@/lib/visual-blocks";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface VisualBlockInstance {
  id: string;
  defType: "key_input" | "movement" | "animation" | "label" | "wait" | "sound" | "condition" | "loop" | "property" | "sprite" | "emit" | "print";
  values: Record<string, any>;
  nodeType?: string;
  nodePath?: string;
}

interface VisualSequencerProps {
  onGenerateCode: (blocks: VisualBlockInstance[], code: string) => void;
}

export function VisualSequencer({ onGenerateCode }: VisualSequencerProps) {
  const [blocks, setBlocks] = useState<VisualBlockInstance[]>([]);
  const [selectedBlockType, setSelectedBlockType] = useState<string>("");
  const { toast } = useToast();

  const saveSequence = () => {
    const data = JSON.stringify(blocks);
    localStorage.setItem("scratch_sequence", data);
    toast({ title: "Sequence saved!", description: "Your block sequence has been saved" });
  };

  const loadSequence = () => {
    const data = localStorage.getItem("scratch_sequence");
    if (data) {
      try {
        setBlocks(JSON.parse(data));
        toast({ title: "Sequence loaded!", description: "Your saved block sequence has been restored" });
      } catch {
        toast({ title: "Load failed", description: "Could not load saved sequence", variant: "destructive" });
      }
    }
  };

  const clearSequence = () => {
    if (blocks.length > 0) {
      setBlocks([]);
      toast({ title: "Cleared", description: "All blocks have been removed" });
    }
  };

  const exportSequence = () => {
    const data = JSON.stringify(blocks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scratch-sequence.json";
    a.click();
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/scratch/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      if (!response.ok) throw new Error("Generation failed");
      const data = await response.json();
      return data.code || "";
    },
  });

  const addBlock = () => {
    if (!selectedBlockType) return;

    const def = visualBlockDefs.find((d) => d.type === selectedBlockType as any);
    if (!def) return;

    const newBlock: VisualBlockInstance = {
      id: `vblock-${Date.now()}`,
      defType: def.type,
      values: def.inputs.reduce(
        (acc, input) => {
          acc[input.name] = input.defaultValue;
          return acc;
        },
        {} as Record<string, any>
      ),
      nodeType: def.nodeTypes ? def.nodeTypes[0] : undefined,
    };

    setBlocks([...blocks, newBlock]);
    setSelectedBlockType("");
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[fromIndex], newBlocks[toIndex]] = [newBlocks[toIndex], newBlocks[fromIndex]];
    setBlocks(newBlocks);
  };

  const updateBlockValue = (id: string, inputName: string, value: any) => {
    setBlocks(
      blocks.map((b) =>
        b.id === id ? { ...b, values: { ...b.values, [inputName]: value } } : b
      )
    );
  };

  const updateBlockNodeType = (id: string, nodeType: string) => {
    setBlocks(
      blocks.map((b) =>
        b.id === id ? { ...b, nodeType } : b
      )
    );
  };

  const getBlockDef = (type: string): VisualBlockDef | undefined => {
    return visualBlockDefs.find((d) => d.type === type as any);
  };

  const generateCode = async () => {
    try {
      const code = await generateMutation.mutateAsync();
      onGenerateCode(blocks, code);
      toast({
        title: "Code Generated!",
        description: `Generated code from ${blocks.length} visual blocks`,
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate code",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <Card className="flex-shrink-0">
        <CardHeader className="py-2 pb-1">
          <CardTitle className="text-sm">Add Scratch-Style Block</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex gap-2">
            <Select value={selectedBlockType} onValueChange={setSelectedBlockType}>
              <SelectTrigger className="flex-1 h-8 text-xs" data-testid="select-visual-block-type">
                <SelectValue placeholder="Choose a block..." />
              </SelectTrigger>
              <SelectContent>
                {visualBlockDefs.map((def) => (
                  <SelectItem key={def.type} value={def.type}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: def.color }} />
                      {def.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addBlock} disabled={!selectedBlockType} size="sm" data-testid="button-add-visual-block">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-shrink-0">
        <Button onClick={saveSequence} size="sm" variant="outline" title="Save sequence to browser" data-testid="button-save-sequence">
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Button onClick={loadSequence} size="sm" variant="outline" title="Load saved sequence" data-testid="button-load-sequence">
          <Upload className="h-3 w-3 mr-1" />
          Load
        </Button>
        <Button onClick={exportSequence} size="sm" variant="outline" title="Export as JSON" data-testid="button-export-sequence">
          <Download className="h-3 w-3 mr-1" />
          Export
        </Button>
        <Button onClick={clearSequence} size="sm" variant="outline" title="Clear all blocks" data-testid="button-clear-sequence">
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="py-2 pb-1 flex-shrink-0">
          <CardTitle className="text-xs">Sequence</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col p-2">
          <ScrollArea className="flex-1 pr-2">
            {blocks.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4">
                Add blocks to build sequence
              </div>
            ) : (
              <div className="space-y-1">
                {blocks.map((block, idx) => {
                  const def = getBlockDef(block.defType);
                  return def ? (
                    <VisualBlock
                      key={block.id}
                      id={block.id}
                      def={def}
                      values={block.values}
                      nodeType={block.nodeType}
                      index={idx}
                      total={blocks.length}
                      onMove={moveBlock}
                      onValueChange={(inputName, value) => updateBlockValue(block.id, inputName, value)}
                      onNodeTypeChange={(nodeType) => updateBlockNodeType(block.id, nodeType)}
                      onDelete={() => removeBlock(block.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    />
                  ) : null;
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Button onClick={generateCode} disabled={blocks.length === 0 || generateMutation.isPending} size="sm" className="flex-shrink-0 text-xs w-full" data-testid="button-generate-visual-code">
        {generateMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-3 w-3" />
            Generate Code
          </>
        )}
      </Button>
    </div>
  );
}
