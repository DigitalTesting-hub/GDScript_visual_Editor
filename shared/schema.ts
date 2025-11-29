import { z } from "zod";

export const aiProviderSchema = z.enum(["gemini", "groq"]);
export type AIProvider = z.infer<typeof aiProviderSchema>;

export const aiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: aiProviderSchema,
});
export type AIModel = z.infer<typeof aiModelSchema>;

export const aiGenerateRequestSchema = z.object({
  provider: aiProviderSchema,
  model: z.string(),
  prompt: z.string(),
  context: z.string().optional(),
});
export type AIGenerateRequest = z.infer<typeof aiGenerateRequestSchema>;

export const aiGenerateResponseSchema = z.object({
  code: z.string(),
  explanation: z.string().optional(),
});
export type AIGenerateResponse = z.infer<typeof aiGenerateResponseSchema>;

export const nodeInspectorRequestSchema = z.object({
  imageBase64: z.string(),
  fileName: z.string().optional(),
});
export type NodeInspectorRequest = z.infer<typeof nodeInspectorRequestSchema>;

export const detectedNodeSchema = z.object({
  name: z.string(),
  type: z.string(),
  variableName: z.string(),
});
export type DetectedNode = z.infer<typeof detectedNodeSchema>;

export const nodeInspectorResponseSchema = z.object({
  nodes: z.array(detectedNodeSchema),
  code: z.string(),
});
export type NodeInspectorResponse = z.infer<typeof nodeInspectorResponseSchema>;

export const codeIssueSchema = z.object({
  lineNo: z.number(),
  type: z.enum(["error", "warning", "suggestion"]),
  issue: z.string(),
  suggestion: z.string(),
});
export type CodeIssue = z.infer<typeof codeIssueSchema>;

export const debugCodeRequestSchema = z.object({
  code: z.string(),
});
export type DebugCodeRequest = z.infer<typeof debugCodeRequestSchema>;

export const debugCodeResponseSchema = z.object({
  issues: z.array(codeIssueSchema),
  isValid: z.boolean(),
});
export type DebugCodeResponse = z.infer<typeof debugCodeResponseSchema>;

export const codeDebuggerRequestSchema = z.object({
  code: z.string(),
  errorText: z.string(),
  errorImageBase64: z.string().optional(),
});
export type CodeDebuggerRequest = z.infer<typeof codeDebuggerRequestSchema>;

export const codeDebuggerResponseSchema = z.object({
  extractedError: z.string(),
  suggestions: z.string(),
});
export type CodeDebuggerResponse = z.infer<typeof codeDebuggerResponseSchema>;

export const godotNodeCategorySchema = z.enum([
  "Node",
  "Node2D",
  "Node3D",
  "Control",
  "CanvasItem",
  "Resource",
  "AudioStreamPlayer",
  "AnimationPlayer",
  "Physics",
]);
export type GodotNodeCategory = z.infer<typeof godotNodeCategorySchema>;

export const godotPropertySchema = z.object({
  name: z.string(),
  type: z.string(),
  defaultValue: z.string().optional(),
  description: z.string(),
  scriptable: z.boolean(),
});
export type GodotProperty = z.infer<typeof godotPropertySchema>;

export const godotMethodSchema = z.object({
  name: z.string(),
  returnType: z.string(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    defaultValue: z.string().optional(),
  })),
  description: z.string(),
});
export type GodotMethod = z.infer<typeof godotMethodSchema>;

export const godotSignalSchema = z.object({
  name: z.string(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
  })),
  description: z.string(),
});
export type GodotSignal = z.infer<typeof godotSignalSchema>;

export const godotNodeSchema = z.object({
  name: z.string(),
  category: z.string(),
  inherits: z.string().optional(),
  description: z.string(),
  properties: z.array(godotPropertySchema),
  methods: z.array(godotMethodSchema),
  signals: z.array(godotSignalSchema),
});
export type GodotNode = z.infer<typeof godotNodeSchema>;

export const sequenceBlockTypeSchema = z.enum([
  "trigger",
  "action",
  "signal",
  "function",
  "condition",
  "loop",
]);
export type SequenceBlockType = z.infer<typeof sequenceBlockTypeSchema>;

export const sequenceBlockSchema = z.object({
  id: z.string(),
  type: sequenceBlockTypeSchema,
  label: z.string(),
  description: z.string(),
  inputs: z.record(z.string(), z.any()),
  color: z.string(),
  order: z.number(),
});
export type SequenceBlock = z.infer<typeof sequenceBlockSchema>;

export const builtInFunctionSchema = z.enum([
  "_ready",
  "_process",
  "_physics_process",
  "_input",
  "_unhandled_input",
  "_enter_tree",
  "_exit_tree",
]);
export type BuiltInFunction = z.infer<typeof builtInFunctionSchema>;

