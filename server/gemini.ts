import { GoogleGenAI } from "@google/genai";
import type { DetectedNode, NodeInspectorResponse, CodeIssue, DebugCodeResponse, CodeDebuggerResponse } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function toGodotType(typeStr: string): string {
  const typeMap: Record<string, string> = {
    "animationplayer": "AnimationPlayer",
    "animation": "AnimationPlayer",
    "audiostreampla": "AudioStreamPlayer",
    "audio": "AudioStreamPlayer",
    "label": "Label",
    "label3d": "Label3D",
    "sprite": "Sprite2D",
    "sprite2d": "Sprite2D",
    "sprite3d": "Sprite3D",
    "animatedsprite": "AnimatedSprite2D",
    "animatedsprite2d": "AnimatedSprite2D",
    "animatedsprite3d": "AnimatedSprite3D",
    "colisionshape": "CollisionShape3D",
    "collisionshape": "CollisionShape3D",
    "collisionshape3d": "CollisionShape3D",
    "collisionshape2d": "CollisionShape2D",
    "node": "Node",
    "node2d": "Node2D",
    "node3d": "Node3D",
    "control": "Control",
    "canvasitem": "CanvasItem",
    "area2d": "Area2D",
    "area3d": "Area3D",
    "characterbody": "CharacterBody3D",
    "characterbody3d": "CharacterBody3D",
    "characterbody2d": "CharacterBody2D",
    "rigidbody": "RigidBody3D",
    "rigidbody3d": "RigidBody3D",
    "rigidbody2d": "RigidBody2D",
  };
  
  const normalized = typeStr.toLowerCase().replace(/\s+/g, "");
  return typeMap[normalized] || typeStr;
}

function toVariableName(nodeName: string): string {
  return nodeName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    || "node";
}

export async function generateWithGemini(
  model: string,
  prompt: string,
  context?: string
): Promise<string> {
  const systemPrompt = `You are an expert GDScript developer for Godot 4.4. Generate SIMPLE, CLEAN, VALID GDScript code based on user requests.

CRITICAL RULES:
1. MINIMAL comments - only essential explanations, NO block comments
2. Use ONLY standard Godot 4.4 functions (no deprecated methods)
3. Include proper type hints for all function parameters and returns
4. Use @export and @onready annotations correctly

GODOT 4.4 STANDARD FUNCTIONS TO USE:
- Input: Input.is_key_pressed(KEY_W), Input.is_action_pressed("action_name")
- AnimationPlayer: player.play(name, -1, 1.0), player.stop()
- Timer: timer.start(), timer.timeout.connect(func_name)
- Signals: signal_name.emit(), signal_name.connect(func_name)
- Area2D: area_entered.connect(func_name), body_entered.connect(func_name)
- AudioStreamPlayer: audio.play(), audio.stop(), audio.volume_db = -80
- Tween: create_tween().tween_property(node, "position", Vector2(100, 100), 1.0)
- Process: _process(delta), _physics_process(delta), _input(event)
- Node queries: get_node("path"), find_child("name"), get_children()

CODE STYLE:
- Simple, readable variable names
- Logical structure with clear flow
- No unnecessary comments or documentation
- Keep functions focused and short
- Only output pure GDScript code in backticks

${context ? `Context: ${context}` : ""}`;

  try {
    const response = await ai.models.generateContent({
      model: model || "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: `Generate GDScript code for: ${prompt}` },
          ],
        },
      ],
    });

    const text = response.text || "";
    
    let code = text;
    const codeBlockMatch = text.match(/```(?:gdscript|gd)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1].trim();
    }

    return code;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Gemini Error] ${errorMsg}`);
    throw error;
  }
}

export async function analyzeNodeStructure(imageBase64: string): Promise<NodeInspectorResponse> {
  const prompt = `Analyze this Godot node structure image and extract all visible nodes with their types and parent-child relationships.
Return a JSON object with this structure:
{
  "nodes": [
    {"name": "NodeName", "type": "NodeType", "path": "Parent/Child/NodeName", "variableName": "node_name"}
  ]
}

IMPORTANT:
- Extract ONLY visible nodes from the scene tree
- Use proper Godot 4.4 node types (AnimationPlayer, Label, AudioStreamPlayer, etc.)
- CRITICAL: Include the FULL PATH hierarchy (e.g., "Player/Sprite" for a Sprite child of Player)
- Root level nodes should have path like "NodeName" (no leading slash)
- Child nodes should show full parent chain: "Parent/Child/GrandChild"
- Convert node names to snake_case for variable names
- Focus on the most common game nodes`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""),
              },
            },
          ],
        },
      ],
    });

    const text = response.text || "{}";
    
    let parsed: any = {};
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = { nodes: [] };
    }

    // Find root node (first level, no parent)
    const allRawNodes = parsed.nodes || [];
    const rootNode = allRawNodes.find((n: any) => {
      const path = n.path || "";
      return !path.includes("/");
    });
    const rootName = rootNode?.name || "";

    const nodes: DetectedNode[] = allRawNodes
      .filter((node: any) => node.name !== rootName) // Exclude root node itself
      .map((node: any) => ({
        name: node.name || "Node",
        type: toGodotType(node.type || "Node"),
        variableName: toVariableName(node.variableName || node.name || "node"),
      }));

    const code = nodes
      .map((node) => {
        const rawNode = allRawNodes.find((n: any) => n.name === node.name);
        let path = rawNode?.path || node.name;
        
        // Remove root node from path
        if (rootName && path.startsWith(rootName + "/")) {
          path = path.substring(rootName.length + 1);
        }
        
        return `@onready var ${node.variableName}: ${node.type} = $${path}`;
      })
      .join("\n");

    // Store raw node data for client-side regeneration
    if (typeof (process as any).browser !== "undefined" || true) {
      (parsed as any).rawNodes = allRawNodes;
    }

    return {
      nodes,
      code,
    };
  } catch (error) {
    console.error(`[Gemini Vision Error] ${error instanceof Error ? error.message : String(error)}`);
    return {
      nodes: [],
      code: "// Failed to analyze node structure",
    };
  }
}

