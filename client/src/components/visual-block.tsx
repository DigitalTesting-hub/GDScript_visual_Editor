import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, ChevronUp, ChevronDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VisualBlockDef, VisualBlockInput } from "@/lib/visual-blocks";

import { nodeTypeOptions } from "@/lib/visual-blocks";

interface VisualBlockProps {
  id: string;
  def: VisualBlockDef;
  values: Record<string, any>;
  nodeType?: string;
  onValueChange: (inputName: string, value: any) => void;
  onNodeTypeChange?: (nodeType: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  index?: number;
  total?: number;
  onMove?: (index: number, direction: "up" | "down") => void;
}

export function VisualBlock({
  id,
  def,
  values,
  nodeType,
  onValueChange,
  onNodeTypeChange,
  onDelete,
  onDragStart,
  index = 0,
  total = 1,
  onMove,
}: VisualBlockProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-card border-l-4 rounded-md p-3 space-y-2 cursor-move hover:shadow-md transition-shadow"
      style={{ borderLeftColor: def.color }}
      data-testid={`visual-block-${id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm" style={{ color: def.color }}>
            {def.label}
          </span>
          {def.description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                {def.description}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex gap-1">
          {onMove && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove(index, "up")} disabled={index === 0} data-testid={`button-move-up-${id}`}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove(index, "down")} disabled={index === total - 1} data-testid={`button-move-down-${id}`}>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDelete}
            data-testid={`button-delete-${id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 pl-6">
        {def.nodeTypes && def.nodeTypes.length > 0 && onNodeTypeChange && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Node Type</Label>
            <Select value={nodeType || def.nodeTypes[0]} onValueChange={onNodeTypeChange}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-nodetype-${id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {def.nodeTypes.map((type) => {
                  const opt = nodeTypeOptions.find(o => o.value === type);
                  return (
                    <SelectItem key={type} value={type}>
                      {opt?.label || type}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
        {def.inputs.map((input: VisualBlockInput) => (
          <div key={input.name} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{input.label}</Label>
            {input.type === "select" ? (
              <Select
                value={values[input.name] || input.defaultValue}
                onValueChange={(val) => onValueChange(input.name, val)}
              >
                <SelectTrigger className="h-8 text-xs" data-testid={`select-${input.name}-${id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {input.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={input.type}
                value={values[input.name] || input.defaultValue}
                onChange={(e) => onValueChange(input.name, e.target.value)}
                placeholder={input.label}
                className="h-8 text-xs"
                data-testid={`input-${input.name}-${id}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