export const signalTypeSchema = z.enum([
  "button",
  "area",
  "custom",
  "animation",
  "timer",
  "collision",
]);
export type SignalType = z.infer<typeof signalTypeSchema>;

export const rpcModeSchema = z.enum([
  "any_peer",
  "authority",
]);
export type RpcMode = z.infer<typeof rpcModeSchema>;

export const rpcTransferModeSchema = z.enum([
  "reliable",
  "unreliable",
  "unreliable_ordered",
]);
export type RpcTransferMode = z.infer<typeof rpcTransferModeSchema>;

export const multiplayerConfigSchema = z.object({
  functionName: z.string(),
  rpcMode: rpcModeSchema,
  transferMode: rpcTransferModeSchema,
  callLocal: z.boolean(),
  channel: z.number(),
});
export type MultiplayerConfig = z.infer<typeof multiplayerConfigSchema>;

export const templateCategorySchema = z.enum([
  "enemy",
  "player",
  "vehicle",
  "combat",
  "multiplayer",
  "ui",
  "auth",
  "battle_royale",
  "map",
]);
export type TemplateCategory = z.infer<typeof templateCategorySchema>;

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: templateCategorySchema,
  description: z.string(),
  code: z.string(),
  variables: z.array(z.object({
    name: z.string(),
    type: z.string(),
    defaultValue: z.string(),
    description: z.string(),
  })),
  previewImage: z.string().optional(),
});
export type Template = z.infer<typeof templateSchema>;

export const particlePresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string(),
  code: z.string(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    defaultValue: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    category: z.string().optional(),
  })),
});
export type ParticlePreset = z.infer<typeof particlePresetSchema>;

export const codeGenerateRequestSchema = z.object({
  nodeType: z.string(),
  inputs: z.record(z.string(), z.any()),
  builtInFunction: builtInFunctionSchema.optional(),
});
export type CodeGenerateRequest = z.infer<typeof codeGenerateRequestSchema>;

export const sequenceGenerateRequestSchema = z.object({
  blocks: z.array(sequenceBlockSchema),
  useAI: z.boolean().optional(),
  mode: z.enum(["builtin", "custom-function", "signal"]).default("builtin"),
  builtInFunction: builtInFunctionSchema.optional(),
  customFunctionName: z.string().optional(),
  signalName: z.string().optional(),
});
export type SequenceGenerateRequest = z.infer<typeof sequenceGenerateRequestSchema>;

export const signalConnectionSchema = z.object({
  sourceNode: z.string(),
  signalName: z.string(),
  targetNode: z.string(),
  methodName: z.string(),
  parameters: z.array(z.string()).optional(),
});
export type SignalConnection = z.infer<typeof signalConnectionSchema>;

export const scratchBlockSchema = z.object({
  id: z.string(),
  defType: z.string(),
  values: z.record(z.any()),
  nodeType: z.string().optional(),
  nodePath: z.string().optional(),
});
export type ScratchBlock = z.infer<typeof scratchBlockSchema>;

export const scratchGenerateRequestSchema = z.object({
  blocks: z.array(scratchBlockSchema),
});
export type ScratchGenerateRequest = z.infer<typeof scratchGenerateRequestSchema>;

export const parsedFunctionSchema = z.object({
  name: z.string(),
  signature: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
  })),
  returnType: z.string(),
});
export type ParsedFunction = z.infer<typeof parsedFunctionSchema>;

export const functionsParseRequestSchema = z.object({
  script: z.string(),
});
export type FunctionsParseRequest = z.infer<typeof functionsParseRequestSchema>;

export const functionsParseResponseSchema = z.object({
  functions: z.array(parsedFunctionSchema),
});
export type FunctionsParseResponse = z.infer<typeof functionsParseResponseSchema>;

export const functionsGenerateRequestSchema = z.object({
  script: z.string(),
  selectedFunctions: z.array(z.string()),
  provider: aiProviderSchema,
  model: z.string(),
});
export type FunctionsGenerateRequest = z.infer<typeof functionsGenerateRequestSchema>;

export const sceneGenerateRequestSchema = z.object({
  script: z.string(),
  provider: aiProviderSchema,
  model: z.string(),
});
export type SceneGenerateRequest = z.infer<typeof sceneGenerateRequestSchema>;

export const sceneGenerateResponseSchema = z.object({
  tscnContent: z.string(),
  nodeCount: z.number(),
});
export type SceneGenerateResponse = z.infer<typeof sceneGenerateResponseSchema>;

export const savedScriptSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  createdAt: z.number(),
  category: z.string().optional(),
});
export type SavedScript = z.infer<typeof savedScriptSchema>;

export const insertSavedScriptSchema = z.object({
  name: z.string(),
  content: z.string(),
  category: z.string().optional(),
});
export type InsertSavedScript = z.infer<typeof insertSavedScriptSchema>;
