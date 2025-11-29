import { Button } from "@/components/ui/button";
import { Box } from "lucide-react";

interface DimensionSelectorProps {
  dimension: "2D" | "3D";
  onDimensionChange: (dimension: "2D" | "3D") => void;
}

export function DimensionSelector({ dimension, onDimensionChange }: DimensionSelectorProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md mb-4">
      <Box className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">Dimension:</span>
      <div className="flex gap-1 ml-auto">
        <Button
          size="sm"
          variant={dimension === "2D" ? "default" : "outline"}
          onClick={() => onDimensionChange("2D")}
          data-testid="button-dimension-2d"
          className="h-7 px-3 text-xs"
        >
          2D
        </Button>
        <Button
          size="sm"
          variant={dimension === "3D" ? "default" : "outline"}
          onClick={() => onDimensionChange("3D")}
          data-testid="button-dimension-3d"
          className="h-7 px-3 text-xs"
        >
          3D
        </Button>
      </div>
    </div>
  );
}
