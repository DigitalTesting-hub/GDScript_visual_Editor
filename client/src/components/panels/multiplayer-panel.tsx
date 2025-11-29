import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeOutput } from "@/components/code-output";
import { DimensionSelector } from "@/components/dimension-selector";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Wand2, Plus, Trash2, Loader2 } from "lucide-react";
import type { RpcMode, RpcTransferMode, MultiplayerConfig } from "@shared/schema";

interface RpcFunction {
  name: string;
  rpcMode: RpcMode;
  transferMode: RpcTransferMode;
  callLocal: boolean;
  channel: number;
  parameters: string;
  returnType: string;
}

export function MultiplayerPanel() {
  const [functions, setFunctions] = useState<RpcFunction[]>([]);
  const [newFunction, setNewFunction] = useState<RpcFunction>({
    name: "",
    rpcMode: "any_peer",
    transferMode: "reliable",
    callLocal: false,
    channel: 0,
    parameters: "",
    returnType: "void",
  });
  const [generatedCode, setGeneratedCode] = useState("");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async (func: RpcFunction) => {
      const response = await apiRequest("POST", "/api/multiplayer/generate", {
        functionName: func.name,
        rpcMode: func.rpcMode,
        transferMode: func.transferMode,
        parameters: func.parameters,
        callLocal: func.callLocal,
      });
      return await response.json() as { code: string };
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      toast({ title: "Code Generated!", description: "RPC code is ready" });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAddFunction = () => {
    if (!newFunction.name.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter a function name",
        variant: "destructive",
      });
      return;
    }

    setFunctions([...functions, { ...newFunction }]);
    setNewFunction({
      name: "",
      rpcMode: "any_peer",
      transferMode: "reliable",
      callLocal: false,
      channel: 0,
      parameters: "",
      returnType: "void",
    });
  };

  const handleRemoveFunction = (index: number) => {
    setFunctions(functions.filter((_, i) => i !== index));
  };

  const generateCode = () => {
    if (functions.length === 0) {
      toast({ title: "No Functions", description: "Add at least one RPC function", variant: "destructive" });
      return;
    }
    generateMutation.mutate(functions[0]);
  };

  const generateSpawnCode = () => {
    let code = `extends Node\n\n`;
    code += `@export var player_scene: PackedScene\n`;
    code += `@export var spawn_points: Array[Marker2D] = []\n\n`;
    code += `var players: Dictionary = {}\n\n`;
    code += `func _ready() -> void:\n`;
    code += `\tif multiplayer.is_server():\n`;
    code += `\t\tmultiplayer.peer_connected.connect(_on_peer_connected)\n`;
    code += `\t\tmultiplayer.peer_disconnected.connect(_on_peer_disconnected)\n`;
    code += `\t\tfor peer_id in multiplayer.get_peers():\n`;
    code += `\t\t\tspawn_player(peer_id)\n`;
    code += `\t\tspawn_player(1)\n\n`;
    code += `func _on_peer_connected(peer_id: int) -> void:\n`;
    code += `\tspawn_player(peer_id)\n\n`;
    code += `func _on_peer_disconnected(peer_id: int) -> void:\n`;
    code += `\tif players.has(peer_id):\n`;
    code += `\t\tplayers[peer_id].queue_free()\n`;
    code += `\t\tplayers.erase(peer_id)\n\n`;
    code += `func spawn_player(peer_id: int) -> void:\n`;
    code += `\tvar player = player_scene.instantiate()\n`;
    code += `\tplayer.name = str(peer_id)\n`;
    code += `\tplayer.set_multiplayer_authority(peer_id)\n`;
    code += `\tadd_child(player, true)\n`;
    code += `\tif not spawn_points.is_empty():\n`;
    code += `\t\tvar idx = randi() % spawn_points.size()\n`;
    code += `\t\tplayer.global_position = spawn_points[idx].global_position\n`;
    code += `\tplayers[peer_id] = player\n\n`;
    code += `@rpc("any_peer", "call_local")\n`;
    code += `func sync_transform(peer_id: int, pos: Vector2) -> void:\n`;
    code += `\tif players.has(peer_id):\n`;
    code += `\t\tplayers[peer_id].global_position = pos\n`;

    setGeneratedCode(code);
    toast({
      title: "Spawn Manager Generated!",
      description: "Multiplayer spawn code is ready",
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Multiplayer RPC Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DimensionSelector dimension={dimension} onDimensionChange={setDimension} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Function Name</Label>
                <p className="text-xs text-muted-foreground mb-1">Name of the RPC function to call remotely</p>
                <Input
                  value={newFunction.name}
                  onChange={(e) =>
                    setNewFunction({ ...newFunction, name: e.target.value })
                  }
                  placeholder="sync_position"
                  data-testid="input-rpc-function-name"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">RPC Mode</Label>
                <p className="text-xs text-muted-foreground mb-1">Who can call this function</p>
                <Select
                  value={newFunction.rpcMode}
                  onValueChange={(v) =>
                    setNewFunction({ ...newFunction, rpcMode: v as RpcMode })
                  }
                >
                  <SelectTrigger data-testid="select-rpc-mode" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any_peer">Any Peer (anyone)</SelectItem>
                    <SelectItem value="authority">Authority (server only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Transfer Mode</Label>
                <p className="text-xs text-muted-foreground mb-1">Guaranteed delivery or speed priority</p>
                <Select
                  value={newFunction.transferMode}
                  onValueChange={(v) =>
                    setNewFunction({
                      ...newFunction,
                      transferMode: v as RpcTransferMode,
                    })
                  }
                >
                  <SelectTrigger data-testid="select-transfer-mode" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reliable">Reliable - Guaranteed delivery</SelectItem>
                    <SelectItem value="unreliable">Unreliable - Fast but may drop</SelectItem>
                    <SelectItem value="unreliable_ordered">Unreliable Ordered - Fast + ordered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Channel (0-255)</Label>
                <p className="text-xs text-muted-foreground mb-1">Network channel for this RPC</p>
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={newFunction.channel}
                  onChange={(e) =>
                    setNewFunction({
                      ...newFunction,
                      channel: parseInt(e.target.value) || 0,
                    })
                  }
                  data-testid="input-rpc-channel"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Parameters</Label>
                <p className="text-xs text-muted-foreground mb-1">Function arguments with types (comma separated)</p>
                <Input
                  value={newFunction.parameters}
                  onChange={(e) =>
                    setNewFunction({ ...newFunction, parameters: e.target.value })
                  }
                  placeholder="pos: Vector2, damage: int"
                  data-testid="input-rpc-parameters"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Return Type</Label>
                <p className="text-xs text-muted-foreground mb-1">Function return type (usually void)</p>
                <Input
                  value={newFunction.returnType}
                  onChange={(e) =>
                    setNewFunction({ ...newFunction, returnType: e.target.value })
                  }
                  placeholder="void"
                  data-testid="input-rpc-return-type"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newFunction.callLocal}
                      onCheckedChange={(v) =>
                        setNewFunction({ ...newFunction, callLocal: v })
                      }
                      data-testid="switch-call-local"
                    />
                    <Label className="text-xs font-semibold">Call Local</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Also execute function on the caller</p>
                </div>
              </div>
              <Button onClick={handleAddFunction} data-testid="button-add-rpc">
                <Plus className="mr-2 h-4 w-4" />
                Add Function
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">RPC Functions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {functions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No RPC functions added yet
                  </p>
                ) : (
                  functions.map((func, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded bg-muted/50"
                    >
                      <div>
                        <code className="text-sm font-mono text-primary">
                          @rpc("{func.rpcMode}", "{func.callLocal ? "call_local" : "call_remote"}", "{func.transferMode}")
                        </code>
                        <br />
                        <code className="text-sm font-mono">
                          func {func.name}({func.parameters}) -&gt; {func.returnType}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFunction(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={generateCode}
            disabled={functions.length === 0}
            className="w-full"
            data-testid="button-generate-rpc"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Generate RPC Code
          </Button>
          <Button
            onClick={generateSpawnCode}
            variant="outline"
            className="w-full"
            data-testid="button-generate-spawn"
          >
            <Users className="mr-2 h-4 w-4" />
            Generate Spawn Manager
          </Button>
        </div>
      </div>

      <div className="lg:w-[450px]">
        <CodeOutput
          code={generatedCode}
          title="Multiplayer Code"
          onCodeChange={setGeneratedCode}
          onClear={() => setGeneratedCode("")}
        />
      </div>
    </div>
  );
}
