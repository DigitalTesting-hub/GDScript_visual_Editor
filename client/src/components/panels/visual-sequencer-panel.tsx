import { useState } from "react";
import { VisualSequencer } from "@/components/visual-sequencer";
import { CodeOutput } from "@/components/code-output";
import { DimensionSelector } from "@/components/dimension-selector";
import { useToast } from "@/hooks/use-toast";

export function VisualSequencerPanel() {
  const [visualCode, setVisualCode] = useState("");
  const [dimension, setDimension] = useState<"2D" | "3D">("2D");
  const { toast } = useToast();

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1">
      <DimensionSelector dimension={dimension} onDimensionChange={setDimension} />
        <VisualSequencer
          onGenerateCode={(blocks, code) => {
            setVisualCode(code);
            toast({
              title: "Code Generated!",
              description: `Generated code from ${blocks.length} visual blocks`,
            });
          }}
        />
      </div>
      <div className="lg:w-[450px]">
        <CodeOutput
          code={visualCode}
          title="Generated Code"
          onCodeChange={setVisualCode}
          onClear={() => setVisualCode("")}
        />
      </div>
    </div>
  );
}
