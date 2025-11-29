import type { Express } from "express";
import { createServer, type Server } from "http";
import { generateWithGemini, analyzeNodeStructure, debugCode, debugCodeWithErrors } from "./gemini";
import { generateWithGroq } from "./groq";
import { generateWithFallback } from "./ai-fallback";
import { generateSequenceCode } from "./code-generator";
import { ensureValidGDScript, generateParticleCode, generateSignalCode, generateRPCCode } from "./gdscript-formatter";
import { parseGDScriptFunctions, extractFunctionsFromScript, generateTscnFromScript } from "./gdscript-parser";
import { aiGenerateRequestSchema, sequenceGenerateRequestSchema, scratchGenerateRequestSchema, functionsParseRequestSchema, functionsGenerateRequestSchema, sceneGenerateRequestSchema, insertSavedScriptSchema, nodeInspectorRequestSchema, debugCodeRequestSchema, codeDebuggerRequestSchema } from "@shared/schema";
import { storage } from "./storage";
import { z } from "zod";
import { readdirSync, readFileSync } from "fs";
import path from "path";

// Dynamic import for templates
async function getTemplates() {
  try {
    const mod = await import("../client/src/lib/templates");
    return mod.templates || [];
  } catch {
    return [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const parsed = aiGenerateRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.errors 
        });
      }
      
      const { provider, model, prompt, context } = parsed.data;
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }
      
      let code: string;
      
      try {
        if (provider === "groq" && process.env.GROQ_API_KEY) {
          // Try Groq first if available, fall back to Gemini if it fails
          try {
            code = await generateWithGroq(model, prompt, context);
          } catch (groqError) {
            console.warn("[AI] Groq failed, falling back to Gemini:", groqError);
            code = await generateWithFallback(model, prompt, context);
          }
        } else {
          // Use Gemini with automatic fallback to Groq if rate limited
          code = await generateWithFallback(model, prompt, context);
        }
        
        code = ensureValidGDScript(code);
        res.json({ code, explanation: "" });
      } catch (apiError) {
        throw apiError;
      }
    } catch (error) {
      console.error("AI generation error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate code" 
      });
    }
  });

  app.post("/api/node-inspector/analyze", async (req, res) => {
    try {
      const parsed = nodeInspectorRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.errors 
        });
      }
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }
      
      const { imageBase64 } = parsed.data;
      const result = await analyzeNodeStructure(imageBase64);
      res.json(result);
    } catch (error) {
      console.error("Node analysis error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to analyze node structure" 
      });
    }
  });

  app.post("/api/code-debugger/analyze", async (req, res) => {
    try {
      const parsed = debugCodeRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.errors 
        });
      }
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }
      
      const { code } = parsed.data;
      const result = await debugCode(code);
      res.json(result);
    } catch (error) {
      console.error("Code debug error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to analyze code" 
      });
    }
  });

  app.post("/api/code-debugger/debug", async (req, res) => {
    try {
      const parsed = codeDebuggerRequestSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.errors 
        });
      }
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }
      
      const { code, errorText, errorImageBase64 } = parsed.data;
      const result = await debugCodeWithErrors(code, errorText, errorImageBase64);
      res.json(result);
    } catch (error) {
      console.error("Code debugger error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to debug code" 
      });
    }
  });

  app.post("/api/scratch/generate", async (req, res) => {
    try {
      const parsed = scratchGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { blocks } = parsed.data;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const blocksSummary = blocks.map(b => ({
        type: b.defType,
        nodeType: b.nodeType || "default",
        values: b.values
      }));

      const prompt = `Generate proper Godot 4.4 GDScript code that implements this visual block sequence exactly:
${JSON.stringify(blocksSummary, null, 2)}

REQUIREMENTS:
1. Respect EXACT block order - blocks must execute in sequence
2. Use proper node references (e.g., $AnimatedSprite2D, $Label, $AudioStreamPlayer)
3. Separate code into _ready(), _input(), _process() functions ONLY when needed
4. Key input blocks should trigger code in _input() function
5. Animations/labels should execute INSIDE their trigger's code block, not in _ready()
6. Movement blocks should go in _process() with delta
7. Use correct Godot 4.4 syntax with proper type hints
8. NO template code - only actual working code
9. Proper indentation with tabs

Example: If sequence is [Animation], [Key W], [Animation] - the second animation goes INSIDE the key handler, not _ready()`;

      const code = await generateWithGemini("gemini-2.5-flash", prompt);
      res.json({ code });
    } catch (error) {
      console.error("Scratch generation error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate code" });
    }
  });

  app.post("/api/sequence/generate", async (req, res) => {
    try {
      const bodySchema = z.object({
        blocks: z.array(z.any()),
        mode: z.enum(["builtin", "custom-function", "signal"]).default("builtin"),
        builtInFunction: z.string().optional(),
        customFunctionName: z.string().optional(),
        signalName: z.string().optional(),
      });
      
      const parsed = bodySchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.errors 
        });
      }
      
      const { blocks, mode, builtInFunction, customFunctionName, signalName } = parsed.data;
      
      let code = generateSequenceCode(
        blocks, 
        mode || "builtin",
        builtInFunction || "_physics_process",
        customFunctionName || "my_function",
        signalName || "my_signal"
      );
      code = ensureValidGDScript(code);
      
      res.json({ code });
    } catch (error) {
      console.error("Sequence generation error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate code" 
      });
    }
  });

  app.post("/api/particles/generate", async (req, res) => {
    try {
      const bodySchema = z.object({
        particleType: z.string(),
        amount: z.number().optional(),
        lifetime: z.number().optional(),
        speed: z.number().optional(),
        emissionRate: z.number().optional(),
        color: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
      });
      
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      
      const code = generateParticleCode(parsed.data);
      res.json({ code });
    } catch (error) {
      console.error("Particle generation error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate particle code" });
    }
  });

  app.post("/api/signals/generate", async (req, res) => {
    try {
      const bodySchema = z.object({
        sourceNode: z.string(),
        signalName: z.string(),
        targetMethod: z.string(),
        signalParams: z.string().optional(),
      });
      
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      
      const code = generateSignalCode(parsed.data);
      res.json({ code });
    } catch (error) {
      console.error("Signal generation error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate signal code" });
    }
  });

  app.post("/api/multiplayer/generate", async (req, res) => {
    try {
      const bodySchema = z.object({
        functionName: z.string(),
        rpcMode: z.string(),
        transferMode: z.string(),
        parameters: z.string().optional(),
        callLocal: z.boolean().optional(),
      });
      
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      
      const code = generateRPCCode(parsed.data);
      res.json({ code });
    } catch (error) {
      console.error("RPC generation error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate RPC code" });
    }
  });

  app.post("/api/ai/template-generate", async (req, res) => {
    try {
      const { templateId, templateCode, mode, variables } = req.body;
      
      const provider = process.env.GEMINI_API_KEY ? "gemini" : "groq";
      
      const systemPrompt = `You are a GDScript code generator for Godot 4.4.
Generate code for a template in ${mode} mode.

Template:
${templateCode}

IMPORTANT: Return a JSON object with this exact structure (no markdown, pure JSON):
{
  "code": "...generated GDScript code here...",
  "syncVariables": ["var_name1", "var_name2"]
}

For the code:
1. If mode is "Multiplayer":
   - Add @rpc decorators to functions that need Manual RPC (state changes, player input)
   - Do NOT add @rpc to functions that handle continuous state (use MultiplayerSynchronizer for those)
2. If mode is "Solo": remove all RPC decorators and multiplayer logic
3. Use Godot 4.4 best practices

For syncVariables:
- List variables that are good candidates for MultiplayerSynchronizer
- These should be continuous state variables (position, health, animation_state)
- NOT event-driven functions (join_game, take_damage calls)
- Examples: "player_position", "health", "animation_state", "is_moving"`;

      let response: string;
      
      if (provider === "gemini") {
        if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({ error: "Gemini API key not configured" });
        }
        response = await generateWithGemini("gemini-2.5-flash", systemPrompt, "");
      } else {
        if (!process.env.GROQ_API_KEY) {
          return res.status(500).json({ error: "Groq API key not configured" });
        }
        response = await generateWithGroq("llama-3.3-70b-versatile", systemPrompt, "");
      }
      
      let result = { code: response, syncVariables: [] };
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
          result.code = ensureValidGDScript(result.code);
        } else {
          result.code = ensureValidGDScript(response);
        }
      } catch {
        result.code = ensureValidGDScript(response);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Template generation error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate code" 
      });
    }
  });

  app.get("/api/templates/scripts", async (req, res) => {
    try {
      const templates = await getTemplates();
      const scripts = templates.map((template) => ({
        id: template.id,
        name: template.name,
        content: template.code,
        createdAt: Date.now(),
        category: template.category,
      }));
      res.json({ scripts });
    } catch (error) {
      console.error("Get template scripts error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get template scripts",
      });
    }
  });

  app.get("/api/saved-scripts", async (req, res) => {
    try {
      const scripts = await storage.getSavedScripts();
      res.json({ scripts });
    } catch (error) {
      console.error("Get saved scripts error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get saved scripts",
      });
    }
  });

  app.get("/api/saved-scripts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const script = await storage.getSavedScript(id);
      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }
      res.json({ script });
    } catch (error) {
      console.error("Get saved script error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get saved script",
      });
    }
  });

  app.post("/api/saved-scripts", async (req, res) => {
    try {
      const parsed = insertSavedScriptSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const script = await storage.saveSavedScript(parsed.data);
      res.json({ script });
    } catch (error) {
      console.error("Save script error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to save script",
      });
    }
  });

  app.post("/api/parse-functions", async (req, res) => {
    try {
      const parsed = functionsParseRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { script } = parsed.data;
      const functions = parseGDScriptFunctions(script);

      res.json({ functions });
    } catch (error) {
      console.error("Parse functions error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to parse functions",
      });
    }
  });

  app.post("/api/generate-functions", async (req, res) => {
    try {
      const parsed = functionsGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { script, selectedFunctions, provider, model } = parsed.data;

      if (selectedFunctions.length === 0) {
        return res.status(400).json({ error: "No functions selected" });
      }

      // Generate improved code using AI with FULL SCRIPT CONTEXT
      const functionList = selectedFunctions.join(", ");
      const prompt = `You are a Godot 4.4 GDScript expert. I have a script with multiple functions. I need you to EXTRACT and IMPROVE only these specific functions: ${functionList}

Here is the COMPLETE ORIGINAL SCRIPT:
\`\`\`gdscript
${script}
\`\`\`

TASK:
1. Extract ONLY these functions: ${functionList}
2. Include ALL class variables at the top (var, @export, @onready, const, signal) that these functions use
3. Keep function signatures identical
4. Improve the code quality while maintaining functionality
5. Add @rpc decorators where appropriate for multiplayer synchronization
6. Add proper type hints and Godot 4.4 best practices
7. Include descriptive comments
8. Make it production-ready and directly executable

REQUIREMENTS:
- Return ONLY valid GDScript code (no markdown, no explanations)
- Include all necessary class-level variables/properties
- Maintain exact function names and signatures
- For multiplayer games, use @rpc("any_peer"), @rpc("authority"), or @rpc("call_local")
- Code must be directly usable in Godot 4.4
- NO comments about what you're doing, only the code output`;

      let code: string;

      if (provider === "gemini") {
        if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({ error: "Gemini API key not configured" });
        }
        code = await generateWithGemini(model, prompt);
      } else if (provider === "groq") {
        if (!process.env.GROQ_API_KEY) {
          return res.status(500).json({ error: "Groq API key not configured" });
        }
        code = await generateWithGroq(model, prompt);
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }

      code = ensureValidGDScript(code);
      res.json({ code });
    } catch (error) {
      console.error("Generate functions error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate functions",
      });
    }
  });

  app.post("/api/generate-scene", async (req, res) => {
    try {
      const parsed = sceneGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const { script, provider, model } = parsed.data;

      const prompt = `Convert the following GDScript into a valid Godot 4.4 .tscn scene file. Analyze the script to understand the scene structure and generate appropriate nodes:

${script}

REQUIREMENTS:
1. Generate a valid .tscn format file
2. Extract nodes referenced in the script (e.g., $Node3D, $AnimatedSprite2D)
3. Create appropriate node hierarchy
4. Include the script as an external resource
5. Set up node properties based on script usage
6. Use Godot 4.4 syntax
7. Return ONLY the .tscn content, no markdown or explanations

Format example:
[gd_scene load_steps=2 format=3 uid="uid://..."]
[ext_resource type="Script" path="res://script.gd" id="1_abc"]
[node name="Root" type="Node3D"]
...`;

      let tscnContent: string;

      if (provider === "gemini") {
        if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({ error: "Gemini API key not configured" });
        }
        tscnContent = await generateWithGemini(model, prompt);
      } else if (provider === "groq") {
        if (!process.env.GROQ_API_KEY) {
          return res.status(500).json({ error: "Groq API key not configured" });
        }
        tscnContent = await generateWithGroq(model, prompt);
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }

      // Count nodes in the generated .tscn file
      const nodeCount = (tscnContent.match(/\[node\s+name=/g) || []).length;

      res.json({
        tscnContent: tscnContent.trim(),
        nodeCount: Math.max(1, nodeCount),
      });
    } catch (error) {
      console.error("Generate scene error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate scene",
      });
    }
  });

  // Endpoint to list all .gd files from attached_assets
  app.get("/api/gd-files", (req, res) => {
    try {
      const assetsPath = path.join(process.cwd(), "attached_assets");
      const files = readdirSync(assetsPath)
        .filter(file => file.endsWith(".gd"))
        .map(file => ({
          id: file,
          name: file.replace(/\.gd$/, ""),
          filename: file,
        }));
      res.json({ files });
    } catch (error) {
      console.error("Error reading gd files:", error);
      res.status(500).json({ error: "Failed to read gd files" });
    }
  });

  // Endpoint to read a specific .gd file
  app.get("/api/gd-files/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      if (!filename.endsWith(".gd")) {
        return res.status(400).json({ error: "Invalid file" });
      }
      const filePath = path.join(process.cwd(), "attached_assets", filename);
      const content = readFileSync(filePath, "utf-8");
      res.json({ content });
    } catch (error) {
      console.error("Error reading gd file:", error);
      res.status(500).json({ error: "Failed to read gd file" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok",
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
    });
  });

  return httpServer;
}
