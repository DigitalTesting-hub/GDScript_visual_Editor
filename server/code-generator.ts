import type { SequenceBlock } from "@shared/schema";

interface BlockInputs {
  [key: string]: any;
}

export function generateSequenceCode(
  blocks: SequenceBlock[],
  mode: "builtin" | "custom-function" | "signal" = "builtin",
  builtInFunction: string = "_physics_process",
  customFunctionName: string = "my_function",
  signalName: string = "my_signal"
): string {
  if (blocks.length === 0) {
    return "extends Node\n\nfunc _ready() -> void:\n\tpass\n";
  }

  let code = "extends CharacterBody2D\n\n";
  
  const variablesNeeded = new Set<string>();
  const signalsNeeded = new Set<string>();
  
  blocks.forEach((block) => {
    if (block.type === "action") {
      if (block.label === "Move Character") {
        variablesNeeded.add("speed");
      }
    }
  });

  if (variablesNeeded.has("speed")) {
    code += "@export var speed: float = 200.0\n";
  }
  
  // Add signal definition if using signal mode
  if (mode === "signal") {
    code += `signal ${signalName}\n`;
  }
  
  if (signalsNeeded.size > 0) {
    signalsNeeded.forEach((signal) => {
      code += `signal ${signal}\n`;
    });
  }
  
  code += "\n";

  const triggerBlocks = blocks.filter((b) => b.type === "trigger");
  const actionBlocks = blocks.filter((b) => b.type === "action" || b.type === "condition");

  if (triggerBlocks.length > 0 || actionBlocks.length > 0) {
    let funcName = builtInFunction;
    let funcParams = "";
    let funcHeader = "";

    if (mode === "builtin") {
      const hasDelta = ["_process", "_physics_process"].includes(builtInFunction);
      const hasEvent = ["_input", "_unhandled_input"].includes(builtInFunction);
      
      if (hasDelta) funcParams = "delta: float";
      if (hasEvent) funcParams = "event: InputEvent";
      funcHeader = `func ${builtInFunction}(${funcParams}) -> void:\n`;
    } else if (mode === "custom-function") {
      funcName = customFunctionName;
      funcHeader = `func ${customFunctionName}() -> void:\n`;
    } else if (mode === "signal") {
      funcHeader = `func _emit_${signalName}() -> void:\n`;
    }
    
    code += funcHeader;
    
    triggerBlocks.forEach((trigger, index) => {
      const triggerCode = generateTriggerCode(trigger);
      if (index > 0 && triggerCode.startsWith("if")) {
        code += "\n";
      }
      code += triggerCode;
      
      const relatedActions = actionBlocks;
      relatedActions.forEach((action) => {
        code += generateActionCode(action, true);
      });
    });

    if (triggerBlocks.length === 0) {
      actionBlocks.forEach((action) => {
        code += generateActionCode(action, false);
      });
    }
    
    if (blocks.some(b => b.label === "Move Character")) {
      code += "\tmove_and_slide()\n";
    }

    // Add signal emission at the end if in signal mode
    if (mode === "signal") {
      code += `\t${signalName}.emit()\n`;
    }
  }

  return code;
}

