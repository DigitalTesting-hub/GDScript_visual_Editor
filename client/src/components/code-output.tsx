import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Edit, Check, Download } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface CodeOutputProps {
  code: string;
  title?: string;
  onCodeChange?: (code: string) => void;
  onClear?: () => void;
}

export function CodeOutput({ code, title = "Generated Code", onCodeChange, onClear }: CodeOutputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isEditing ? editedCode : code);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      onCodeChange?.(editedCode);
      setIsEditing(false);
    } else {
      setEditedCode(code);
      setIsEditing(true);
    }
  };

  const handleClear = () => {
    setEditedCode("");
    onClear?.();
    setIsEditing(false);
  };

  const handleDownload = () => {
    const blob = new Blob([isEditing ? editedCode : code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.gd";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "Script saved as script.gd",
    });
  };

  const displayCode = isEditing ? editedCode : code;

  if (!displayCode) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center min-h-[200px]">
          <p className="text-muted-foreground text-sm">
            Generated code will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            data-testid="button-copy-code"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            data-testid="button-download-code"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEdit}
            className={isEditing ? "bg-accent" : ""}
            data-testid="button-edit-code"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            data-testid="button-clear-code"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isEditing ? (
          <Textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            className="font-mono text-sm min-h-[300px] border-0 rounded-none resize-none focus-visible:ring-0"
            data-testid="textarea-code-edit"
          />
        ) : (
          <ScrollArea className="h-[300px]">
            <pre className="p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words" data-testid="text-generated-code">
              {displayCode}
            </pre>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function highlightGDScript(code: string): React.ReactNode {
  // Return plain text without HTML rendering - backend provides valid GDScript
  return code;
}