export async function debugCode(gdscriptCode: string): Promise<DebugCodeResponse> {
  const prompt = `Analyze this GDScript code for Godot 4.4 and identify issues, warnings, and suggestions.
Return a JSON object with this EXACT structure:
{
  "issues": [
    {"lineNo": 5, "type": "error", "issue": "Missing colon after function definition", "suggestion": "Add ':' after 'func _ready()'"},
    {"lineNo": 10, "type": "warning", "issue": "Unused variable 'player'", "suggestion": "Remove or use the 'player' variable"},
    {"lineNo": 3, "type": "suggestion", "issue": "Consider adding type hints", "suggestion": "Change 'var speed' to 'var speed: float'"}
  ],
  "isValid": false
}

RULES:
- ONLY return JSON, nothing else
- Check for syntax errors, best practices, and Godot 4.4 conventions
- line numbers start from 1
- type can only be: "error", "warning", or "suggestion"
- isValid should be true only if there are NO errors (warnings/suggestions don't make it invalid)
- Focus on common GDScript issues: missing colons, wrong indentation, deprecated functions, type mismatches
- Include line numbers accurately

CODE TO ANALYZE:
${gdscriptCode}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { text: prompt },
          ],
        },
      ],
    });

    const text = response.text || "{}";
    
    let parsed: any = { issues: [], isValid: true };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = { issues: [], isValid: true };
    }

    const issues: CodeIssue[] = (parsed.issues || [])
      .filter((issue: any) => issue.lineNo && issue.type && issue.issue && issue.suggestion)
      .map((issue: any) => ({
        lineNo: Math.max(1, Math.min(parseInt(issue.lineNo) || 1, gdscriptCode.split("\n").length)),
        type: ["error", "warning", "suggestion"].includes(issue.type) ? issue.type : "suggestion",
        issue: String(issue.issue || "Unknown issue"),
        suggestion: String(issue.suggestion || "No suggestion available"),
      }));

    return {
      issues: issues.sort((a, b) => a.lineNo - b.lineNo),
      isValid: parsed.isValid === true && issues.filter((i) => i.type === "error").length === 0,
    };
  } catch (error) {
    console.error(`[Gemini Code Analysis Error] ${error instanceof Error ? error.message : String(error)}`);
    return {
      issues: [],
      isValid: false,
    };
  }
}

export async function debugCodeWithErrors(gdscriptCode: string, errorText: string, errorImageBase64?: string): Promise<CodeDebuggerResponse> {
  let extractedErrorText = errorText;
  
  try {
    // If error image is provided, extract text from it
    if (errorImageBase64) {
      const imageAnalysisPrompt = `Extract ALL error messages and log text from this image. Return ONLY the extracted text, nothing else.`;
      
      try {
        const imageResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                { text: imageAnalysisPrompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: errorImageBase64.replace(/^data:image\/[a-z]+;base64,/, ""),
                  },
                },
              ],
            },
          ],
        });
        
        extractedErrorText = imageResponse.text || errorText;
      } catch (imageError) {
        console.warn(`[Gemini Vision] Failed to extract error from image: ${imageError instanceof Error ? imageError.message : String(imageError)}`);
        // Continue with text error only
      }
    }

    const debugPrompt = `You are a GDScript expert for Godot 4.4. Analyze this code and error to provide fix suggestions.

GDScript Code:
\`\`\`gdscript
${gdscriptCode}
\`\`\`

Error/Issue:
${extractedErrorText}

Return ONLY a JSON object with this exact structure:
{
  "extractedError": "Summary of the error",
  "suggestions": "Detailed explanation of the fix with code examples"
}

Be concise and provide actionable fixes.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { text: debugPrompt },
          ],
        },
      ],
    });

    const text = response.text || "{}";
    
    let parsed: any = { extractedError: "", suggestions: "" };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsed = { extractedError: extractedErrorText, suggestions: text };
    }

    return {
      extractedError: parsed.extractedError || extractedErrorText || "Unknown error",
      suggestions: parsed.suggestions || "Unable to generate suggestions",
    };
  } catch (error) {
    console.error(`[Gemini Debugger Error] ${error instanceof Error ? error.message : String(error)}`);
    return {
      extractedError: errorText || "Analysis failed",
      suggestions: "Unable to generate suggestions due to an error. Please try again.",
    };
  }
}
