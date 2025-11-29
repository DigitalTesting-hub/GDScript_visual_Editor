import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeOutput } from "@/components/code-output";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileJson, Trash2, Copy, Download, Upload } from "lucide-react";
import type { AIProvider } from "@shared/schema";

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

export function SceneGeneratorPanel() {
  const [script, setScript] = useState("");
  const [selectedGdFile, setSelectedGdFile] = useState<string>("");
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [model, setModel] = useState(AI_MODELS.gemini[0].id);
  const [generatedScene, setGeneratedScene] = useState("");
  const [nodeCount, setNodeCount] = useState(0);
  const { toast } = useToast();

  // Load GD files from attached_assets
  const { data: gdFilesData } = useQuery({
    queryKey: ["/api/gd-files"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gd-files");
      return await response.json() as { files: Array<{ id: string; name: string; filename: string }> };
    },
  });

  const gdFiles = gdFilesData?.files || [];

  const handleGdFileSelect = async (fileId: string) => {
    setSelectedGdFile(fileId);
    try {
      const response = await apiRequest("GET", `/api/gd-files/${fileId}`);
      const data = await response.json() as { content: string };
      setScript(data.content);
    } catch (error) {
      toast({
        title: "Failed to load script",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-scene", {
        script,
        provider,
        model,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setGeneratedScene(data.tscnContent);
      setNodeCount(data.nodeCount || 0);
      toast({
        title: "Scene Generated!",
        description: `Created .tscn file with ${data.nodeCount || 0} nodes`,
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

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setModel(AI_MODELS[newProvider][0].id);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedScene);
      toast({
        title: "Copied!",
        description: "Scene file copied to clipboard",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([generatedScene], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "generated_scene.tscn";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast({
      title: "Downloaded!",
      description: "Scene file downloaded",
    });
  };

  const handleClear = () => {
    setScript("");
    setSelectedGdFile("");
    setGeneratedScene("");
    setNodeCount(0);
    toast({
      title: "Cleared!",
      description: "All content has been cleared",
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setScript(content);
      setSelectedGdFile("");
      setGeneratedScene("");
      setNodeCount(0);
      event.target.value = "";
      toast({
        title: "File Uploaded!",
        description: `Loaded ${file.name} (${content.split("\n").length} lines)`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to read file",
        variant: "destructive",
      });
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileJson className="h-5 w-5 text-primary" />
              Scene Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="gd-file-select" className="text-base font-medium">
                Load Complete GD Script
              </Label>
              <Select value={selectedGdFile} onValueChange={handleGdFileSelect}>
                <SelectTrigger id="gd-file-select" data-testid="select-scene-gd-file">
                  <SelectValue placeholder="Select a GD file..." />
                </SelectTrigger>
                <SelectContent>
                  {gdFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base font-medium mb-2 block">Or Paste Your GDScript</Label>
              <div className="flex gap-2 mb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".gd"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload-scene"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
                      input?.click();
                    }}
                    data-testid="button-upload-file-scene"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload .gd
                  </Button>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClear}
                  disabled={!script && !selectedGdFile && !generatedScene}
                  data-testid="button-clear-scene"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <Textarea
                id="script-input"
                placeholder="Paste your GDScript code. The AI will convert it to a .tscn scene file..."
                value={script}
                onChange={(e) => {
                  setScript(e.target.value);
                  setSelectedGdFile("");
                }}
                className="min-h-40 font-mono text-sm"
                data-testid="textarea-scene-script"
              />
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="provider-select" className="text-sm">
                  AI Provider
                </Label>
                <Select value={provider} onValueChange={(value) => handleProviderChange(value as AIProvider)}>
                  <SelectTrigger id="provider-select" data-testid="select-scene-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="model-select" className="text-sm">
                  Model
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model-select" data-testid="select-scene-model">
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

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!script || generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-scene"
            >
              {generateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Scene (.tscn)
            </Button>

            {generatedScene && (
              <div className="flex gap-2 flex-wrap pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="button-copy-scene"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  data-testid="button-download-scene"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClear}
                  data-testid="button-clear-scene"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {generatedScene && (
        <div className="flex-1">
          <CodeOutput code={generatedScene} title={`Generated Scene (${nodeCount} nodes)`} />
        </div>
      )}
    </div>
  );
}
