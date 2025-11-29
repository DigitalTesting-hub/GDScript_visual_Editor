import type { SequenceBlockType } from "@shared/schema";

export interface BlockDefinition {
  type: SequenceBlockType;
  label: string;
  description: string;
  color: string;
  icon: string;
  inputs: BlockInput[];
}

export interface BlockInput {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "key" | "node" | "signal" | "method";
  options?: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
}

export const triggerBlocks: BlockDefinition[] = [
  {
    type: "trigger",
    label: "Key Pressed",
    description: "Triggered when a key is pressed",
    color: "#3b82f6",
    icon: "Keyboard",
    inputs: [
      {
        name: "key",
        label: "Key",
        type: "select",
        options: [
          { value: "W", label: "W" },
          { value: "A", label: "A" },
          { value: "S", label: "S" },
          { value: "D", label: "D" },
          { value: "Space", label: "Space" },
          { value: "Shift", label: "Shift" },
          { value: "Ctrl", label: "Ctrl" },
          { value: "E", label: "E (Interact)" },
          { value: "R", label: "R (Reload)" },
          { value: "Tab", label: "Tab" },
          { value: "Escape", label: "Escape" },
          { value: "mouse_left", label: "Mouse Left" },
          { value: "mouse_right", label: "Mouse Right" },
        ],
        defaultValue: "W",
      },
      {
        name: "action_type",
        label: "Action Type",
        type: "select",
        options: [
          { value: "just_pressed", label: "Just Pressed" },
          { value: "pressed", label: "Held Down" },
          { value: "just_released", label: "Just Released" },
        ],
        defaultValue: "just_pressed",
      },
    ],
  },
  {
    type: "trigger",
    label: "Input Action",
    description: "Triggered by a named input action",
    color: "#3b82f6",
    icon: "Gamepad2",
    inputs: [
      {
        name: "action_name",
        label: "Action Name",
        type: "text",
        placeholder: "e.g., jump, attack, move_left",
        defaultValue: "jump",
      },
      {
        name: "action_type",
        label: "Action Type",
        type: "select",
        options: [
          { value: "just_pressed", label: "Just Pressed" },
          { value: "pressed", label: "Held Down" },
          { value: "just_released", label: "Just Released" },
        ],
        defaultValue: "just_pressed",
      },
    ],
  },
  {
    type: "trigger",
    label: "Signal Received",
    description: "Triggered when a signal is received",
    color: "#8b5cf6",
    icon: "Radio",
    inputs: [
      {
        name: "source_node",
        label: "Source Node",
        type: "text",
        placeholder: "$NodePath",
        defaultValue: "$Timer",
      },
      {
        name: "signal_name",
        label: "Signal Name",
        type: "text",
        placeholder: "timeout, pressed, etc.",
        defaultValue: "timeout",
      },
    ],
  },
  {
    type: "trigger",
    label: "Area Entered",
    description: "Triggered when a body enters an Area2D",
    color: "#8b5cf6",
    icon: "Square",
    inputs: [
      {
        name: "area_node",
        label: "Area Node",
        type: "text",
        placeholder: "$Area2D",
        defaultValue: "$Area2D",
      },
      {
        name: "body_group",
        label: "Body Group (optional)",
        type: "text",
        placeholder: "player, enemy, etc.",
      },
    ],
  },
  {
    type: "trigger",
    label: "Collision",
    description: "Triggered on collision",
    color: "#8b5cf6",
    icon: "Zap",
    inputs: [
      {
        name: "collision_type",
        label: "Collision Type",
        type: "select",
        options: [
          { value: "body_entered", label: "Body Entered" },
          { value: "body_exited", label: "Body Exited" },
          { value: "area_entered", label: "Area Entered" },
          { value: "area_exited", label: "Area Exited" },
        ],
        defaultValue: "body_entered",
      },
      {
        name: "target_group",
        label: "Target Group (optional)",
        type: "text",
        placeholder: "player, bullet, etc.",
      },
    ],
  },
  {
    type: "trigger",
    label: "Timer Timeout",
    description: "Triggered when a timer completes",
    color: "#8b5cf6",
    icon: "Clock",
    inputs: [
      {
        name: "timer_node",
        label: "Timer Node",
        type: "text",
        placeholder: "$Timer",
        defaultValue: "$Timer",
      },
    ],
  },
  {
    type: "trigger",
    label: "Animation Finished",
    description: "Triggered when an animation completes",
    color: "#8b5cf6",
    icon: "Play",
    inputs: [
      {
        name: "anim_player",
        label: "AnimationPlayer Node",
        type: "text",
        placeholder: "$AnimationPlayer",
        defaultValue: "$AnimationPlayer",
      },
      {
        name: "animation_name",
        label: "Animation Name (optional)",
        type: "text",
        placeholder: "attack, death, etc.",
      },
    ],
  },
];

