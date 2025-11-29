/**
 * Context-aware GDScript code generator for visual blocks
 * Generates proper Godot 4.4 code respecting block sequence
 */

interface VisualBlock {
  id: string;
  defType: string;
  values: Record<string, any>;
}

type BlockContext = "ready" | "input" | "process" | "helper";

interface BlockHandler {
  context: BlockContext;
  priority: number;
  generate: (block: VisualBlock, indent: number) => string;
}

const handlers: Record<string, BlockHandler> = {
  animation: {
    context: "ready",
    priority: 0,
    generate: (b, ind) => {
      const name = b.values.animation_name || "walk";
      const speed = b.values.speed || "1.0";
      let code = `${"  ".repeat(ind)}$AnimatedSprite2D.play("${name}")\n`;
      if (speed !== "1.0") {
        code += `${"  ".repeat(ind)}$AnimatedSprite2D.speed_scale = ${speed}\n`;
      }
      return code;
    },
  },
  label: {
    context: "ready",
    priority: 0,
    generate: (b, ind) => {
      const text = b.values.text || "Label";
      const color = b.values.color || "white";
      let code = `${"  ".repeat(ind)}$Label.text = "${text}"\n`;
      const colorMap: Record<string, string> = {
        red: "Color.RED",
        green: "Color.GREEN",
        blue: "Color.BLUE",
        yellow: "Color.YELLOW",
        white: "Color.WHITE",
        black: "Color.BLACK",
      };
      code += `${"  ".repeat(ind)}$Label.modulate = ${colorMap[color] || "Color.WHITE"}\n`;
      return code;
    },
  },
  sprite: {
    context: "ready",
    priority: 0,
    generate: (b, ind) => {
      const path = b.values.sprite_path || "res://assets/player.png";
      return `${"  ".repeat(ind)}$Sprite2D.texture = load("${path}")\n`;
    },
  },
  property: {
    context: "ready",
    priority: 0,
    generate: (b, ind) => {
      const node = b.values.node_path || "self";
      const prop = b.values.property || "visible";
      const val = b.values.value || "true";
      return `${"  ".repeat(ind)}${node}.${prop} = ${val}\n`;
    },
  },
  key_input: {
    context: "input",
    priority: 100,
    generate: (b, ind) => {
      const key = b.values.key || "W";
      const actionType = b.values.action_type || "pressed";
      const keyMap: Record<string, string> = {
        A: "ui_left", B: "ui_right", C: "ui_down", D: "ui_up",
        E: "interact", W: "ui_up", Space: "ui_accept", Shift: "ui_select",
        Enter: "ui_accept", Tab: "ui_focus_next",
      };
      const keyConst = keyMap[key] || `ui_${key.toLowerCase()}`;
      return `${"  ".repeat(ind)}if Input.is_action_${actionType}("${keyConst}"):\n`;
    },
  },
  movement: {
    context: "process",
    priority: 0,
    generate: (b, ind) => {
      const direction = b.values.direction || "z";
      const speed = b.values.speed || "200";
      let dirCode = "0";
      if (direction === "x") dirCode = speed;
      else if (direction === "-x") dirCode = `-${speed}`;
      else if (direction === "y") dirCode = speed;
      else if (direction === "-y") dirCode = `-${speed}`;
      else if (direction === "z") dirCode = speed;
      else if (direction === "-z") dirCode = `-${speed}`;
      return `${"  ".repeat(ind)}position.x += ${dirCode} * delta\n`;
    },
  },
  condition: {
    context: "process",
    priority: 0,
    generate: (b, ind) => {
      const cond = b.values.condition || "is_on_floor()";
      return `${"  ".repeat(ind)}if ${cond}:\n`;
    },
  },
  wait: {
    context: "helper",
    priority: 0,
    generate: (b, ind) => {
      const seconds = b.values.seconds || "1.0";
      return `${"  ".repeat(ind)}await get_tree().create_timer(${seconds}).timeout\n`;
    },
  },
  sound: {
    context: "helper",
    priority: 0,
    generate: (b, ind) => {
      const node = b.values.audio_node || "$AudioStreamPlayer";
      const vol = b.values.volume_db || "0";
      let code = "";
      if (vol !== "0") {
        code += `${"  ".repeat(ind)}${node}.volume_db = ${vol}\n`;
      }
      code += `${"  ".repeat(ind)}${node}.play()\n`;
      return code;
    },
  },
  loop: {
    context: "helper",
    priority: 0,
    generate: (b, ind) => {
      const times = b.values.times || "3";
      return `${"  ".repeat(ind)}for i in range(${times}):\n`;
    },
  },
  print: {
    context: "helper",
    priority: 0,
    generate: (b, ind) => {
      const msg = b.values.message || "Debug";
      return `${"  ".repeat(ind)}print("${msg}")\n`;
    },
  },
  emit: {
    context: "helper",
    priority: 0,
    generate: (b, ind) => {
      const count = b.values.count || "10";
      return `${"  ".repeat(ind)}$GPUParticles2D.amount = ${count}\n${"  ".repeat(ind)}$GPUParticles2D.emitting = true\n`;
    },
  },
};

export function generateScratchCode(blocks: VisualBlock[]): string {
  if (blocks.length === 0) return "extends Node2D\n\nfunc _ready() -> void:\n\tpass\n";

  // Separate blocks by context
  const readyBlocks: VisualBlock[] = [];
  const inputTriggers: Array<{ index: number; block: VisualBlock }> = [];
  const actionBlocks: VisualBlock[] = [];

  blocks.forEach((block, idx) => {
    const handler = handlers[block.defType];
    if (!handler) return;

    if (block.defType === "key_input") {
      inputTriggers.push({ index: idx, block });
    } else if (handler.context === "ready") {
      readyBlocks.push(block);
    }
  });

  // Build _ready function
  let code = "extends Node2D\n\nfunc _ready() -> void:\n";
  if (readyBlocks.length === 0) {
    code += "\tpass\n";
  } else {
    readyBlocks.forEach((block) => {
      const handler = handlers[block.defType];
      if (handler) {
        code += handler.generate(block, 1);
      }
    });
  }

  // Build _input function for each trigger
  if (inputTriggers.length > 0) {
    code += "\nfunc _input(event: InputEvent) -> void:\n";

    inputTriggers.forEach((trigger, trigIdx) => {
      const handler = handlers[trigger.block.defType];
      if (handler) {
        code += handler.generate(trigger.block, 1);

        // Get blocks between this trigger and next trigger
        const nextTriggerIdx =
          trigIdx < inputTriggers.length - 1 ? inputTriggers[trigIdx + 1].index : blocks.length;
        const bodyBlocks = blocks.slice(trigger.index + 1, nextTriggerIdx);

        // Generate body of this input handler
        bodyBlocks.forEach((block) => {
          const bodyHandler = handlers[block.defType];
          if (bodyHandler && block.defType !== "key_input") {
            code += bodyHandler.generate(block, 2);
          }
        });
      }
    });
  }

  // Build _process function if needed
  const processBlocks = blocks.filter((b) => {
    const h = handlers[b.defType];
    return h && h.context === "process";
  });

  if (processBlocks.length > 0) {
    code += "\nfunc _process(delta: float) -> void:\n";
    processBlocks.forEach((block) => {
      const handler = handlers[block.defType];
      if (handler) {
        code += handler.generate(block, 1);
      }
    });
  }

  return code;
}
