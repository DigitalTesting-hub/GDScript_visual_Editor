import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeOutput } from "@/components/code-output";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  FileCode, Wand2, Sword, Target, Car, Users, 
  LayoutGrid, Skull 
} from "lucide-react";
import { templates, getTemplatesByCategory } from "@/lib/templates";
import type { TemplateCategory } from "@shared/schema";

const categoryIcons: Record<string, React.ElementType> = {
  enemy: Skull,
  player: Target,
  vehicle: Car,
  combat: Sword,
  multiplayer: Users,
  ui: LayoutGrid,
};

const categoryLabels: Record<string, string> = {
  enemy: "Enemy AI",
  player: "Player",
  vehicle: "Vehicles",
  combat: "Combat",
  multiplayer: "Multiplayer",
  ui: "UI",
};

export function TemplatesPanel() {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("enemy");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [selectedGdFile, setSelectedGdFile] = useState<string>("");
  const [gdFileContent, setGdFileContent] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedCode, setGeneratedCode] = useState("");
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
  const categoryTemplates = getTemplatesByCategory(selectedCategory);

  const handleGdFileSelect = async (fileId: string) => {
    setSelectedGdFile(fileId);
    setSelectedTemplate(null);
    try {
      const response = await apiRequest("GET", `/api/gd-files/${fileId}`);
      const data = await response.json() as { content: string };
      setGdFileContent(data.content);
      setGeneratedCode("");
    } catch (error) {
      toast({
        title: "Failed to load script",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setSelectedGdFile("");
    setGdFileContent("");
    const defaults: Record<string, string> = {};
    template.variables?.forEach((v: any) => {
      defaults[v.name] = v.defaultValue;
    });
    setVariableValues(defaults);
    setGeneratedCode("");
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const generateCode = () => {
    if (selectedGdFile) {
      setGeneratedCode(gdFileContent);
      toast({
        title: "Script Loaded!",
        description: `Loaded complete GD script (${gdFileContent.split("\n").length} lines)`,
      });
      return;
    }

    if (!selectedTemplate) return;

    let code = selectedTemplate.code;
    
    // Replace template variables
    Object.entries(variableValues).forEach(([name, value]) => {
      const regex = new RegExp(`\\{\\{${name}\\}\\}`, "g");
      code = code.replace(regex, value);
    });

    selectedTemplate.variables?.forEach((variable: any) => {
      if (!variableValues[variable.name]) {
        const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, "g");
        code = code.replace(regex, variable.defaultValue);
      }
    });

    setGeneratedCode(code);
    toast({
      title: "Template Generated!",
      description: `Generated ${selectedTemplate.name} script`,
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCode className="h-5 w-5 text-primary" />
            Script Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as TemplateCategory)}
            orientation="horizontal"
          >
            <TabsList className="flex flex-wrap h-auto w-full gap-1 bg-transparent">
              {Object.entries(categoryLabels).map(([key, label]) => {
                const Icon = categoryIcons[key] || FileCode;
                const count = getTemplatesByCategory(key as TemplateCategory).length;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="gap-1 data-[state=active]:bg-accent"
                    data-testid={`tab-category-${key}`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex-1 space-y-4 min-h-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Load Complete GD Scripts</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedGdFile} onValueChange={handleGdFileSelect}>
              <SelectTrigger data-testid="select-gd-file">
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
          </CardContent>
        </Card>

        <ScrollArea className="h-full">
          <div className="space-y-2 pr-4">
            {categoryTemplates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center min-h-[100px]">
                  <p className="text-muted-foreground text-sm text-center">
                    No templates in this category
                  </p>
                </CardContent>
              </Card>
            ) : (
              categoryTemplates.map((template) => {
                const Icon = categoryIcons[template.category] || FileCode;
                return (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-colors hover-elevate ${
                      selectedTemplate?.id === template.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                    data-testid={`card-template-${template.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1">
                        {template.variables?.slice(0, 2).map((v: any) => (
                          <Badge key={v.name} variant="outline" className="text-xs">
                            {v.name}
                          </Badge>
                        ))}
                        {(template.variables?.length || 0) > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(template.variables?.length || 0) - 2} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>

        {selectedTemplate ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Configure: {selectedTemplate.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedTemplate.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[200px]">
                <div className="grid grid-cols-2 gap-4 pr-4">
                  {selectedTemplate.variables?.map((variable: any) => (
                    <div key={variable.name} className="space-y-1">
                      <Label className="text-xs flex items-center justify-between">
                        {variable.name}
                        <Badge variant="outline" className="text-xs ml-2">
                          {variable.type}
                        </Badge>
                      </Label>
                      <Input
                        value={variableValues[variable.name] || ""}
                        onChange={(e) =>
                          handleVariableChange(variable.name, e.target.value)
                        }
                        placeholder={variable.defaultValue}
                        className="h-8 text-xs"
                        type={variable.type === "float" || variable.type === "int" ? "number" : "text"}
                        data-testid={`input-template-var-${variable.name}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {variable.description}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                onClick={generateCode}
                className="w-full"
                data-testid="button-generate-template"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Script
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center min-h-[200px]">
              <p className="text-muted-foreground text-sm text-center">
                Select a template to configure and generate code
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:w-[450px]">
        <CodeOutput
          code={generatedCode}
          title="Template Code"
          onCodeChange={setGeneratedCode}
          onClear={() => setGeneratedCode("")}
        />
      </div>
    </div>
  );
}