export const actionBlocks: BlockDefinition[] = [
  {
    type: "action",
    label: "Move Character",
    description: "Move a CharacterBody2D/3D in a direction",
    color: "#10b981",
    icon: "Move",
    inputs: [
      {
        name: "direction",
        label: "Direction",
        type: "select",
        options: [
          { value: "forward", label: "Forward" },
          { value: "backward", label: "Backward" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "up", label: "Up (Jump)" },
          { value: "input_dir", label: "Input Direction" },
        ],
        defaultValue: "forward",
      },
      {
        name: "speed",
        label: "Speed",
        type: "number",
        defaultValue: "200",
      },
      {
        name: "is_3d",
        label: "3D Mode",
        type: "select",
        options: [
          { value: "false", label: "2D" },
          { value: "true", label: "3D" },
        ],
        defaultValue: "false",
      },
    ],
  },
  {
    type: "action",
    label: "Play Animation",
    description: "Play an animation on AnimationPlayer or AnimatedSprite",
    color: "#10b981",
    icon: "Film",
    inputs: [
      {
        name: "node_type",
        label: "Node Type",
        type: "select",
        options: [
          { value: "AnimationPlayer", label: "AnimationPlayer" },
          { value: "AnimatedSprite2D", label: "AnimatedSprite2D" },
          { value: "AnimatedSprite3D", label: "AnimatedSprite3D" },
        ],
        defaultValue: "AnimatedSprite2D",
      },
      {
        name: "node_path",
        label: "Node Path",
        type: "text",
        placeholder: "$AnimatedSprite2D",
        defaultValue: "$AnimatedSprite2D",
      },
      {
        name: "animation_name",
        label: "Animation Name",
        type: "text",
        placeholder: "walk, run, idle",
        defaultValue: "walk",
      },
      {
        name: "speed",
        label: "Speed Scale",
        type: "number",
        defaultValue: "1.0",
      },
    ],
  },
  {
    type: "action",
    label: "Apply Force/Impulse",
    description: "Apply force or impulse to RigidBody",
    color: "#10b981",
    icon: "ArrowUpRight",
    inputs: [
      {
        name: "force_type",
        label: "Force Type",
        type: "select",
        options: [
          { value: "impulse", label: "Impulse (Instant)" },
          { value: "force", label: "Force (Continuous)" },
        ],
        defaultValue: "impulse",
      },
      {
        name: "direction_x",
        label: "Direction X",
        type: "number",
        defaultValue: "0",
      },
      {
        name: "direction_y",
        label: "Direction Y",
        type: "number",
        defaultValue: "-1",
      },
      {
        name: "strength",
        label: "Strength",
        type: "number",
        defaultValue: "500",
      },
    ],
  },
  {
    type: "action",
    label: "Spawn Instance",
    description: "Instantiate and spawn a scene",
    color: "#10b981",
    icon: "Plus",
    inputs: [
      {
        name: "scene_path",
        label: "Scene Path",
        type: "text",
        placeholder: "res://scenes/bullet.tscn",
        defaultValue: "res://scenes/bullet.tscn",
      },
      {
        name: "spawn_position",
        label: "Spawn Position",
        type: "select",
        options: [
          { value: "self", label: "At Self" },
          { value: "marker", label: "At Marker2D" },
          { value: "custom", label: "Custom Position" },
        ],
        defaultValue: "self",
      },
      {
        name: "marker_path",
        label: "Marker Path (if marker)",
        type: "text",
        placeholder: "$Muzzle",
      },
    ],
  },
  {
    type: "action",
    label: "Play Sound",
    description: "Play an audio stream",
    color: "#10b981",
    icon: "Volume2",
    inputs: [
      {
        name: "audio_node",
        label: "AudioStreamPlayer",
        type: "text",
        placeholder: "$AudioStreamPlayer",
        defaultValue: "$AudioStreamPlayer",
      },
      {
        name: "volume_db",
        label: "Volume (dB)",
        type: "number",
        defaultValue: "0",
      },
      {
        name: "pitch_scale",
        label: "Pitch Scale",
        type: "number",
        defaultValue: "1.0",
      },
    ],
  },
  {
    type: "action",
    label: "Set Property",
    description: "Set a property value on a node",
    color: "#10b981",
    icon: "Settings",
    inputs: [
      {
        name: "node_path",
        label: "Node Path",
        type: "text",
        placeholder: "self or $NodePath",
        defaultValue: "self",
      },
      {
        name: "property_name",
        label: "Property Name",
        type: "text",
        placeholder: "visible, position, scale",
        defaultValue: "visible",
      },
      {
        name: "value",
        label: "Value",
        type: "text",
        placeholder: "true, Vector2(0, 0), etc.",
        defaultValue: "true",
      },
    ],
  },
  {
    type: "action",
    label: "Emit Signal",
    description: "Emit a custom signal",
    color: "#f59e0b",
    icon: "Radio",
    inputs: [
      {
        name: "signal_name",
        label: "Signal Name",
        type: "text",
        placeholder: "my_custom_signal",
        defaultValue: "my_signal",
      },
      {
        name: "parameters",
        label: "Parameters (comma-separated)",
        type: "text",
        placeholder: "param1, param2",
      },
    ],
  },
  {
    type: "action",
    label: "Call Method",
    description: "Call a method on a node",
    color: "#10b981",
    icon: "Play",
    inputs: [
      {
        name: "node_path",
        label: "Node Path",
        type: "text",
        placeholder: "$NodePath or self",
        defaultValue: "self",
      },
      {
        name: "method_name",
        label: "Method Name",
        type: "text",
        placeholder: "take_damage, heal, etc.",
        defaultValue: "my_method",
      },
      {
        name: "arguments",
        label: "Arguments (comma-separated)",
        type: "text",
        placeholder: "10, 'string', Vector2(0,0)",
      },
    ],
  },
  {
    type: "action",
    label: "Start Timer",
    description: "Start a timer",
    color: "#10b981",
    icon: "Clock",
    inputs: [
      {
        name: "timer_node",
        label: "Timer Node",
        type: "text",
        placeholder: "$Timer",
        defaultValue: "$Timer",
      },
      {
        name: "wait_time",
        label: "Wait Time (seconds)",
        type: "number",
        defaultValue: "1.0",
      },
      {
        name: "one_shot",
        label: "One Shot",
        type: "select",
        options: [
          { value: "true", label: "Yes" },
          { value: "false", label: "No (Repeat)" },
        ],
        defaultValue: "true",
      },
    ],
  },
  {
    type: "action",
    label: "Change Scene",
    description: "Change to another scene",
    color: "#10b981",
    icon: "Layers",
    inputs: [
      {
        name: "scene_path",
        label: "Scene Path",
        type: "text",
        placeholder: "res://scenes/main_menu.tscn",
        defaultValue: "res://scenes/main.tscn",
      },
    ],
  },
  {
    type: "action",
    label: "Destroy Self",
    description: "Queue this node for deletion",
    color: "#ef4444",
    icon: "Trash2",
    inputs: [],
  },
];