function generateTriggerCode(block: SequenceBlock): string {
  const inputs = block.inputs as BlockInputs;
  let code = "";

  switch (block.label) {
    case "Key Pressed":
      const key = inputs.key || "W";
      const actionType = inputs.action_type || "just_pressed";
      const keyConst = getKeyConstant(key);
      code += `\tif Input.is_action_${actionType}("${keyConst}"):\n`;
      break;

    case "Input Action":
      const actionName = inputs.action_name || "jump";
      const inputActionType = inputs.action_type || "just_pressed";
      code += `\tif Input.is_action_${inputActionType}("${actionName}"):\n`;
      break;

    case "Signal Received":
      const srcNode = inputs.source_node || "$Timer";
      const sigName = inputs.signal_name || "timeout";
      code += `\tif ${srcNode}.is_connected("${sigName}", Callable(self, "_on_signal")):\n`;
      code += `\t\tpass\n`;
      break;

    case "Area Entered":
      const areaNode = inputs.area_node || "$Area2D";
      const bodyGrp = inputs.body_group || "";
      code += `\t${areaNode}.area_entered.connect(_on_area_entered)\n`;
      code += `\tfunc _on_area_entered(area: Area2D) -> void:\n`;
      if (bodyGrp) {
        code += `\t\tif area.is_in_group("${bodyGrp}"):\n\t\t\tpass\n`;
      } else {
        code += `\t\tpass\n`;
      }
      break;

    case "Timer Timeout":
      const timer = inputs.timer_node || "$Timer";
      code += `\t${timer}.timeout.connect(_on_timer_timeout)\n`;
      code += `\tfunc _on_timer_timeout() -> void:\n\t\tpass\n`;
      break;

    case "Animation Finished":
      const player = inputs.anim_player || "$AnimationPlayer";
      code += `\t${player}.animation_finished.connect(_on_animation_finished)\n`;
      code += `\tfunc _on_animation_finished(anim_name: StringName) -> void:\n\t\tpass\n`;
      break;

    case "Collision":
      const collType = inputs.collision_type || "body_entered";
      code += `\tif ${collType}:\n\t\tpass\n`;
      break;

    default:
      code += `\tif true:\n`;
  }

  return code;
}

