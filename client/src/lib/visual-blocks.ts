export interface VisualBlockDef {
  type: "key_input" | "movement" | "animation" | "label" | "wait" | "sound" | "condition" | "loop" | "property" | "sprite" | "emit" | "print";
  label: string;
  color: string;
  description?: string;
  inputs: VisualBlockInput[];
  nodeTypes?: string[];
}

export const nodeTypeOptions = [
  { value: "AnimationPlayer", label: "AnimationPlayer" },
  { value: "AnimatedSprite2D", label: "AnimatedSprite2D" },
  { value: "Sprite2D", label: "Sprite2D" },
  { value: "Label", label: "Label (2D)" },
  { value: "Label3D", label: "Label3D" },
  { value: "AudioStreamPlayer", label: "AudioStreamPlayer" },
  { value: "GPUParticles2D", label: "GPUParticles2D" },
  { value: "Node2D", label: "Node2D (Generic)" },
];

export interface VisualBlockInput {
  name: string;
  label: string;
  type: "select" | "text" | "number";
  options?: { value: string; label: string }[];
  defaultValue: string;
}

export const keyInputBlock: VisualBlockDef = {
  type: "key_input",
  label: "Key Input",
  color: "#3b82f6",
  description: "Trigger actions when a specific key is pressed, released, or held",
  inputs: [
    {
      name: "key",
      label: "Key",
      type: "select",
      options: [
        { value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }, { value: "D", label: "D" },
        { value: "E", label: "E" }, { value: "F", label: "F" }, { value: "G", label: "G" }, { value: "H", label: "H" },
        { value: "I", label: "I" }, { value: "J", label: "J" }, { value: "K", label: "K" }, { value: "L", label: "L" },
        { value: "M", label: "M" }, { value: "N", label: "N" }, { value: "O", label: "O" }, { value: "P", label: "P" },
        { value: "Q", label: "Q" }, { value: "R", label: "R" }, { value: "S", label: "S" }, { value: "T", label: "T" },
        { value: "U", label: "U" }, { value: "V", label: "V" }, { value: "W", label: "W" }, { value: "X", label: "X" },
        { value: "Y", label: "Y" }, { value: "Z", label: "Z" },
        { value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" },
        { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" }, { value: "7", label: "7" },
        { value: "8", label: "8" }, { value: "9", label: "9" },
        { value: "F1", label: "F1" }, { value: "F2", label: "F2" }, { value: "F3", label: "F3" }, { value: "F4", label: "F4" },
        { value: "F5", label: "F5" }, { value: "F6", label: "F6" }, { value: "F7", label: "F7" }, { value: "F8", label: "F8" },
        { value: "F9", label: "F9" }, { value: "F10", label: "F10" }, { value: "F11", label: "F11" }, { value: "F12", label: "F12" },
        { value: "Space", label: "Space" }, { value: "Enter", label: "Enter" }, { value: "Tab", label: "Tab" },
        { value: "Shift", label: "Shift" }, { value: "Ctrl", label: "Ctrl" }, { value: "Alt", label: "Alt" },
      ],
      defaultValue: "W",
    },
    {
      name: "action_type",
      label: "Action Type",
      type: "select",
      options: [
        { value: "pressed", label: "Pressed" },
        { value: "released", label: "Released" },
        { value: "held", label: "Held" },
      ],
      defaultValue: "pressed",
    },
    {
      name: "duration",
      label: "Duration if held (seconds)",
      type: "number",
      defaultValue: "1.0",
    },
  ],
};

export const movementBlock: VisualBlockDef = {
  type: "movement",
  label: "Movement",
  color: "#10b981",
  description: "Move object in a direction at specified speed",
  inputs: [
    {
      name: "direction",
      label: "Direction",
      type: "select",
      options: [
        { value: "z", label: "Forward (Z)" },
        { value: "-z", label: "Backward (-Z)" },
        { value: "x", label: "Right (X)" },
        { value: "-x", label: "Left (-X)" },
        { value: "y", label: "Up (Y)" },
        { value: "-y", label: "Down (-Y)" },
      ],
      defaultValue: "z",
    },
    {
      name: "speed",
      label: "Speed",
      type: "number",
      defaultValue: "200",
    },
  ],
};

export const animationBlock: VisualBlockDef = {
  type: "animation",
  label: "Animation",
  color: "#8b5cf6",
  description: "Play an animation with custom speed and direction",
  nodeTypes: ["AnimationPlayer", "AnimatedSprite2D"],
  inputs: [
    {
      name: "animation_name",
      label: "Animation Name",
      type: "text",
      defaultValue: "walk",
    },
    {
      name: "speed",
      label: "Speed Scale",
      type: "number",
      defaultValue: "1.0",
    },
    {
      name: "direction",
      label: "Direction",
      type: "select",
      options: [
        { value: "forward", label: "Forward" },
        { value: "backward", label: "Backward" },
      ],
      defaultValue: "forward",
    },
  ],
};

export const labelBlock: VisualBlockDef = {
  type: "label",
  label: "Label",
  color: "#f59e0b",
  description: "Display and animate text on screen",
  nodeTypes: ["Label", "Label3D"],
  inputs: [
    {
      name: "text",
      label: "Text",
      type: "text",
      defaultValue: "Label Text",
    },
    {
      name: "color",
      label: "Color",
      type: "select",
      options: [
        { value: "red", label: "Red" },
        { value: "green", label: "Green" },
        { value: "blue", label: "Blue" },
        { value: "yellow", label: "Yellow" },
        { value: "white", label: "White" },
        { value: "black", label: "Black" },
      ],
      defaultValue: "white",
    },
    {
      name: "animation_style",
      label: "Animation Style",
      type: "select",
      options: [
        { value: "none", label: "None" },
        { value: "typewriter", label: "Typewriter" },
        { value: "blink", label: "Blink" },
        { value: "fade", label: "Fade" },
      ],
      defaultValue: "none",
    },
  ],
};

export const waitBlock: VisualBlockDef = {
  type: "wait",
  label: "Wait/Delay",
  color: "#ec4899",
  description: "Pause execution for a specified duration",
  inputs: [
    {
      name: "seconds",
      label: "Seconds",
      type: "number",
      defaultValue: "1.0",
    },
  ],
};

export const soundBlock: VisualBlockDef = {
  type: "sound",
  label: "Play Sound",
  color: "#06b6d4",
  description: "Play audio with optional volume control",
  nodeTypes: ["AudioStreamPlayer"],
  inputs: [
    {
      name: "audio_node",
      label: "AudioStreamPlayer",
      type: "text",
      defaultValue: "$AudioStreamPlayer",
    },
    {
      name: "volume_db",
      label: "Volume (dB)",
      type: "number",
      defaultValue: "0",
    },
  ],
};

export const conditionBlock: VisualBlockDef = {
  type: "condition",
  label: "If Condition",
  color: "#fbbf24",
  description: "Execute code only when condition is true",
  inputs: [
    {
      name: "condition",
      label: "Condition",
      type: "text",
      defaultValue: "is_on_floor()",
    },
  ],
};

export const loopBlock: VisualBlockDef = {
  type: "loop",
  label: "Repeat",
  color: "#d946ef",
  description: "Execute code multiple times",
  inputs: [
    {
      name: "times",
      label: "Times",
      type: "number",
      defaultValue: "3",
    },
  ],
};

export const propertyBlock: VisualBlockDef = {
  type: "property",
  label: "Set Property",
  color: "#14b8a6",
  description: "Modify object properties like visibility, position, etc",
  inputs: [
    {
      name: "node_path",
      label: "Node Path",
      type: "text",
      defaultValue: "self",
    },
    {
      name: "property",
      label: "Property Name",
      type: "text",
      defaultValue: "visible",
    },
    {
      name: "value",
      label: "Value",
      type: "text",
      defaultValue: "true",
    },
  ],
};

export const spriteBlock: VisualBlockDef = {
  type: "sprite",
  label: "Change Sprite",
  color: "#f97316",
  description: "Load and display a different sprite/texture",
  inputs: [
    {
      name: "sprite_path",
      label: "Sprite Path",
      type: "text",
      defaultValue: "res://assets/player.png",
    },
  ],
};

export const emitBlock: VisualBlockDef = {
  type: "emit",
  label: "Emit Particles",
  color: "#a855f7",
  description: "Create and emit particle effects",
  inputs: [
    {
      name: "particle_type",
      label: "Particle Type",
      type: "select",
      options: [
        { value: "fire", label: "Fire" },
        { value: "smoke", label: "Smoke" },
        { value: "dust", label: "Dust" },
        { value: "stars", label: "Stars" },
      ],
      defaultValue: "fire",
    },
    {
      name: "count",
      label: "Particle Count",
      type: "number",
      defaultValue: "10",
    },
  ],
};

export const printBlock: VisualBlockDef = {
  type: "print",
  label: "Debug Print",
  color: "#64748b",
  description: "Print debug messages to console",
  inputs: [
    {
      name: "message",
      label: "Message",
      type: "text",
      defaultValue: "Debug message",
    },
  ],
};

export const visualBlockDefs: VisualBlockDef[] = [
  keyInputBlock,
  movementBlock,
  animationBlock,
  labelBlock,
  waitBlock,
  soundBlock,
  conditionBlock,
  loopBlock,
  propertyBlock,
  spriteBlock,
  emitBlock,
  printBlock,
];
