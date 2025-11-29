import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { godotNodes } from "@/lib/godot-nodes";
import { Copy, Check, Box } from "lucide-react";
import { DimensionSelector } from "@/components/dimension-selector";
import { useToast } from "@/hooks/use-toast";
import type { GodotNode, GodotProperty, GodotMethod, GodotSignal } from "@shared/schema";


export function NodesPanel() {
  const [selectedNode, setSelectedNode] = useState<GodotNode | null>(godotNodes[0] || null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [targetFunction, setTargetFunction] = useState<string>("_ready");
  const [customFunction, setCustomFunction] = useState<string>("");
  const [propertyValues, setPropertyValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [directionBackward, setDirectionBackward] = useState<boolean>(false);
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const { toast } = useToast();

  const filteredNodes = godotNodes.filter(n => 
    n.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNodeSelect = (node: GodotNode) => {
    setSelectedNode(node);
    setPropertyValues({});
  };

  const handlePropertyChange = (propName: string, value: string) => {
    setPropertyValues((prev) => ({
      ...prev,
      [propName]: value,
    }));
  };

  const getPlaceholderText = (propType: string, propName: string): string => {
    if (propType === "Texture2D" || propType === "Texture") {
      return 'res://path/to/texture.png';
    } else if (propType === "AudioStream") {
      return 'res://path/to/sound.wav';
    } else if (propType === "SpriteFrames") {
      return 'res://path/to/frames.tres';
    } else if (propType === "Material") {
      return 'res://path/to/material.tres';
    } else if (propType === "Vector2") {
      return '0, 0';
    } else if (propType === "Vector3") {
      return '0, 0, 0';
    } else if (propType === "Color") {
      return '#ffffff or red';
    } else if (propType === "bool") {
      return 'true or false';
    }
    return `Enter ${propType}`;
  };

  const formatValue = (value: string, propType: string): string => {
    if (propType === "String" || propType === "StringName") {
      return `"${value}"`;
    } else if (propType === "Vector2") {
      if (!value.includes("Vector2")) {
        const parts = value.split(",").map((v) => v.trim());
        if (parts.length === 2) {
          return `Vector2(${parts[0]}, ${parts[1]})`;
        }
      }
      return value;
    } else if (propType === "Vector3") {
      if (!value.includes("Vector3")) {
        const parts = value.split(",").map((v) => v.trim());
        if (parts.length === 3) {
          return `Vector3(${parts[0]}, ${parts[1]}, ${parts[2]})`;
        }
      }
      return value;
    } else if (propType === "Color") {
      if (value.startsWith("#")) {
        return `Color.html("${value}")`;
      }
      return value;
    } else if (propType === "bool") {
      return value.toLowerCase() === "true" ? "true" : "false";
    } else if (propType === "int") {
      return parseInt(value).toString();
    } else if (propType === "float") {
      return parseFloat(value).toString();
    } else if (propType === "Texture2D" || propType === "Texture" || propType === "Material" || propType === "AudioStream" || propType === "SpriteFrames") {
      // Resource types: wrap with load()
      return `load("${value}")`;
    }
    return value;
  };

  const generateSingleLineCode = (): string => {
    if (!selectedNode) return "";
    
    const filledProps = Object.entries(propertyValues).filter(([, value]) => value && value.trim() !== "");
    const nodeName = selectedNode.name;
    
    // ANIMATION NODES
    if (nodeName === "AnimationPlayer") {
      const animName = propertyValues["animation"] || "idle";
      const speed = parseFloat(propertyValues["playback_speed"] || "1.0");
      return `$${nodeName}.play("${animName}", -1.0, ${speed}, ${directionBackward})`;
    }
    if (nodeName === "AnimatedSprite2D" || nodeName === "AnimatedSprite3D") {
      const anim = propertyValues["animation"];
      return anim ? `$${nodeName}.play("${anim}")` : `$${nodeName}.play()`;
    }
    
    // AUDIO NODES
    if (nodeName.startsWith("AudioStreamPlayer")) {
      if (propertyValues["volume_db"]) {
        return `$${nodeName}.volume_db = ${formatValue(propertyValues["volume_db"], "float")}; $${nodeName}.play()`;
      }
      return `$${nodeName}.play()`;
    }
    
    // TIMER NODE
    if (nodeName === "Timer") {
      const wait = propertyValues["wait_time"] || "1.0";
      return `$${nodeName}.wait_time = ${formatValue(wait, "float")}; $${nodeName}.start()`;
    }
    
    // PARTICLE NODES (CPU and GPU variants)
    if (nodeName.includes("Particles")) {
      if (propertyValues["emitting"]) {
        const emitting = propertyValues["emitting"].toLowerCase() === "true" ? "true" : "false";
        return `$${nodeName}.emitting = ${emitting}`;
      }
      return `$${nodeName}.emitting = true`;
    }
    
    // RAYCAST NODES: enable and force update
    if (nodeName === "RayCast2D" || nodeName === "RayCast3D") {
      if (propertyValues["enabled"]) {
        return `$${nodeName}.enabled = true; $${nodeName}.force_raycast_update()`;
      }
      return `$${nodeName}.force_raycast_update()`;
    }
    
    // CAMERA NODES: activate camera
    if (nodeName === "Camera2D" || nodeName === "Camera3D") {
      if (propertyValues["current"] === "true" || propertyValues["enabled"] === "true") {
        return `$${nodeName}.current = true`;
      }
      if (nodeName === "Camera3D" && propertyValues["fov"]) {
        return `$${nodeName}.fov = ${formatValue(propertyValues["fov"], "float")}`;
      }
      if (nodeName === "Camera2D" && propertyValues["zoom"]) {
        return `$${nodeName}.zoom = ${formatValue(propertyValues["zoom"], "float")}`;
      }
      return `$${nodeName}.current = true`;
    }
    
    // LIGHT NODES: set energy and color
    if (nodeName.includes("Light")) {
      const props = [];
      if (propertyValues["energy"]) props.push(`$${nodeName}.energy = ${formatValue(propertyValues["energy"], "float")}`);
      if (propertyValues["color"]) props.push(`$${nodeName}.color = ${formatValue(propertyValues["color"], "Color")}`);
      if (props.length > 0) return props.join("; ");
      return `$${nodeName}.energy = 1.0`;
    }
    
    // SPRITE NODES: set texture
    if (nodeName === "Sprite2D" || nodeName === "Sprite3D") {
      if (propertyValues["texture"]) {
        return `$${nodeName}.texture = ${formatValue(propertyValues["texture"], "Texture2D")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    // TEXT LABEL NODES
    if (nodeName === "Label" || nodeName === "Label3D" || nodeName === "RichTextLabel") {
      if (propertyValues["text"]) {
        return `$${nodeName}.text = ${formatValue(propertyValues["text"], "String")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    // PHYSICS BODIES: set velocity
    if (nodeName === "RigidBody2D" || nodeName === "RigidBody3D" || nodeName === "CharacterBody2D" || nodeName === "CharacterBody3D") {
      if (propertyValues["linear_velocity"] || propertyValues["velocity"]) {
        const velKey = propertyValues["linear_velocity"] ? "linear_velocity" : "velocity";
        return `$${nodeName}.${velKey} = ${formatValue(propertyValues[velKey], nodeName.includes("2D") ? "Vector2" : "Vector3")}`;
      }
      if (propertyValues["mass"]) {
        return `$${nodeName}.mass = ${formatValue(propertyValues["mass"], "float")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    // AREA NODES: set monitoring
    if (nodeName === "Area2D" || nodeName === "Area3D") {
      if (propertyValues["monitoring"]) {
        return `$${nodeName}.monitoring = ${propertyValues["monitoring"].toLowerCase() === "true" ? "true" : "false"}`;
      }
      return `$${nodeName}.monitoring = true`;
    }
    
    // UI CONTROL NODES
    if (nodeName === "Button") {
      if (propertyValues["text"]) {
        return `$${nodeName}.text = ${formatValue(propertyValues["text"], "String")}`;
      }
      if (propertyValues["icon"]) {
        return `$${nodeName}.icon = ${formatValue(propertyValues["icon"], "Texture2D")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    if (nodeName === "CheckBox" || nodeName === "LineEdit") {
      if (propertyValues["text"]) {
        return `$${nodeName}.text = ${formatValue(propertyValues["text"], "String")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    if (nodeName === "ColorRect") {
      if (propertyValues["color"]) {
        return `$${nodeName}.color = ${formatValue(propertyValues["color"], "Color")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    if (nodeName === "ProgressBar") {
      if (propertyValues["value"]) {
        return `$${nodeName}.value = ${formatValue(propertyValues["value"], "float")}`;
      }
      return `$${nodeName}.value = 0.0`;
    }
    
    // MESH NODES: set material
    if (nodeName === "MeshInstance2D" || nodeName === "MeshInstance3D") {
      if (propertyValues["material_override"] || propertyValues["material"]) {
        const matKey = propertyValues["material_override"] ? "material_override" : "material";
        return `$${nodeName}.${matKey} = ${formatValue(propertyValues[matKey], "Material")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    // NAVIGATION NODES: set target
    if (nodeName === "NavigationAgent2D" || nodeName === "NavigationAgent3D") {
      if (propertyValues["target_position"]) {
        const vecType = nodeName.includes("2D") ? "Vector2" : "Vector3";
        return `$${nodeName}.target_position = ${formatValue(propertyValues["target_position"], vecType)}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    // PATH NODES: set curve
    if (nodeName === "Path2D" || nodeName === "Path3D") {
      if (propertyValues["curve"]) {
        return `$${nodeName}.curve = ${formatValue(propertyValues["curve"], "Curve2D")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    // PATH FOLLOW NODES: set progress
    if (nodeName === "PathFollow2D" || nodeName === "PathFollow3D") {
      if (propertyValues["progress"]) {
        return `$${nodeName}.progress = ${formatValue(propertyValues["progress"], "float")}`;
      }
      return `var node: ${nodeName} = $${nodeName}`;
    }
    
    // TRANSFORM NODES (2D): set position/rotation/scale
    if (nodeName === "Node2D" || nodeName === "CanvasLayer" || (nodeName.endsWith("2D") && !nodeName.includes("Ray"))) {
      if (propertyValues["position"]) {
        return `$${nodeName}.position = ${formatValue(propertyValues["position"], "Vector2")}`;
      }
      if (propertyValues["rotation"]) {
        return `$${nodeName}.rotation = ${formatValue(propertyValues["rotation"], "float")}`;
      }
      if (propertyValues["scale"]) {
        return `$${nodeName}.scale = ${formatValue(propertyValues["scale"], "Vector2")}`;
      }
    }
    
    // TRANSFORM NODES (3D): set position/rotation/scale
    if (nodeName === "Node3D" || (nodeName.endsWith("3D") && !nodeName.includes("Ray"))) {
      if (propertyValues["position"]) {
        return `$${nodeName}.position = ${formatValue(propertyValues["position"], "Vector3")}`;
      }
      if (propertyValues["rotation"]) {
        return `$${nodeName}.rotation = ${formatValue(propertyValues["rotation"], "Vector3")}`;
      }
      if (propertyValues["scale"]) {
        return `$${nodeName}.scale = ${formatValue(propertyValues["scale"], "Vector3")}`;
      }
    }
    
    // GENERIC: If only one property filled, use simple setter
    if (filledProps.length === 1) {
      const [propName, value] = filledProps[0];
      const prop = selectedNode.properties.find((p) => p.name === propName);
      if (prop) {
        const formattedValue = formatValue(value, prop.type);
        return `$${nodeName}.${propName} = ${formattedValue}`;
      }
    }
    
    // GENERIC: If multiple properties, use first one
    if (filledProps.length > 1) {
      const [propName, value] = filledProps[0];
      const prop = selectedNode.properties.find((p) => p.name === propName);
      if (prop) {
        const formattedValue = formatValue(value, prop.type);
        return `$${nodeName}.${propName} = ${formattedValue}`;
      }
    }
    
    // DEFAULT: return node reference
    return `var node: ${nodeName} = $${nodeName}`;
  };

  const generateCode = () => {
    if (!selectedNode) return;
    const func = targetFunction === "custom" ? customFunction : targetFunction;
    if (!func) {
      toast({ title: "Error", description: "Enter a function name", variant: "destructive" });
      return;
    }

    const singleLine = generateSingleLineCode();
    let code = `extends Node\n\nfunc ${func}() -> void:\n\t${singleLine}\n`;

    setGeneratedCode(code);
    setCopied(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Code copied!", description: "Paste into your GDScript" });
  };

  const handleClearCode = () => {
    setGeneratedCode("");
    setCopied(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Box className="h-5 w-5 text-primary" />
            Godot 4.4 Nodes API
          </CardTitle>
          <CardDescription className="text-xs">
            Official Godot node documentation and properties
          </CardDescription>
        </CardHeader>
      </Card>
          <CardContent>
            <DimensionSelector dimension={dimension} onDimensionChange={setDimension} />
          </CardContent>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0 flex-1">
        <div className="lg:w-[300px] space-y-4 min-h-0 flex-1 lg:flex-none">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Search Nodes ({filteredNodes.length})</p>
            <Input
              placeholder="Search all 141 nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-8"
              data-testid="input-node-search"
            />
          </div>

          <ScrollArea className="h-[400px] border rounded-md">
            <div className="space-y-1 p-3">
              {filteredNodes.map((node) => (
                <Button
                  key={node.name}
                  variant={selectedNode?.name === node.name ? "secondary" : "ghost"}
                  className="w-full justify-start text-xs"
                  onClick={() => handleNodeSelect(node)}
                  data-testid={`btn-node-${node.name}`}
                >
                  {node.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-h-0">
          {selectedNode ? (
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg">{selectedNode.name}</CardTitle>
                      <Badge>{selectedNode.category}</Badge>
                    </div>
                    {selectedNode.inherits && (
                      <CardDescription>Inherits: {selectedNode.inherits}</CardDescription>
                    )}
                    <CardDescription>{selectedNode.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">Target Function</label>
                      <Select value={targetFunction} onValueChange={setTargetFunction}>
                        <SelectTrigger className="text-xs h-8" data-testid="select-target-function">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_ready">_ready()</SelectItem>
                          <SelectItem value="_process">_process(delta)</SelectItem>
                          <SelectItem value="_input">_input(event)</SelectItem>
                          <SelectItem value="_physics_process">_physics_process(delta)</SelectItem>
                          <SelectItem value="custom">Custom Function</SelectItem>
                        </SelectContent>
                      </Select>
                      {targetFunction === "custom" && (
                        <Input
                          placeholder="Function name (e.g., setup_node)"
                          value={customFunction}
                          onChange={(e) => setCustomFunction(e.target.value)}
                          className="text-xs h-8"
                          data-testid="input-custom-function"
                        />
                      )}
                    </div>

                    {selectedNode.properties.filter(p => p.scriptable).length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">Edit Properties</label>
                        <ScrollArea className="h-[120px] border rounded p-2">
                          <div className="space-y-2 pr-4">
                            {selectedNode.properties.filter(p => p.scriptable).map((prop: GodotProperty) => (
                              <div key={prop.name} className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <label className="text-xs">{prop.name}</label>
                                  <Badge variant="outline" className="text-xs">{prop.type}</Badge>
                                </div>
                                <Input
                                  value={propertyValues[prop.name] || ""}
                                  onChange={(e) => handlePropertyChange(prop.name, e.target.value)}
                                  placeholder={prop.defaultValue || getPlaceholderText(prop.type, prop.name)}
                                  className="h-7 text-xs"
                                  data-testid={`input-prop-${prop.name}`}
                                />
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {selectedNode.name === "AnimationPlayer" && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold">Direction Control</label>
                        <Select value={directionBackward ? "true" : "false"} onValueChange={(val) => setDirectionBackward(val === "true")}>
                          <SelectTrigger className="text-xs h-8" data-testid="select-direction">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Forward</SelectItem>
                            <SelectItem value="true">Backward</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button onClick={generateCode} size="sm" className="w-full text-xs" data-testid="button-generate-code">
                      Generate Code
                    </Button>
                  </CardContent>
                </Card>

                {generatedCode && (
                  <Card>
                    <div className="flex flex-row items-center justify-between gap-2 px-6 py-4 border-b">
                      <CardTitle className="text-xs">Generated GDScript Code</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          onClick={handleCopyCode}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          data-testid="button-copy-code"
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          onClick={handleClearCode}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          data-testid="button-clear-code"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <CardContent>
                      <div className="bg-muted rounded border p-3 text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto" data-testid="code-preview">
                        <pre className="whitespace-pre-wrap break-words text-foreground">
                          <code>{generatedCode}</code>
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedNode.properties.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Properties ({selectedNode.properties.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedNode.properties.map((prop: GodotProperty) => (
                        <div key={prop.name} className="text-xs border-l-2 border-primary/20 pl-3 py-1">
                          <div className="flex items-center gap-2">
                            <code className="text-primary font-mono">{prop.name}</code>
                            <Badge variant="outline" className="text-xs">{prop.type}</Badge>
                            {prop.scriptable && <Badge variant="secondary" className="text-xs">scriptable</Badge>}
                          </div>
                          <p className="text-muted-foreground mt-1">{prop.description}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selectedNode.methods.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Methods ({selectedNode.methods.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedNode.methods.map((method: GodotMethod) => (
                        <div key={method.name} className="text-xs border-l-2 border-accent/20 pl-3 py-1">
                          <code className="text-accent font-mono">
                            {method.name}({method.parameters.map((p: any) => `${p.name}: ${p.type}`).join(", ")}) → {method.returnType}
                          </code>
                          <p className="text-muted-foreground mt-1">{method.description}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selectedNode.signals.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Signals ({selectedNode.signals.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedNode.signals.map((sig: GodotSignal) => (
                        <div key={sig.name} className="text-xs border-l-2 border-green-500/20 pl-3 py-1">
                          <code className="text-green-600 dark:text-green-400 font-mono">
                            {sig.name}({sig.parameters.map((p: any) => `${p.name}: ${p.type}`).join(", ")})
                          </code>
                          <p className="text-muted-foreground mt-1">{sig.description}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          ) : (
            <Card className="border-dashed h-full flex items-center justify-center">
              <CardContent>
                <p className="text-muted-foreground text-sm">Select a node to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