export const conditionBlocks: BlockDefinition[] = [
  {
    type: "condition",
    label: "If Condition",
    description: "Execute actions based on condition",
    color: "#f59e0b",
    icon: "GitBranch",
    inputs: [
      {
        name: "condition",
        label: "Condition",
        type: "text",
        placeholder: "is_on_floor(), health > 0, etc.",
        defaultValue: "is_on_floor()",
      },
    ],
  },
  {
    type: "condition",
    label: "Is On Floor",
    description: "Check if CharacterBody is on floor",
    color: "#f59e0b",
    icon: "ArrowDownToLine",
    inputs: [],
  },
  {
    type: "condition",
    label: "Is In Group",
    description: "Check if node is in a specific group",
    color: "#f59e0b",
    icon: "Users",
    inputs: [
      {
        name: "node_path",
        label: "Node to Check",
        type: "text",
        placeholder: "self or $NodePath",
        defaultValue: "body",
      },
      {
        name: "group_name",
        label: "Group Name",
        type: "text",
        placeholder: "player, enemy, etc.",
        defaultValue: "player",
      },
    ],
  },
];

export const functionBlocks: BlockDefinition[] = [
  {
    type: "function",
    label: "Custom Function",
    description: "Define a custom function",
    color: "#06b6d4",
    icon: "Code",
    inputs: [
      {
        name: "function_name",
        label: "Function Name",
        type: "text",
        placeholder: "my_function",
        defaultValue: "my_function",
      },
      {
        name: "parameters",
        label: "Parameters",
        type: "text",
        placeholder: "param1: int, param2: String",
      },
      {
        name: "return_type",
        label: "Return Type",
        type: "text",
        placeholder: "void, int, String, etc.",
        defaultValue: "void",
      },
    ],
  },
];

export const allBlocks = {
  triggers: triggerBlocks,
  actions: actionBlocks,
  conditions: conditionBlocks,
  functions: functionBlocks,
};

export function getBlockColor(type: SequenceBlockType): string {
  switch (type) {
    case "trigger":
      return "#3b82f6";
    case "action":
      return "#10b981";
    case "signal":
      return "#8b5cf6";
    case "function":
      return "#06b6d4";
    case "condition":
      return "#f59e0b";
    case "loop":
      return "#ec4899";
    default:
      return "#6b7280";
  }
}
