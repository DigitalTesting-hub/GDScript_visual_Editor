import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, RotateCcw, Wand2, Copy, Check } from "lucide-react";
import type { CodeDebuggerResponse } from "@shared/schema";

export function CodeDebuggerPanel() {
  const [code, setCode] = useState("");
  const [errorText, setErrorText] = useState("");
  const [errorImage, setErrorImage] = useState<string>("");
  const [suggestions, setSuggestions] = useState("");
  const [extractedError, setExtractedError] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const debugMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/code-debugger/debug", {
        code,
        errorText,
        errorImageBase64: errorImage,
      });
      return (await response.json()) as CodeDebuggerResponse;
    },
    onSuccess: (data) => {
      setExtractedError(data.extractedError);
      setSuggestions(data.suggestions);
      toast({
        title: "Analysis Complete!",
        description: "Suggestions generated",
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
      setErrorImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = useCallback(() => {
    if (!code.trim() && !errorText.trim() && !errorImage) {
      toast({
        title: "Missing Input",
        description: "Please provide code and error information",
        variant: "destructive",
      });
      return;
    }
    debugMutation.mutate();
  }, [code, errorText, errorImage, debugMutation, toast]);

  const handleClearCode = () => {
    setCode("");
    setSuggestions("");
    setExtractedError("");
  };

  const handleClearError = () => {
    setErrorText("");
    setErrorImage("");
    setSuggestions("");
    setExtractedError("");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Suggestions copied to clipboard",
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="grid grid-cols-2 gap-6 h-[40%]">
        {/* Code Box */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">GDScript Code</CardTitle>
              {code && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearCode}
                  data-testid="button-clear-code"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            <Textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setSuggestions("");
                setExtractedError("");
              }}
              placeholder="Paste your GDScript code here..."
              className="flex-1 border rounded font-mono text-sm resize-none p-2"
              data-testid="textarea-code-input"
            />
          </CardContent>
        </Card>

        {/* Error Box */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Error Info</CardTitle>
              {(errorText || errorImage) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearError}
                  data-testid="button-clear-error"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <CardDescription className="text-xs">
              Enter error text or upload error screenshot
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 space-y-2">
            <Textarea
              value={errorText}
              onChange={(e) => {
                setErrorText(e.target.value);
                setSuggestions("");
                setExtractedError("");
              }}
              placeholder="Paste error log or message..."
              className="flex-1 border rounded font-mono text-xs resize-none p-2"
              data-testid="textarea-error-input"
            />
            {errorImage && (
              <img
                src={errorImage}
                alt="Error preview"
                className="max-h-20 rounded border w-full object-cover"
                data-testid="img-error-preview"
              />
            )}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                data-testid="input-error-image"
              />
              <div className="border-2 border-dashed rounded p-2 text-center text-xs hover:bg-muted/50">
                {errorImage ? "Change image" : "Click to upload error screenshot"}
              </div>
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions Box */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              AI Suggestions
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAnalyze}
                disabled={debugMutation.isPending || (!code.trim() && !errorText.trim() && !errorImage)}
                data-testid="button-analyze"
              >
                {debugMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze"
                )}
              </Button>
              {suggestions && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="button-copy-suggestions"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden">
          {!suggestions ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {debugMutation.isPending ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p>Analyzing...</p>
                </div>
              ) : (
                "Click Analyze to get suggestions"
              )}
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {extractedError && (
                  <div className="border rounded p-3 bg-red-50 dark:bg-red-950">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Extracted Error:</p>
                    <p className="text-sm text-red-600 dark:text-red-400 font-mono">{extractedError}</p>
                  </div>
                )}
                <div className="border rounded p-3">
                  <p className="text-xs font-semibold mb-2">Fixes & Suggestions:</p>
                  <p className="text-sm whitespace-pre-wrap">{suggestions}</p>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
