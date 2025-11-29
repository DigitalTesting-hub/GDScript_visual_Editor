import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, AlertTriangle, Lightbulb, Loader2, Zap } from "lucide-react";
import type { CodeIssue, DebugCodeResponse } from "@shared/schema";

export function CodeAnalyzerPanel() {
  const [code, setCode] = useState("");
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [isValid, setIsValid] = useState(true);
  const { toast } = useToast();

  const debugMutation = useMutation({
    mutationFn: async (codeToAnalyze: string) => {
      const response = await apiRequest("POST", "/api/code-debugger/analyze", {
        code: codeToAnalyze,
      });
      return (await response.json()) as DebugCodeResponse;
    },
    onSuccess: (data) => {
      setIssues(data.issues);
      setIsValid(data.isValid);
      if (data.issues.length === 0) {
        toast({
          title: "Code Valid!",
          description: "No issues detected",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      if (newCode.trim()) {
        debugMutation.mutate(newCode);
      } else {
        setIssues([]);
        setIsValid(true);
      }
    },
    [debugMutation]
  );

  const getIssueColor = (type: string) => {
    switch (type) {
      case "error":
        return "text-red-600 dark:text-red-400";
      case "warning":
        return "text-amber-600 dark:text-amber-400";
      case "suggestion":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "suggestion":
        return <Lightbulb className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const errorCount = issues.filter((i) => i.type === "error").length;
  const warningCount = issues.filter((i) => i.type === "warning").length;
  const suggestionCount = issues.filter((i) => i.type === "suggestion").length;

  return (
    <div className="flex flex-col gap-6 h-full">
      <Card className="h-[75%] flex flex-col flex-shrink-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            GDScript Code Analyzer
          </CardTitle>
          <CardDescription>
            Paste your GDScript code and get realtime analysis with AI suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 space-y-3">
          <div className="relative flex-1 flex flex-col min-h-0">
            <div className="text-xs text-muted-foreground mb-2 pl-2">
              {code.split("\n").length} lines
            </div>
            <div className="flex-1 flex border rounded-md overflow-hidden min-h-0">
              <div className="bg-muted text-muted-foreground text-xs font-mono px-3 py-2 text-right select-none overflow-hidden whitespace-pre-line leading-relaxed">
                {code
                  .split("\n")
                  .map((_, i) => i + 1)
                  .join("\n")}
              </div>
              <Textarea
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Paste your GDScript code here..."
                className="flex-1 border-0 rounded-none font-mono text-sm resize-none focus-visible:ring-0 p-3"
                data-testid="textarea-gdscript-code"
              />
            </div>
          </div>

          {debugMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing code...
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Analysis Results</CardTitle>
            <div className="flex gap-2">
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {errorCount} Error{errorCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700">
                  {warningCount} Warning{warningCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {suggestionCount > 0 && (
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700">
                  {suggestionCount} Suggestion{suggestionCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden">
          {code.trim() === "" ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Paste code to get started
            </div>
          ) : issues.length === 0 ? (
            <div className="h-full flex items-center justify-center flex-col gap-2">
              <div className="text-sm text-green-600 dark:text-green-400 font-medium">✓ No issues found!</div>
              <p className="text-xs text-muted-foreground">Your code looks good</p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3">
                {issues.map((issue, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2 bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className={`mt-0.5 flex-shrink-0 ${getIssueColor(issue.type)}`}>
                          {getIssueIcon(issue.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${getIssueColor(issue.type)}`}>
                              Line {issue.lineNo}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs capitalize"
                            >
                              {issue.type}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mt-1">{issue.issue}</p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 pl-3 border-l-2 border-primary/30 space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Suggestion:</p>
                      <p className="text-sm">{issue.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
