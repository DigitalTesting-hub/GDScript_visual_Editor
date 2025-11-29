import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeOutput } from "@/components/code-output";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Eye, Wand2, Copy, Check, RotateCcw } from "lucide-react";
import type { DetectedNode, NodeInspectorResponse } from "@shared/schema";

export function NodeInspectorPanel() {
  const [imagePreview, setImagePreview] = useState<string>("");
  const [detectedNodes, setDetectedNodes] = useState<DetectedNode[]>([]);
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [rawNodeData, setRawNodeData] = useState<any[]>([]);
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (imageBase64: string) => {
      const response = await apiRequest("POST", "/api/node-inspector/analyze", {
        imageBase64,
      });
      return (await response.json()) as NodeInspectorResponse;
    },
    onSuccess: (data: any) => {
      setDetectedNodes(data.nodes);
      setGeneratedCode(data.code);
      setRawNodeData(data.rawNodes || []);
      toast({
        title: "Analysis Complete!",
        description: `Found ${data.nodes.length} node(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      analyzeMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setImagePreview("");
    setDetectedNodes([]);
    setGeneratedCode("");
    setRawNodeData([]);
    setCopied(false);
    toast({
      title: "Cleared",
      description: "Session reset. Ready for new image.",
    });
  };

  const handleVariableNameChange = (index: number, newName: string) => {
    const updated = [...detectedNodes];
    updated[index].variableName = newName;
    setDetectedNodes(updated);
    regenerateCode(updated, rawNodeData);
  };

  const regenerateCode = (nodes: DetectedNode[], rawNodes: any[]) => {
    const code = nodes
      .map((node) => {
        const rawNode = rawNodes.find((n: any) => n.name === node.name);
        let path = rawNode?.path || node.name;
        
        const rootNode = rawNodes.find((n: any) => !n.path?.includes("/"));
        const rootName = rootNode?.name || "";
        
        if (rootName && path.startsWith(rootName + "/")) {
          path = path.substring(rootName.length + 1);
        }
        
        return `@onready var ${node.variableName}: ${node.type} = $${path}`;
      })
      .join("\n");
    setGeneratedCode(code);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Node Structure Analyzer</CardTitle>
                  <CardDescription>
                    Upload a screenshot of your Godot scene tree to auto-generate @onready variables
                  </CardDescription>
                </div>
              </div>
              {imagePreview && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClear}
                  data-testid="button-clear-session"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-md p-8 text-center hover:bg-muted/50 transition-colors">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  data-testid="input-image-upload"
                />
                <div className="flex flex-col items-center gap-2">
                  <Eye className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {imagePreview ? "Click to change image" : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, WebP (max 5MB)</p>
                  </div>
                </div>
              </label>
            </div>

            {imagePreview && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <img
                  src={imagePreview}
                  alt="Node structure preview"
                  className="max-h-64 rounded-md border w-full object-cover"
                  data-testid="img-preview"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {detectedNodes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detected Nodes ({detectedNodes.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detectedNodes.map((node, idx) => (
                <div key={idx} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Variable Name</Label>
                    <Input
                      value={node.variableName}
                      onChange={(e) => handleVariableNameChange(idx, e.target.value)}
                      className="h-9"
                      data-testid={`input-varname-${idx}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Node Type</Label>
                    <div className="px-3 py-2 rounded-md bg-muted text-sm font-mono">
                      {node.type}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Path</Label>
                    <div className="px-3 py-2 rounded-md bg-muted text-sm font-mono">
                      ${node.name}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex-1 space-y-6">
        {analyzeMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Analyzing node structure...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {generatedCode && !analyzeMutation.isPending && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Generated Code
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="button-copy-code"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CodeOutput code={generatedCode} />
            </CardContent>
          </Card>
        )}

        {!generatedCode && !analyzeMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center min-h-[300px]">
              <div className="text-center text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Upload a node structure image to get started</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