function generateActionCode(block: SequenceBlock, indented: boolean): string {
  const inputs = block.inputs as BlockInputs;
  const indent = indented ? "\t\t" : "\t";
  let code = "";

  switch (block.label) {
    case "Move Character":
      const direction = inputs.direction || "forward";
      const moveSpeed = inputs.speed || "200";
      const is3D = inputs.is_3d === "true";
      
      if (is3D) {
        switch (direction) {
          case "forward":
            code += `${indent}velocity.z = -${moveSpeed}\n`;
            break;
          case "backward":
            code += `${indent}velocity.z = ${moveSpeed}\n`;
            break;
          case "left":
            code += `${indent}velocity.x = -${moveSpeed}\n`;
            break;
          case "right":
            code += `${indent}velocity.x = ${moveSpeed}\n`;
            break;
          case "input_dir":
            code += `${indent}var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_backward")\n`;
            code += `${indent}velocity = Vector3(input_dir.x, 0, input_dir.y) * ${moveSpeed}\n`;
            break;
        }
      } else {
        switch (direction) {
          case "forward":
          case "up":
            code += `${indent}velocity.y = -${moveSpeed}\n`;
            break;
          case "backward":
          case "down":
            code += `${indent}velocity.y = ${moveSpeed}\n`;
            break;
          case "left":
            code += `${indent}velocity.x = -${moveSpeed}\n`;
            break;
          case "right":
            code += `${indent}velocity.x = ${moveSpeed}\n`;
            break;
          case "input_dir":
            code += `${indent}var input_dir = Input.get_vector("move_left", "move_right", "move_up", "move_down")\n`;
            code += `${indent}velocity = input_dir * ${moveSpeed}\n`;
            break;
        }
      }
      break;

    case "Play Animation":
      const nodeType = inputs.node_type || "AnimatedSprite2D";
      const nodePath = inputs.node_path || "$AnimatedSprite2D";
      const animName = inputs.animation_name || "walk";
      const animSpeed = inputs.speed || "1.0";
      
      if (nodeType === "AnimationPlayer") {
        code += `${indent}${nodePath}.play("${animName}", -1, ${animSpeed})\n`;
      } else {
        code += `${indent}${nodePath}.play("${animName}")\n`;
        if (animSpeed !== "1.0") {
          code += `${indent}${nodePath}.speed_scale = ${animSpeed}\n`;
        }
      }
      break;

    case "Play Sound":
      const audioNode = inputs.audio_node || "$AudioStreamPlayer";
      const volumeDb = inputs.volume_db || "0";
      const pitchScale = inputs.pitch_scale || "1.0";
      
      if (volumeDb !== "0") {
        code += `${indent}${audioNode}.volume_db = ${volumeDb}\n`;
      }
      if (pitchScale !== "1.0") {
        code += `${indent}${audioNode}.pitch_scale = ${pitchScale}\n`;
      }
      code += `${indent}${audioNode}.play()\n`;
      break;

    case "Spawn Instance":
      const scenePath = inputs.scene_path || "res://scenes/bullet.tscn";
      const spawnPos = inputs.spawn_position || "self";
      const markerPath = inputs.marker_path || "";
      
      code += `${indent}var instance = preload("${scenePath}").instantiate()\n`;
      if (spawnPos === "marker" && markerPath) {
        code += `${indent}instance.global_position = ${markerPath}.global_position\n`;
      } else if (spawnPos === "self") {
        code += `${indent}instance.global_position = global_position\n`;
      }
      code += `${indent}get_tree().current_scene.add_child(instance)\n`;
      break;

    case "Set Property":
      const propNodePath = inputs.node_path || "self";
      const propName = inputs.property_name || "visible";
      const propValue = inputs.value || "true";
      code += `${indent}${propNodePath}.${propName} = ${propValue}\n`;
      break;

    case "Call Method":
      const methodNodePath = inputs.node_path || "self";
      const methodName = inputs.method_name || "my_method";
      const methodArgs = inputs.arguments || "";
      code += `${indent}${methodNodePath}.${methodName}(${methodArgs})\n`;
      break;

    case "Emit Signal":
      const signalName = inputs.signal_name || "my_signal";
      const signalParams = inputs.parameters || "";
      code += `${indent}${signalName}.emit(${signalParams})\n`;
      break;

    case "Start Timer":
      const timerNode = inputs.timer_node || "$Timer";
      const waitTime = inputs.wait_time || "1.0";
      const oneShot = inputs.one_shot || "true";
      code += `${indent}${timerNode}.wait_time = ${waitTime}\n`;
      code += `${indent}${timerNode}.one_shot = ${oneShot}\n`;
      code += `${indent}${timerNode}.start()\n`;
      break;

    case "Change Scene":
      const scenePathChange = inputs.scene_path || "res://scenes/main.tscn";
      code += `${indent}get_tree().change_scene_to_file("${scenePathChange}")\n`;
      break;

    case "Destroy Self":
      code += `${indent}queue_free()\n`;
      break;

    case "Apply Force/Impulse":
      const forceType = inputs.force_type || "impulse";
      const dirX = inputs.direction_x || "0";
      const dirY = inputs.direction_y || "-1";
      const strength = inputs.strength || "500";
      
      if (forceType === "impulse") {
        code += `${indent}apply_central_impulse(Vector2(${dirX}, ${dirY}) * ${strength})\n`;
      } else {
        code += `${indent}apply_force(Vector2(${dirX}, ${dirY}) * ${strength})\n`;
      }
      break;

    case "If Condition":
      const condition = inputs.condition || "is_on_floor()";
      code += `${indent}if ${condition}:\n`;
      code += `${indent}\tpass\n`;
      break;

    case "Is On Floor":
      code += `${indent}if is_on_floor():\n`;
      code += `${indent}\tpass\n`;
      break;

    case "Is In Group":
      const checkNode = inputs.node_path || "body";
      const groupName = inputs.group_name || "player";
      code += `${indent}if ${checkNode}.is_in_group("${groupName}"):\n`;
      code += `${indent}\tpass\n`;
      break;

    default:
      code += `${indent}pass\n`;
  }

  return code;
}

function getKeyConstant(key: string): string {
  const keyMap: Record<string, string> = {
    W: "move_up",
    A: "move_left",
    S: "move_down",
    D: "move_right",
    Space: "jump",
    Shift: "sprint",
    Ctrl: "crouch",
    E: "interact",
    R: "reload",
    Tab: "ui_focus_next",
    Escape: "ui_cancel",
    mouse_left: "attack",
    mouse_right: "aim",
  };
  return keyMap[key] || key.toLowerCase();
}
