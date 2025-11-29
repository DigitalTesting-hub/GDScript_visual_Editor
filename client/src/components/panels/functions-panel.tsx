import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CodeOutput } from "@/components/code-output";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Code2, CheckSquare, Save, Upload, Trash2 } from "lucide-react";
import type { AIProvider, ParsedFunction, SavedScript } from "@shared/schema";

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

export function FunctionsPanel() {
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [model, setModel] = useState(AI_MODELS.gemini[0].id);
  const [functions, setFunctions] = useState<ParsedFunction[]>([]);
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set());
  const [generatedCode, setGeneratedCode] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [newScriptName, setNewScriptName] = useState("");
  const { toast } = useToast();

  // Load GD files from attached_assets
  const { data: gdFilesData } = useQuery({
    queryKey: ["/api/gd-files"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gd-files");
      return await response.json() as { files: Array<{ id: string; name: string; filename: string }> };
    },
  });

  const scripts = gdFilesData?.files || [];

  const parseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/parse-functions", {
        script: scriptContent,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setFunctions(data.functions || []);
      setSelectedFunctions(new Set());
      setGeneratedCode("");
      toast({
        title: "Script Parsed",
        description: `Found ${data.functions?.length || 0} functions`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Parse Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate-functions", {
        script: scriptContent,
        selectedFunctions: Array.from(selectedFunctions),
        provider,
        model,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      toast({
        title: "Code Generated!",
        description: "Selected functions with variables and connections generated",
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

  const saveScriptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/saved-scripts", {
        name: newScriptName || "Untitled Script",
        content: scriptContent,
        category: "custom",
      });
      return await response.json();
    },
    onSuccess: () => {
      setNewScriptName("");
      toast({
        title: "Script Saved!",
        description: "Script has been saved to custom scripts",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScriptSelect = async (scriptId: string) => {
    try {
      const response = await apiRequest("GET", `/api/gd-files/${scriptId}`);
      const data = await response.json() as { content: string };
      setScriptContent(data.content);
      setFunctions([]);
      setSelectedFunctions(new Set());
      setGeneratedCode("");
    } catch (error) {
      toast({
        title: "Failed to load script",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleFunctionToggle = (functionName: string) => {
    const newSelected = new Set(selectedFunctions);
    if (newSelected.has(functionName)) {
      newSelected.delete(functionName);
    } else {
      newSelected.add(functionName);
    }
    setSelectedFunctions(newSelected);
  };

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setModel(AI_MODELS[newProvider][0].id);
  };

  const handleSelectAll = () => {
    if (selectedFunctions.size === functions.length) {
      setSelectedFunctions(new Set());
    } else {
      setSelectedFunctions(new Set(functions.map((f) => f.name)));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setScriptContent(content);
      setFunctions([]);
      setSelectedFunctions(new Set());
      setGeneratedCode("");
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

  const handleClear = () => {
    setScriptContent("");
    setFunctions([]);
    setSelectedFunctions(new Set());
    setGeneratedCode("");
    setNewScriptName("");
    toast({
      title: "Cleared!",
      description: "All content has been cleared",
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5 text-primary" />
              Functions Extractor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="script-select" className="text-base font-medium">
                Select Shared Script
              </Label>
              <Select value="" onValueChange={handleScriptSelect}>
                <SelectTrigger id="script-select" data-testid="select-script">
                  <SelectValue placeholder="Choose a script..." />
                </SelectTrigger>
                <SelectContent>
                  {scripts.map((script) => (
                    <SelectItem key={script.id} value={script.id}>
                      {script.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scripts.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  No shared scripts yet. Paste code below to create one.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="script-input" className="text-base font-medium">
                  Or Paste Script Code
                </Label>
                {scriptContent && (
                  <span className="text-xs text-muted-foreground">
                    {scriptContent.split("\n").length} lines • {scriptContent.length} chars
                  </span>
                )}
              </div>
              <Textarea
                id="script-input"
                placeholder="Paste your complete GDScript code here..."
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                className="min-h-96 mt-2 font-mono text-sm resize-vertical overflow-auto"
                data-testid="textarea-script"
                spellCheck="false"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => parseMutation.mutate()}
                disabled={!scriptContent || parseMutation.isPending}
                data-testid="button-parse-script"
              >
                {parseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Parse Functions
              </Button>

              <label className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".gd"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
                    input?.click();
                  }}
                  data-testid="button-upload-file"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload .gd
                </Button>
              </label>

              <Button
                onClick={handleClear}
                disabled={!scriptContent && functions.length === 0 && generatedCode === ""}
                size="sm"
                variant="outline"
                data-testid="button-clear"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>

              <div className="flex gap-1 flex-1 min-w-fit">
                <input
                  type="text"
                  placeholder="Script name..."
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded border text-sm"
                  data-testid="input-script-name"
                />
                <Button
                  onClick={() => saveScriptMutation.mutate()}
                  disabled={!scriptContent || saveScriptMutation.isPending}
                  size="sm"
                  variant="outline"
                  data-testid="button-save-script"
                >
                  {saveScriptMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {!saveScriptMutation.isPending && <Save className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {functions.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">
                    Select Functions ({selectedFunctions.size}/{functions.length})
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAll}
                    data-testid="button-select-all"
                  >
                    {selectedFunctions.size === functions.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                  {functions.map((func) => (
                    <div key={func.name} className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedFunctions.has(func.name)}
                        onCheckedChange={() => handleFunctionToggle(func.name)}
                        id={`function-${func.name}`}
                        data-testid={`checkbox-function-${func.name}`}
                      />
                      <label
                        htmlFor={`function-${func.name}`}
                        className="flex-1 cursor-pointer font-mono text-sm"
                      >
                        <span className="font-semibold text-primary">{func.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({func.returnType})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedFunctions.size > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="provider-select" className="text-sm">
                      AI Provider
                    </Label>
                    <Select value={provider} onValueChange={(value) => handleProviderChange(value as AIProvider)}>
                      <SelectTrigger id="provider-select" data-testid="select-provider">
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
                      <SelectTrigger id="model-select" data-testid="select-model">
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
                  disabled={selectedFunctions.size === 0 || generateMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-functions"
                >
                  {generateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Generate with Variables & Connections
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {generatedCode && (
        <div className="flex-1">
          <CodeOutput code={generatedCode} title="Generated Functions" />
        </div>
      )}
    </div>
  );
}
