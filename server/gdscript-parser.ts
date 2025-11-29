import type { ParsedFunction } from "@shared/schema";

export function parseGDScriptFunctions(script: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const lines = script.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Match function definition: func function_name(params) -> return_type:
    const funcMatch = trimmed.match(/^func\s+(\w+)\s*\((.*?)\)\s*(?:->\s*(\w+))?\s*:/);
    
    if (funcMatch) {
      const name = funcMatch[1];
      const paramsStr = funcMatch[2];
      const returnType = funcMatch[3] || "void";
      const signature = trimmed;
      
      // Parse parameters
      const parameters = paramsStr
        .split(",")
        .filter((p) => p.trim())
        .map((p) => {
          const parts = p.trim().split(":");
          return {
            name: parts[0].trim(),
            type: parts[1]?.trim() || "Variant",
          };
        });
      
      // Find end of function - look for next function at same indentation level
      let lineEnd = i;
      const funcIndent = line.search(/\S/); // Get indentation of func line
      
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        const nextTrimmed = nextLine.trim();
        
        // Skip empty lines
        if (!nextTrimmed) {
          lineEnd = j;
          continue;
        }
        
        // Check if this is a new function at same indent level
        const nextIndent = nextLine.search(/\S/);
        const isNewFunc = nextTrimmed.match(/^func\s+\w+\s*\(/);
        
        if (isNewFunc && nextIndent <= funcIndent) {
          lineEnd = j - 1;
          break;
        }
        
        lineEnd = j;
      }
      
      functions.push({
        name,
        signature,
        lineStart: i,
        lineEnd,
        parameters,
        returnType,
      });
    }
  }
  
  return functions;
}

export function extractFunctionsFromScript(script: string, functionNames: string[]): string {
  const lines = script.split("\n");
  const result: string[] = [];
  
  // First, extract all class-level variables (var, @export, @onready, const, signal)
  let classVariablesEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.match(/^(var|const|@export|@onready|signal)\s+/)) {
      result.push(lines[i]);
      classVariablesEnd = i;
    } else if (trimmed.match(/^func\s+\w+\s*\(/)) {
      break; // Stop at first function
    }
  }
  
  // Add blank line after variables if we added any
  if (result.length > 0) {
    result.push("");
  }
  
  // Now extract the selected functions with their complete bodies
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    const funcMatch = trimmed.match(/^func\s+(\w+)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      
      if (functionNames.includes(funcName)) {
        // Add the function and all its body lines
        result.push(line);
        
        // Get the indentation of the function line to know where it ends
        const funcIndent = line.search(/\S/);
        i++;
        
        // Add all lines until we hit another function at same indentation
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextTrimmed = nextLine.trim();
          
          if (!nextTrimmed) {
            // Keep empty lines
            result.push(nextLine);
            i++;
            continue;
          }
          
          const nextIndent = nextLine.search(/\S/);
          const isNewFunc = nextTrimmed.match(/^func\s+\w+\s*\(/);
          
          if (isNewFunc && nextIndent <= funcIndent) {
            // Next function found, don't include it
            break;
          }
          
          result.push(nextLine);
          i++;
        }
        
        result.push(""); // Blank line between functions
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  
  return result.join("\n").trim();
}

export function generateTscnFromScript(scriptContent: string): { tscnContent: string; nodeCount: number } {
  // Basic template for generating a .tscn file from a script
  // This is a simplified version - the AI will enhance it
  const nodeCount = 1; // Will be calculated by AI
  
  const tscnTemplate = `[gd_scene load_steps=2 format=3 uid="uid://generated_scene"]

[ext_resource type="Script" path="res://generated_script.gd" id="1_1a2b3c"]

[node name="GeneratedScene" type="Node3D"]
script = SubResource("1_1a2b3c")

# Generated from script:
# ${scriptContent.split("\n")[0]}
`;
  
  return {
    tscnContent: tscnTemplate,
    nodeCount,
  };
}
