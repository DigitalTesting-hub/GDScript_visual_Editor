import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CodeOutput } from "@/components/code-output";
import { useToast } from "@/hooks/use-toast";
import { 
  Box, Square, Boxes, LayoutGrid, Palette, Play, 
  Volume2, Zap, FileCode, ChevronRight, Search, Wand2
} from "lucide-react";
import { godotNodeCategories, godotNodes, getNodesByCategory } from "@/lib/godot-nodes";
import type { GodotNode } from "@shared/schema";

const categoryIcons: Record<string, React.ElementType> = {
  node: Box,
  node2d: Square,
  node3d: Boxes,
  control: LayoutGrid,
  canvasitem: Palette,
  animation: Play,
  audio: Volume2,
  physics: Zap,
  resource: FileCode,
};

export function NodeDropdownPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<GodotNode | null>(null);
  const [propertyValues, setPropertyValues] = useState<Record<string, string>>({});
  const [generatedCode, setGeneratedCode] = useState("");
  const [builtInFunction, setBuiltInFunction] = useState("_ready");
  const { toast } = useToast();

  const filteredNodes = searchQuery
    ? godotNodes.filter(
        (n) =>
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : godotNodes;

  const handleNodeSelect = (node: GodotNode) => {
    setSelectedNode(node);
    setPropertyValues({});
    setGeneratedCode("");
  };

  const handlePropertyChange = (propName: string, value: string) => {
    setPropertyValues((prev) => ({
      ...prev,
      [propName]: value,
    }));
  };

  const generateCode = () => {
    if (!selectedNode) return;

    let code = `extends ${selectedNode.inherits || "Node"}\n\n`;

    const filledProps = Object.entries(propertyValues).filter(
      ([, value]) => value && value.trim() !== ""
    );

    if (filledProps.length > 0) {
      code += `func ${builtInFunction}() -> void:\n`;
      
      filledProps.forEach(([propName, value]) => {
        const prop = selectedNode.properties.find((p) => p.name === propName);
        if (prop) {
          let formattedValue = value;
          
          if (prop.type === "String" || prop.type === "StringName") {
            formattedValue = `"${value}"`;
          } else if (prop.type === "Vector2") {
            if (!value.includes("Vector2")) {
              const parts = value.split(",").map((v) => v.trim());
              if (parts.length === 2) {
                formattedValue = `Vector2(${parts[0]}, ${parts[1]})`;
              }
            }
          } else if (prop.type === "Vector3") {
            if (!value.includes("Vector3")) {
              const parts = value.split(",").map((v) => v.trim());
              if (parts.length === 3) {
                formattedValue = `Vector3(${parts[0]}, ${parts[1]}, ${parts[2]})`;
              }
            }
          }
          
          code += `\t${propName} = ${formattedValue}\n`;
        }
      });
    } else {
      code += `func ${builtInFunction}() -> void:\n`;
      code += `\tpass\n`;
    }

    setGeneratedCode(code);
    toast({
      title: "Code Generated!",
      description: `Generated code for ${selectedNode.name}`,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="lg:w-[350px] space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Box className="h-5 w-5 text-primary" />
              Godot 4.4 Nodes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-nodes"
              />
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="h-[500px]">
          <Accordion type="multiple" defaultValue={["node", "node2d", "physics"]} className="space-y-2">
            {godotNodeCategories.map((category) => {
              const CategoryIcon = categoryIcons[category.id] || Box;
              const categoryNodes = searchQuery
                ? filteredNodes.filter((n) => n.category === category.id)
                : getNodesByCategory(category.id);

              if (categoryNodes.length === 0) return null;

              return (
                <AccordionItem key={category.id} value={category.id} className="border rounded-md">
                  <AccordionTrigger className="px-3 py-2 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {categoryNodes.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="space-y-1 pb-2">
                      {categoryNodes.map((node) => (
                        <Button
                          key={node.name}
                          variant={selectedNode?.name === node.name ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start text-sm"
                          onClick={() => handleNodeSelect(node)}
                          data-testid={`button-node-${node.name}`}
                        >
                          <ChevronRight className="h-3 w-3 mr-1" />
                          {node.name}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      </div>

      <div className="flex-1 space-y-4">
        {selectedNode ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">{selectedNode.name}</CardTitle>
                    {selectedNode.inherits && (
                      <p className="text-xs text-muted-foreground mt-1">
                        extends {selectedNode.inherits}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{selectedNode.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{selectedNode.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Scriptable Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target Function</Label>
                  <Select value={builtInFunction} onValueChange={setBuiltInFunction}>
                    <SelectTrigger data-testid="select-target-function">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ready">_ready()</SelectItem>
                      <SelectItem value="_process">_process(delta)</SelectItem>
                      <SelectItem value="_physics_process">_physics_process(delta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-[200px]">
                  <div className="space-y-3 pr-4">
                    {selectedNode.properties
                      .filter((p: any) => p.scriptable)
                      .map((prop: any) => (
                        <div key={prop.name} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs">{prop.name}</Label>
                            <Badge variant="outline" className="text-xs">
                              {prop.type}
                            </Badge>
                          </div>
                          <Input
                            value={propertyValues[prop.name] || ""}
                            onChange={(e) => handlePropertyChange(prop.name, e.target.value)}
                            placeholder={prop.defaultValue || `Enter ${prop.type}`}
                            className="h-8 text-xs"
                            data-testid={`input-prop-${prop.name}`}
                          />
                          <p className="text-xs text-muted-foreground">{prop.description}</p>
                        </div>
                      ))}
                  </div>
                </ScrollArea>

                <Button onClick={generateCode} className="w-full" data-testid="button-generate-node-code">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Code
                </Button>
              </CardContent>
            </Card>

            {selectedNode.methods.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-2 pr-4">
                      {selectedNode.methods.map((method: any) => (
                        <div key={method.name} className="text-xs p-2 rounded bg-muted/50">
                          <code className="font-mono text-primary">
                            {method.name}(
                            {method.parameters.map((p: any, i: number) => (
                              <span key={p.name}>
                                {i > 0 && ", "}
                                <span className="text-muted-foreground">{p.name}</span>: {p.type}
                              </span>
                            ))}
                            ) -&gt; {method.returnType}
                          </code>
                          <p className="text-muted-foreground mt-1">{method.description}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center min-h-[300px]">
              <p className="text-muted-foreground text-sm text-center">
                Select a node from the left panel to view its properties and generate code
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:w-[400px]">
        <CodeOutput
          code={generatedCode}
          title="Node Code"
          onCodeChange={setGeneratedCode}
          onClear={() => setGeneratedCode("")}
        />
      </div>
    </div>
  );
}
