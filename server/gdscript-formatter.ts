/**
 * GDScript formatter and validator for Godot 4.4
 * Ensures generated code follows best practices and proper syntax
 */

export interface FormattedCode {
  code: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function formatGDScript(code: string): FormattedCode {
  const errors: string[] = [];
  const warnings: string[] = [];
  let formatted = code;

  // Basic validation checks
  if (!code || code.trim().length === 0) {
    errors.push("Code is empty");
    return { code, isValid: false, errors, warnings };
  }

  // Ensure extends statement at top if missing
  if (!code.includes("extends")) {
    warnings.push("Missing 'extends' statement - code may not work as a complete script");
  }

  // Validate func syntax
  const funcMatches = code.match(/func\s+\w+\s*\(/g);
  if (funcMatches && funcMatches.length > 0) {
    funcMatches.forEach((match) => {
      if (!match.includes("func")) {
        errors.push(`Invalid function syntax: ${match}`);
      }
    });
  }

  // Check for common GDScript 4.4 syntax
  if (code.includes("onready")) {
    warnings.push("Use @onready annotation instead of onready variable");
  }

  if (code.includes("export(")) {
    warnings.push("Use @export annotation instead of export() function");
  }

  // Basic indentation check (assuming tabs)
  const lines = code.split("\n");
  let bracketBalance = 0;
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) return;

    // Count opening/closing brackets, parentheses, colons
    const opens = (line.match(/[{(\[]/g) || []).length;
    const closes = (line.match(/[})\\]]/g) || []).length;
    bracketBalance += opens - closes;

    // Check if line ends with colon but no content after
    if (trimmed.endsWith(":") && !trimmed.startsWith("if") && !trimmed.startsWith("func")) {
      // This is probably a function or control structure
      if (!trimmed.startsWith("func") && !trimmed.startsWith("class")) {
        // Warn about potential issues
      }
    }
  });

  if (bracketBalance !== 0) {
    errors.push(`Bracket mismatch: ${bracketBalance > 0 ? "Missing closing" : "Extra closing"} brackets`);
  }

  // Clean up common formatting issues
  formatted = formatted
    .split("\n")
    .map((line) => {
      // Fix tab inconsistency
      if (line.includes("    ")) {
        // Mixed spaces, convert to tabs
        const leadingSpaces = line.match(/^ +/)?.[0] || "";
        const tabs = Math.floor(leadingSpaces.length / 4);
        return "\t".repeat(tabs) + line.trim();
      }
      return line;
    })
    .join("\n");

  // Ensure proper function formatting
  formatted = formatted.replace(/func\s+(\w+)\s*\(/g, "func $1(");
  formatted = formatted.replace(/\)\s*->\s*/g, ") -> ");
  formatted = formatted.replace(/\s+:\s*$/gm, ":");

  return {
    code: formatted,
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function isValidGDScript(code: string): boolean {
  const result = formatGDScript(code);
  return result.isValid && result.errors.length === 0;
}

export function ensureValidGDScript(code: string): string {
  // Ensure script starts with extends
  if (!code.trim().startsWith("extends")) {
    code = "extends Node\n\n" + code;
  }

  // Ensure _ready function exists if not present
  if (!code.includes("func _ready")) {
    const lastFunc = code.lastIndexOf("func ");
    if (lastFunc === -1) {
      code += "\n\nfunc _ready() -> void:\n\tpass\n";
    }
  }

  const result = formatGDScript(code);
  return result.code;
}

export function generateParticleCode(params: {
  particleType: string;
  amount?: number;
  lifetime?: number;
  speed?: number;
  emissionRate?: number;
  color?: { r: number; g: number; b: number };
}): string {
  const {
    particleType = "GPUParticles2D",
    amount = 100,
    lifetime = 2.0,
    speed = 100,
    emissionRate = 50,
    color = { r: 1, g: 1, b: 1 },
  } = params;

  const is3D = particleType.includes("3D");

  let code = `extends ${particleType}\n\n`;
  code += `@export var emission_enabled: bool = true\n`;
  code += `@export var particle_amount: int = ${amount}\n`;
  code += `@export var particle_lifetime: float = ${lifetime}\n`;
  code += `@export var particle_speed: float = ${speed}\n\n`;

  code += `func _ready() -> void:\n`;
  code += `\tamount = particle_amount\n`;
  code += `\tlifetime = particle_lifetime\n`;
  code += `\temitting = emission_enabled\n\n`;

  code += `func start_emission() -> void:\n`;
  code += `\temitting = true\n\n`;

  code += `func stop_emission() -> void:\n`;
  code += `\temitting = false\n\n`;

  code += `func restart() -> void:\n`;
  code += `\trestart_emission()\n`;

  return ensureValidGDScript(code);
}

export function generateSignalCode(params: {
  sourceNode: string;
  signalName: string;
  targetMethod: string;
  signalParams?: string;
}): string {
  const { sourceNode, signalName, targetMethod, signalParams = "" } = params;

  let code = `extends Node\n\n`;
  code += `func _ready() -> void:\n`;
  code += `\t${sourceNode}.${signalName}.connect(${targetMethod})\n\n`;

  code += `func ${targetMethod}(${signalParams}) -> void:\n`;
  code += `\tpass\n`;

  return ensureValidGDScript(code);
}

export function generateRPCCode(params: {
  functionName: string;
  rpcMode: string;
  transferMode: string;
  parameters?: string;
  callLocal?: boolean;
}): string {
  const { functionName, rpcMode, transferMode, parameters = "", callLocal = false } = params;

  const rpcDecorator = callLocal
    ? `@rpc("${rpcMode}", "call_local", "${transferMode}")`
    : `@rpc("${rpcMode}", "call_remote", "${transferMode}")`;

  let code = `extends Node\n\n`;
  code += `${rpcDecorator}\n`;
  code += `func ${functionName}(${parameters}) -> void:\n`;
  code += `\tpass\n`;

  return ensureValidGDScript(code);
}
