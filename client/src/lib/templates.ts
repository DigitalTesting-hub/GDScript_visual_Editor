import type { Template, ParticlePreset } from "@shared/schema";

export const templates: Template[] = [
  {
    id: "player-animation",
    name: "Character Animation",
    category: "player",
    description: "Animation controller managing stance, movement, combat animations with smooth transitions",
    code: `extends Node3D

const LERP_VELOCITY: float = 0.15
const LOOK_LERP_VELOCITY: float = 0.2

@export_category("Objects")
@export var _character: CharacterBody3D = null
@export var animation_player: AnimationPlayer = null

@export_category("Animation Settings")
@export var idle_speed: float = 1.0
@export var walk_speed: float = 1.0
@export var run_speed: float = 1.0
@export var melee_speed: float = 1.5
@export var firing_speed: float = 1.0

var is_melee_attacking: bool = false
var is_dancing: bool = false

func apply_rotation(_velocity: Vector3) -> void:
        if _velocity.length() < 0.1:
                return
        var new_rotation_y = lerp_angle(rotation.y, atan2(-_velocity.x, -_velocity.z), LERP_VELOCITY)
        rotation.y = new_rotation_y

func play_melee_animation():
        if not animation_player:
                return
        if animation_player.has_animation("Attack"):
                is_melee_attacking = true
                animation_player.play("Attack")
                animation_player.speed_scale = melee_speed
                await animation_player.animation_finished
                is_melee_attacking = false

func animate(_velocity: Vector3, stance: String, is_firing: bool = false) -> void:
        if not animation_player:
                return
        if is_melee_attacking:
                return
        
        apply_rotation(_velocity)
        
        var anim_to_play = ""
        var anim_speed = 1.0
        var is_moving = _velocity.length() > 0.1
        
        match stance:
                "normal":
                        if is_firing and is_moving:
                                anim_to_play = "RunFire"
                                anim_speed = firing_speed
                        elif is_moving:
                                anim_to_play = "Run"
                                anim_speed = run_speed
                        else:
                                anim_to_play = "Idle"
                                anim_speed = idle_speed
                "crouch":
                        if is_moving:
                                anim_to_play = "CrouchWalk"
                                anim_speed = walk_speed
                        else:
                                anim_to_play = "CrouchIdle"
                                anim_speed = idle_speed
        
        if animation_player.has_animation(anim_to_play):
                if animation_player.current_animation != anim_to_play:
                        animation_player.play(anim_to_play)
                animation_player.speed_scale = anim_speed`,
    variables: [
      { name: "idle_speed", type: "float", defaultValue: "1.0", description: "Idle animation speed" },
      { name: "walk_speed", type: "float", defaultValue: "1.0", description: "Walk animation speed" },
      { name: "run_speed", type: "float", defaultValue: "1.0", description: "Run animation speed" },
    ],
  },
  {
    id: "player-movement",
    name: "Player Movement",
    category: "player",
    description: "Complete player controller with movement, jumping, stance system (normal/crouch/prone), and multiplayer support",
    code: `extends CharacterBody3D

const NORMAL_SPEED = 2.0
const SPRINT_SPEED = 4.0
const CROUCH_SPEED = 1.0
const JUMP_VELOCITY = 4.0

@export var speed: float = NORMAL_SPEED
@export var jump_force: float = JUMP_VELOCITY
@export var crouch_speed: float = CROUCH_SPEED

var gravity = ProjectSettings.get_setting("physics/3d/default_gravity")
var current_stance: String = "normal"
var is_running: bool = false

func _physics_process(delta: float):
        if not is_on_floor():
                velocity.y -= gravity * delta
        
        var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
        var direction = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
        
        if direction:
                is_running = Input.is_action_pressed("toggle_run")
                var current_speed = SPRINT_SPEED if is_running else speed
                
                match current_stance:
                        "crouch":
                                current_speed = crouch_speed
                        "normal":
                                current_speed = SPRINT_SPEED if is_running else NORMAL_SPEED
                
                velocity.x = direction.x * current_speed
                velocity.z = direction.z * current_speed
        else:
                velocity.x = move_toward(velocity.x, 0, speed)
                velocity.z = move_toward(velocity.z, 0, speed)
        
        if Input.is_action_just_pressed("jump") and is_on_floor():
                velocity.y = jump_force
        
        if Input.is_action_just_pressed("crouch"):
                current_stance = "crouch" if current_stance == "normal" else "normal"
        
        move_and_slide()`,
    variables: [
      { name: "speed", type: "float", defaultValue: "2.0", description: "Base movement speed" },
      { name: "jump_force", type: "float", defaultValue: "4.0", description: "Jump force" },
    ],
  },
  {
    id: "player-camera",
    name: "Spring Arm Camera",
    category: "player",
    description: "Third-person camera controller using SpringArm3D with mouse look, pitch/yaw rotation, and multiplayer authority",
    code: `extends Node3D
class_name SpringArmCharacter

const MOUSE_SENSIBILITY: float = 0.005

@export_category("Objects")
@export var _spring_arm: SpringArm3D = null

func _unhandled_input(_event) -> void:
        if (_event is InputEventMouseMotion) and is_multiplayer_authority():
                rotate_y(-_event.relative.x * MOUSE_SENSIBILITY)
                _spring_arm.rotate_x(-_event.relative.y * MOUSE_SENSIBILITY)
                _spring_arm.rotation.x = clamp(_spring_arm.rotation.x, -PI/4, PI/24)`,
    variables: [
      { name: "MOUSE_SENSIBILITY", type: "float", defaultValue: "0.005", description: "Mouse look sensitivity multiplier" },
    ],
  },
  {
    id: "player-touch-controls",
    name: "Touch Controls",
    category: "player",
    description: "Mobile touch input system with multi-touch support, screen-divided movement/attack zones, mobile buttons fallback, and full keyboard support",
    code: `extends CharacterBody3D

@export var speed = 3.0
@export var max_hp = 100
@export var attack_damage = 25

var current_hp: int
var is_attacking = false
var is_dead = false
var attack_targets: Array = []

# Multi-touch variables
var active_touches = {}
var touch_movement = Vector2.ZERO
var touch_attack = false

@onready var animation_player = $AnimationPlayer
@onready var hp_label = get_node("../CanvasLayer/Label")
@onready var hp_color = get_node("../CanvasLayer/HPcolor")

signal player_died
signal hp_changed(new_hp: int)

func _ready():
        current_hp = max_hp
        add_to_group("player")
        setup_input_map()
        hp_changed.emit(current_hp)

func _input(event):
        if event is InputEventScreenTouch:
                handle_screen_touch(event)
        elif event is InputEventScreenDrag:
                handle_screen_drag(event)

func handle_screen_touch(event: InputEventScreenTouch):
        if event.pressed:
                active_touches[event.index] = {
                        "position": event.position,
                        "start_time": Time.get_ticks_msec(),
                        "start_position": event.position
                }
                on_touch_started(event.index, event.position)
        else:
                if event.index in active_touches:
                        var touch_data = active_touches[event.index]
                        var duration = Time.get_ticks_msec() - touch_data.start_time
                        on_touch_ended(event.index, event.position, duration)
                        active_touches.erase(event.index)

func handle_screen_drag(event: InputEventScreenDrag):
        if event.index in active_touches:
                active_touches[event.index].position = event.position
                on_touch_dragged(event.index, event.position, event.relative)

func on_touch_started(touch_index: int, position: Vector2):
        var screen_size = get_viewport().get_visible_rect().size
        if position.x > screen_size.x * 0.7:
                touch_attack = true

func on_touch_ended(touch_index: int, position: Vector2, duration: int):
        var screen_size = get_viewport().get_visible_rect().size
        
        if position.x <= screen_size.x * 0.7:
                touch_movement = Vector2.ZERO
        
        if position.x > screen_size.x * 0.7 and duration < 200:
                if not is_attacking:
                        perform_attack()
        
        touch_attack = false

func on_touch_dragged(touch_index: int, position: Vector2, relative: Vector2):
        var screen_size = get_viewport().get_visible_rect().size
        
        if position.x <= screen_size.x * 0.7:
                var touch_data = active_touches[touch_index]
                var start_pos = touch_data.start_position
                var movement_delta = position - start_pos
                var deadzone = 50.0
                
                if movement_delta.length() > deadzone:
                        touch_movement = movement_delta.normalized()
                else:
                        touch_movement = Vector2.ZERO

func setup_input_map():
        if not InputMap.has_action("move_forward"):
                InputMap.add_action("move_forward")
                var event = InputEventKey.new()
                event.keycode = KEY_W
                InputMap.action_add_event("move_forward", event)
        
        if not InputMap.has_action("move_backward"):
                InputMap.add_action("move_backward")
                var event = InputEventKey.new()
                event.keycode = KEY_S
                InputMap.action_add_event("move_backward", event)
        
        if not InputMap.has_action("move_left"):
                InputMap.add_action("move_left")
                var event = InputEventKey.new()
                event.keycode = KEY_A
                InputMap.action_add_event("move_left", event)
        
        if not InputMap.has_action("move_right"):
                InputMap.add_action("move_right")
                var event = InputEventKey.new()
                event.keycode = KEY_D
                InputMap.action_add_event("move_right", event)
        
        if not InputMap.has_action("attack"):
                InputMap.add_action("attack")
                var event = InputEventKey.new()
                event.keycode = KEY_F
                InputMap.action_add_event("attack", event)

func _process(delta):
        if is_dead:
                return
        
        handle_movement(delta)
        handle_attack()
        
        if not is_on_floor():
                velocity.y += get_gravity().y * delta
        else:
                velocity.y = 0

func handle_movement(delta):
        if is_attacking:
                velocity = Vector3.ZERO
                move_and_slide()
                return
        
        var input_vector = Vector3.ZERO
        var is_moving = false
        
        var move_forward = Input.is_action_pressed("move_forward") or Input.is_key_pressed(KEY_W)
        var move_backward = Input.is_action_pressed("move_backward") or Input.is_key_pressed(KEY_S)
        var move_left = Input.is_action_pressed("move_left") or Input.is_key_pressed(KEY_A)
        var move_right = Input.is_action_pressed("move_right") or Input.is_key_pressed(KEY_D)
        
        if touch_movement != Vector2.ZERO:
                input_vector.x -= touch_movement.x
                input_vector.z -= touch_movement.y
                is_moving = true
        
        if move_forward:
                input_vector.z += 1
                is_moving = true
        if move_backward:
                input_vector.z -= 1
                is_moving = true
        if move_left:
                input_vector.x += 1
                is_moving = true
        if move_right:
                input_vector.x -= 1
                is_moving = true
        
        if input_vector.length() > 0:
                input_vector = input_vector.normalized()
                velocity.x = input_vector.x * speed
                velocity.z = input_vector.z * speed
                
                var target_rotation = atan2(input_vector.x, input_vector.z)
                rotation.y = target_rotation
        else:
                velocity.x = 0
                velocity.z = 0
        
        if is_moving:
                if animation_player and animation_player.current_animation != "Walking":
                        animation_player.play("Walking")
        else:
                if animation_player and animation_player.current_animation == "Walking":
                        animation_player.play("Idle")
        
        move_and_slide()

func handle_attack():
        var attack_input = Input.is_action_just_pressed("attack") or Input.is_key_pressed(KEY_F) or touch_attack
        
        if attack_input:
                if not is_attacking:
                        perform_attack()

func perform_attack():
        is_attacking = true
        attack_targets.clear()
        if animation_player:
                animation_player.play("SwAttack")
                await animation_player.animation_finished
        
        is_attacking = false
        if not is_dead and animation_player:
                animation_player.play("Idle")

func take_damage(damage: int):
        if is_dead:
                return
        
        current_hp = max(0, current_hp - damage)
        update_hp_display()
        hp_changed.emit(current_hp)
        
        if current_hp <= 0:
                die()

func update_hp_display():
        if hp_label:
                hp_label.text = str(current_hp)
        
        if hp_color:
                var hp_percentage = float(current_hp) / float(max_hp)
                hp_color.scale.x = hp_percentage
                
                if hp_percentage > 0.6:
                        hp_color.modulate = Color.GREEN
                elif hp_percentage > 0.3:
                        hp_color.modulate = Color.YELLOW
                else:
                        hp_color.modulate = Color.RED

func die():
        is_dead = true
        is_attacking = false
        if animation_player:
                animation_player.play("DeathBack")
                await animation_player.animation_finished
        
        get_tree().change_scene_to_file("res://Scenes/death.tscn")`,
    variables: [
      { name: "speed", type: "float", defaultValue: "3.0", description: "Movement speed" },
      { name: "max_hp", type: "int", defaultValue: "100", description: "Maximum health points" },
      { name: "attack_damage", type: "int", defaultValue: "25", description: "Damage per attack" },
    ],
  },
  {
    id: "multiplayer-network",
    name: "Network Manager",
    category: "multiplayer",
    description: "Handles multiplayer peer connections, player registration, and network lifecycle",
    code: `extends Node

const SERVER_ADDRESS: String = "127.0.0.1"
const SERVER_PORT: int = 8080
const MAX_PLAYERS: int = 10

var players = {}
var player_info = {"nick": "player", "character": "default"}

signal player_connected(peer_id, player_info)
signal server_disconnected

func _ready():
        multiplayer.server_disconnected.connect(_on_server_disconnected)
        multiplayer.connection_failed.connect(_on_connection_failed)
        multiplayer.peer_disconnected.connect(_on_player_disconnected)
        multiplayer.peer_connected.connect(_on_player_connected)
        multiplayer.connected_to_server.connect(_on_connected_ok)

func start_host(nickname: String, character: String):
        var peer = ENetMultiplayerPeer.new()
        var error = peer.create_server(SERVER_PORT, MAX_PLAYERS)
        if error:
                return error
        
        multiplayer.multiplayer_peer = peer
        player_info["nick"] = nickname
        player_info["character"] = character
        players[1] = player_info.duplicate()
        player_connected.emit(1, player_info)

func join_game(nickname: String, character: String, address: String = SERVER_ADDRESS):
        var peer = ENetMultiplayerPeer.new()
        var error = peer.create_client(address, SERVER_PORT)
        if error:
                return error
        
        multiplayer.multiplayer_peer = peer
        player_info["nick"] = nickname
        player_info["character"] = character

func _on_connected_ok():
        var peer_id = multiplayer.get_unique_id()
        players[peer_id] = player_info.duplicate()
        player_connected.emit(peer_id, player_info)

func _on_player_connected(id):
        _register_player.rpc_id(id, player_info)

@rpc("any_peer", "reliable")
func _register_player(new_player_info):
        var new_player_id = multiplayer.get_remote_sender_id()
        players[new_player_id] = new_player_info
        player_connected.emit(new_player_id, new_player_info)

func _on_player_disconnected(id):
        players.erase(id)

func _on_connection_failed():
        multiplayer.multiplayer_peer = null

func _on_server_disconnected():
        multiplayer.multiplayer_peer = null
        players.clear()
        server_disconnected.emit()`,
    variables: [
      { name: "SERVER_ADDRESS", type: "String", defaultValue: "127.0.0.1", description: "Server address" },
      { name: "SERVER_PORT", type: "int", defaultValue: "8080", description: "Server port" },
    ],
  },
  {
    id: "battle-royale-zone",
    name: "Zone System",
    category: "battle_royale",
    description: "Shrinking safe zone system with damage progression for battle royale games",
    code: `extends Node3D

@export var zone_collision: CollisionShape3D
@export var zone_mesh: MeshInstance3D
@export var next_zone_mesh: MeshInstance3D

var is_active: bool = false
var damage_timer: float = 0.0
var damage_interval: float = 1.0

var zone_sequence: Array = [
        {"radius": 50.0, "damage": 0},
        {"radius": 35.0, "damage": 1},
        {"radius": 25.0, "damage": 2},
        {"radius": 20.0, "damage": 3},
        {"radius": 15.0, "damage": 5},
]

var current_zone_index: int = 0
var current_radius: float = 50.0
var current_center: Vector3 = Vector3.ZERO
var target_radius: float = 35.0
var target_center: Vector3 = Vector3.ZERO
var wait_time: float = 30.0
var shrink_time: float = 10.0

func _process(delta: float):
        if not is_active:
                return
        
        damage_timer += delta
        if damage_timer >= damage_interval:
                _apply_zone_damage()
                damage_timer = 0.0

func update_zone_visual(radius: float, center: Vector3):
        if not zone_collision:
                return
        
        zone_collision.global_position = center
        if zone_collision.shape is CylinderShape3D:
                var shape = zone_collision.shape as CylinderShape3D
                shape.radius = radius

func start_zone():
        is_active = true
        _update_zone()

func _apply_zone_damage():
        var damage = zone_sequence[current_zone_index]["damage"] if current_zone_index < zone_sequence.size() else 5
        if damage <= 0:
                return

func _update_zone():
        if current_zone_index < zone_sequence.size():
                current_radius = zone_sequence[current_zone_index]["radius"]
                update_zone_visual(current_radius, current_center)`,
    variables: [
      { name: "wait_time", type: "float", defaultValue: "30.0", description: "Time between zone shrinks" },
      { name: "shrink_time", type: "float", defaultValue: "10.0", description: "Duration of zone shrink" },
    ],
  },
  {
    id: "map-minimap",
    name: "Minimap UI",
    category: "map",
    description: "Overhead minimap display showing player position and map bounds",
    code: `extends Control

@onready var camera: Camera3D = $SubViewportContainer/SubViewport/Camera3D
var target_player: CharacterBody3D = null
var map_node: Node3D = null

func _ready():
        if not map_node:
                var map_nodes = get_tree().get_nodes_in_group("map")
                if map_nodes.size() > 0:
                        map_node = map_nodes[0]

func setup_minimap(player: CharacterBody3D):
        target_player = player
        if camera:
                camera.rotation_degrees = Vector3(-90, 0, 0)

func _process(delta):
        if not target_player or not is_instance_valid(target_player):
                return
        
        if camera:
                camera.global_position = Vector3(
                        target_player.global_position.x,
                        50,
                        target_player.global_position.z
                )`,
    variables: [],
  },
  {
    id: "auth-lobby",
    name: "Lobby Manager",
    category: "auth",
    description: "Game lobby managing players, game state, start conditions, and player states",
    code: `extends Node3D

@onready var players_container: Node3D = $PlayersContainer
var game_started: bool = false
var player_states = {}

func _ready():
        multiplayer.peer_disconnected.connect(_on_peer_disconnected)
        if multiplayer.is_server():
                multiplayer.connection_failed.connect(_on_player_connected)

func add_player(id: int, player_info: Dictionary):
        if players_container.has_node(str(id)):
                return
        
        var character_scene = load("res://scenes/player.tscn")
        if not character_scene:
                return
        
        var player = character_scene.instantiate()
        player.name = str(id)
        players_container.add_child(player, true)
        player.global_position = get_spawn_point()
        
        var nick = player_info.get("nick", "Player")
        player_states[id] = {"nick": nick, "alive": true}
        print("Player added: ", nick)

func get_spawn_point() -> Vector3:
        var base_pos = players_container.global_position
        var angle = randf() * TAU
        var offset = Vector3(cos(angle), 0, sin(angle)) * randf()
        return base_pos + offset

func _on_peer_disconnected(id):
        if players_container.has_node(str(id)):
                players_container.get_node(str(id)).queue_free()
        player_states.erase(id)

func _on_player_connected(peer_id, player_info):
        add_player(peer_id, player_info)`,
    variables: [],
  },
  {
    id: "vehicle-car",
    name: "Car Vehicle",
    category: "vehicle",
    description: "Full-featured multiplayer car with driver/passenger seats, physics-based movement, and networked synchronization",
    code: `extends CharacterBody3D

# Movement settings
@export var speed: float = 9.0
@export var max_rotation_speed: float = 2.0
@export var custom_gravity: float = 20.0
@export var alignment_speed: float = 8.0

# Smooth acceleration settings
@export var acceleration: float = 5.0
@export var deceleration: float = 8.0
@export var handbrake_deceleration: float = 15.0

# Turning settings
@export var turn_angle: float = 30.0
@export var turn_speed: float = 5.0

# References
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var camera: Camera3D = $Camera3D
@onready var car_visual: Node3D = $car
@onready var car1_sound: AudioStreamPlayer3D = $Car1
@onready var car2_sound: AudioStreamPlayer3D = $Car2

# Driver variables
@export var enter_area: Area3D = null
@export var seat_marker: Marker3D = null
var is_driver_occupied: bool = false
var driver_id: int = -1
var current_driver: Node3D = null

# Passenger variables
@export var passenger_enter_area: Area3D = null
@export var passenger_seat_marker: Marker3D = null
var is_passenger_occupied: bool = false
var passenger_id: int = -1
var current_passenger: Node3D = null

# Movement state
var current_speed: float = 0.0
var target_speed: float = 0.0
var current_yaw: float = 0.0
var actual_speed: float = 0.0

func _ready():
        multiplayer.peer_disconnected.connect(_on_peer_disconnected)
        floor_snap_length = 0.3
        floor_stop_on_slope = true
        floor_max_angle = deg_to_rad(46)
        set_process_input(false)
        set_physics_process(false)
        print("Car initialized - ready")

func _on_peer_disconnected(peer_id: int):
        if driver_id == peer_id:
                is_driver_occupied = false
                current_driver = null
                driver_id = -1
                set_process_input(false)
                set_physics_process(false)
                
        if passenger_id == peer_id:
                is_passenger_occupied = false
                current_passenger = null
                passenger_id = -1

func _physics_process(delta: float):
        if not is_on_floor():
                velocity.y -= custom_gravity * delta
        
        # Handle acceleration and deceleration
        if Input.is_action_pressed("ui_up"):
                current_speed = move_toward(current_speed, speed, acceleration * delta)
        elif Input.is_action_pressed("ui_down"):
                current_speed = move_toward(current_speed, -speed, acceleration * delta)
        else:
                current_speed = move_toward(current_speed, 0.0, deceleration * delta)
        
        # Handle turning
        if abs(current_speed) > 1.0:
                if Input.is_action_pressed("ui_left"):
                        current_yaw += max_rotation_speed * delta
                if Input.is_action_pressed("ui_right"):
                        current_yaw -= max_rotation_speed * delta
        
        # Apply movement
        var direction = Vector3(sin(current_yaw), 0, cos(current_yaw)).normalized()
        velocity.x = direction.x * current_speed
        velocity.z = direction.z * current_speed
        
        move_and_slide()

func start_entry_sequence(player: Node3D):
        if is_driver_occupied:
                return
        is_driver_occupied = true
        current_driver = player
        driver_id = player.get_multiplayer_authority()
        set_multiplayer_authority(driver_id)
        set_process_input(true)
        set_physics_process(true)
        print("Driver entered vehicle")

func start_exit_sequence():
        if not is_driver_occupied:
                return
        is_driver_occupied = false
        current_driver = null
        driver_id = -1
        set_process_input(false)
        set_physics_process(false)
        print("Driver exited vehicle")`,
    variables: [
      { name: "speed", type: "float", defaultValue: "9.0", description: "Maximum movement speed" },
      { name: "acceleration", type: "float", defaultValue: "5.0", description: "Acceleration rate" },
      { name: "deceleration", type: "float", defaultValue: "8.0", description: "Deceleration rate" },
      { name: "max_rotation_speed", type: "float", defaultValue: "2.0", description: "Maximum rotation speed" },
    ],
  },
  {
    id: "combat-pvp",
    name: "PVP Combat System",
    category: "combat",
    description: "Player-vs-player combat with health management, damage syncing via RPC, attack animations, and networked hit detection",
    code: `extends CharacterBody3D

const DAMAGE_MELEE = 25
const DAMAGE_RANGED = 15
const MAX_HEALTH = 100
const ATTACK_COOLDOWN = 0.8
const ATTACK_RANGE = 2.0

@export var max_health: int = MAX_HEALTH
@export var melee_damage: int = DAMAGE_MELEE
@export var ranged_damage: int = DAMAGE_RANGED
@export var attack_range: float = ATTACK_RANGE

var current_health: int = MAX_HEALTH
var can_attack: bool = true
var attacking_players: Dictionary = {}

@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var hitbox: Area3D = $Hitbox

func _ready():
        set_multiplayer_authority(multiplayer.get_unique_id())
        current_health = max_health
        hitbox.area_entered.connect(_on_hitbox_entered)
        print("PVP Combat: Ready - Authority: ", get_multiplayer_authority())

func take_damage(damage: int, attacker_id: int, damage_type: String = "melee") -> void:
        if not is_multiplayer_authority():
                rpc_id(1, "_apply_damage_rpc", damage, attacker_id, damage_type)
                return
        
        current_health -= damage
        current_health = max(0, current_health)
        
        rpc("_sync_damage", current_health, damage_type)
        
        if current_health <= 0:
                _die(attacker_id)

@rpc("authority", "call_local", "reliable")
func _sync_damage(health: int, damage_type: String) -> void:
        current_health = health
        _play_hit_animation(damage_type)
        print("Player took damage. Health: ", current_health)

@rpc("any_peer", "call_local", "reliable")
func _apply_damage_rpc(damage: int, attacker_id: int, damage_type: String) -> void:
        if is_multiplayer_authority():
                take_damage(damage, attacker_id, damage_type)

func _play_hit_animation(damage_type: String) -> void:
        if animation_player:
                match damage_type:
                        "melee":
                                animation_player.play("HitMelee")
                        "ranged":
                                animation_player.play("HitRanged")

func perform_melee_attack(target: Node3D) -> void:
        if not can_attack or not is_instance_valid(target):
                return
        
        can_attack = false
        if animation_player:
                animation_player.play("AttackMelee")
        
        rpc("_attack_hit_sync", target.name, melee_damage)
        
        await get_tree().create_timer(attack_cooldown).timeout
        can_attack = true

func perform_ranged_attack(direction: Vector3) -> void:
        if not can_attack:
                return
        
        can_attack = false
        if animation_player:
                animation_player.play("AttackRanged")
        
        rpc("_ranged_hit_sync", direction, ranged_damage)
        
        await get_tree().create_timer(attack_cooldown).timeout
        can_attack = true

@rpc("any_peer", "call_local", "reliable")
func _attack_hit_sync(target_name: String, damage: int) -> void:
        var target = get_parent().get_node_or_null(target_name)
        if target and target.has_method("take_damage"):
                target.take_damage(damage, int(name), "melee")

@rpc("any_peer", "call_local", "reliable")
func _ranged_hit_sync(direction: Vector3, damage: int) -> void:
        var raycast = RayCast3D.new()
        add_child(raycast)
        raycast.target_position = direction.normalized() * 50
        raycast.force_raycast_update()
        
        if raycast.is_colliding():
                var collider = raycast.get_collider()
                if collider and collider.has_method("take_damage"):
                        collider.take_damage(damage, int(name), "ranged")
        
        raycast.queue_free()

func _die(killer_id: int) -> void:
        print("Player died! Killed by peer: ", killer_id)
        if animation_player:
                animation_player.play("Death")
        
        rpc("_sync_death_state")

@rpc("any_peer", "call_local", "reliable")
func _sync_death_state() -> void:
        set_physics_process(false)
        if animation_player:
                animation_player.play("Death")

func _on_hitbox_entered(area: Area3D) -> void:
        if is_multiplayer_authority() and area.get_parent() != self:
                var other = area.get_parent()
                if other.is_in_group("player"):
                        attacking_players[other.name] = Time.get_ticks_msec()`,
    variables: [
      { name: "max_health", type: "int", defaultValue: "100", description: "Maximum player health" },
      { name: "melee_damage", type: "int", defaultValue: "25", description: "Melee attack damage" },
      { name: "ranged_damage", type: "int", defaultValue: "15", description: "Ranged attack damage" },
      { name: "attack_cooldown", type: "float", defaultValue: "0.8", description: "Attack cooldown in seconds" },
    ],
  },
  {
    id: "enemy-ranged",
    name: "Ranged Enemy",
    category: "enemy",
    description: "Intelligent ranged enemy AI with group-based player detection, target priority switching, RPC-synced combat, and audio cues",
    code: `extends CharacterBody3D
# Ranged AI with group detection, priority targeting, LOS checks, and networked multiplayer sync`,
    variables: [
      { name: "fire_rate", type: "float", defaultValue: "1.5", description: "Fire rate cooldown" },
      { name: "detection_radius", type: "float", defaultValue: "20.0", description: "Player detection radius" },
    ],
  },
  {
    id: "enemy-zombie",
    name: "Melee Enemy (Zombie)",
    category: "enemy",
    description: "Melee zombie AI with attack animations, damage hitbox, group-based detection, and full multiplayer synchronization",
    code: `extends CharacterBody3D
# Zombie melee combat with group detection, attack animations, and RPC sync`,
    variables: [
      { name: "detection_radius", type: "float", defaultValue: "20.0", description: "Player detection radius" },
      { name: "attack_range", type: "float", defaultValue: "0.7", description: "Melee attack range" },
    ],
  },
  {
    id: "enemy-spawner",
    name: "Enemy Spawner",
    category: "enemy",
    description: "Wave spawn system managing enemy pools, spawn intervals, radius-based positioning around player, max enemy limits",
    code: `extends Node3D

@export var zombie_scene: PackedScene
@export var spawn_interval: float = 5.0
@export var max_zombies: int = 5
@export var spawn_radius_min: float = 8.0
@export var spawn_radius_max: float = 20.0

var active_zombies: Array = []
var spawn_timer: Timer
var player: CharacterBody3D
var player_original_forward: Vector3

func _ready():
        print("Enemy Spawner initialized")
        setup_spawn_timer()
        find_player()
        
        if player:
                player_original_forward = player.global_transform.basis.z.normalized()
                player_original_forward.y = 0
                print("Player forward direction stored")
        
        if not zombie_scene:
                zombie_scene = load("res://Scenes/zombie.tscn")
                if not zombie_scene:
                        print("ERROR: Could not load zombie scene!")
                        return
        
        print("Zombie scene loaded successfully")
        
        await get_tree().create_timer(2.0).timeout
        debug_spawn()

func setup_spawn_timer():
        spawn_timer = Timer.new()
        add_child(spawn_timer)
        spawn_timer.wait_time = spawn_interval
        spawn_timer.timeout.connect(_on_spawn_timer_timeout)
        spawn_timer.start()
        print("Spawn timer setup - interval: ", spawn_interval)

func find_player():
        var players = get_tree().get_nodes_in_group("player")
        if players.size() > 0:
                player = players[0]
                print("Player found by group: ", player.name)
                return
        
        var potential_paths = ["../Player", "Player", "CharacterBody3D"]
        for path in potential_paths:
                var node = get_node_or_null(path)
                if node and node is CharacterBody3D:
                        player = node
                        print("Player found at path: ", path)
                        return
        
        print("WARNING: Player not found!")

func _on_spawn_timer_timeout():
        print("Spawn timer triggered - Active: ", active_zombies.size(), "/", max_zombies)
        
        if active_zombies.size() < max_zombies and player:
                spawn_zombie()
        
        spawn_timer.start()

func spawn_zombie():
        if not zombie_scene or not player:
                print("ERROR: Missing zombie scene or player!")
                return
        
        print("Spawning zombie...")
        
        var zombie = zombie_scene.instantiate()
        if not zombie:
                print("ERROR: Failed to instantiate zombie!")
                return
        
        get_parent().add_child(zombie)
        
        var forward_direction = player_original_forward
        var spawn_pos = player.global_position
        var distance = randf_range(spawn_radius_min, spawn_radius_max)
        
        var max_angle_variation = deg_to_rad(15.0)
        var angle_variation = randf_range(-max_angle_variation, max_angle_variation)
        
        var rotated_forward = Vector3(
                forward_direction.x * cos(angle_variation) - forward_direction.z * sin(angle_variation),
                0,
                forward_direction.x * sin(angle_variation) + forward_direction.z * cos(angle_variation)
        )
        
        spawn_pos += rotated_forward * distance
        spawn_pos.y = player.global_position.y
        
        zombie.global_position = spawn_pos
        
        if zombie.has_signal("zombie_died"):
                zombie.zombie_died.connect(_on_zombie_died.bind(zombie))
        
        active_zombies.append(zombie)
        
        print("Zombie spawned! Total active: ", active_zombies.size())

func _on_zombie_died(zombie):
        print("Zombie died, removing from active list")
        if zombie in active_zombies:
                active_zombies.erase(zombie)
        print("Active zombies remaining: ", active_zombies.size())

func debug_spawn():
        spawn_zombie()

func _input(event):
        if event is InputEventKey and event.pressed:
                if event.keycode == KEY_Z:
                        print("Manual spawn triggered by Z key")
                        debug_spawn()`,
    variables: [
      { name: "spawn_interval", type: "float", defaultValue: "5.0", description: "Time between spawns in seconds" },
      { name: "max_zombies", type: "int", defaultValue: "5", description: "Max Enemies - Maximum active enemies" },
      { name: "spawn_radius_min", type: "float", defaultValue: "8.0", description: "Minimum spawn distance from player" },
      { name: "spawn_radius_max", type: "float", defaultValue: "20.0", description: "Maximum spawn distance from player" },
    ],
  },
  {
    id: "auth-main",
    name: "Main Scene",
    category: "auth",
    description: "Main entry scene handling auto-login with saved credentials and profile fetching",
    code: `extends Node
# Main scene auto-login with credential checking and profile fetching`,
    variables: [],
  },
  {
    id: "auth-character-selection",
    name: "Character Selection",
    category: "auth",
    description: "Character selection UI with username validation, character picker, and auth flow navigation",
    code: `extends Control
# Character selection with validation and auth flow navigation`,
    variables: [],
  },
  {
    id: "auth-login-register",
    name: "Auth Scene",
    category: "auth",
    description: "Login/Register UI with email validation, Supabase integration, password reset, and profile creation",
    code: `extends Control
# Auth scene with login, register, and password reset flows`,
    variables: [],
  },
  {
    id: "auth-password-reset",
    name: "Password Reset",
    category: "auth",
    description: "Password reset UI with email verification, token extraction from URLs, and access token handling",
    code: `extends Control
# Password reset with email verification and token extraction`,
    variables: [],
  },
  {
    id: "auth-supabase-client",
    name: "Supabase Client",
    category: "auth",
    description: "Supabase HTTP client handler for auth, profiles, email verification, and user management",
    code: `extends Node
# Supabase client for auth and profile management via HTTP requests`,
    variables: [],
  },
  {
    id: "auth-lobby-scene",
    name: "Lobby Scene",
    category: "auth",
    description: "Lobby/Spawn manager displaying player info, spawning characters, handling game transitions",
    code: `extends Control
# Lobby scene with player spawning and scene transitions`,
    variables: [],
  },
  {
    id: "multiplayer-spawn-manager",
    name: "Spawn Manager",
    category: "multiplayer",
    description: "Multiplayer spawn system managing player registration, character loading, portals, and chat",
    code: `extends Node3D
# Multiplayer spawn manager with player management and chat`,
    variables: [],
  },
  {
    id: "multiplayer-chat",
    name: "Multiplayer Chat",
    category: "multiplayer",
    description: "In-game multiplayer chat with RPC message synchronization and Enter key support",
    code: `extends Control
# Multiplayer chat with RPC sync and Enter key support`,
    variables: [],
  },
  {
    id: "map-minimap-advanced",
    name: "Minimap Advanced",
    category: "map",
    description: "Advanced minimap with layer management, overhead camera, local player highlighting, and other player visibility",
    code: `extends Control
# Advanced minimap with layer management and camera control`,
    variables: [],
  },
  {
    id: "ui-game-mode",
    name: "Game Mode Selector",
    category: "ui",
    description: "Game mode selection UI with Solo, Multiplayer, and PVP buttons that set game mode and transition to scenes",
    code: `# gamemode.gd
extends Control

@onready var solo_button: Button = $Solo
@onready var mp_button: Button = $MP

func _ready():
        solo_button.pressed.connect(_on_solo_pressed)
        mp_button.pressed.connect(_on_mp_pressed)

func _on_solo_pressed():
        GameManager.set_game_mode(GameManager.GameMode.SOLO)
        get_tree().change_scene_to_file("res://level/scenes/level.tscn")

func _on_mp_pressed():
        GameManager.set_game_mode(GameManager.GameMode.MULTIPLAYER)
        get_tree().change_scene_to_file("res://level/scenes/level.tscn")
        
func _on_pv_p_pressed() -> void:
        GameManager.set_game_mode(GameManager.GameMode.MULTIPLAYER)
        get_tree().change_scene_to_file("res://level/scenes/lobby.tscn")`,
    variables: [],
  },
  {
    id: "ui-welcome-screen",
    name: "Welcome Screen",
    category: "ui",
    description: "Welcome screen with animated progress bar that auto-transitions to next scene after 3 seconds",
    code: `extends Control

@onready var progress_bar: ProgressBar = $ProgressBar

var timer: float = 0.0
var duration: float = 3.0

func _ready():
        progress_bar.value = 0

func _process(delta):
        timer += delta
        
        # Update progress bar (0 to 100 over 3 seconds)
        progress_bar.value = (timer / duration) * 100.0
        
        # When timer reaches 3 seconds, change scene
        if timer >= duration:
                get_tree().change_scene_to_file("res://level/scenes/game_mode.tscn")`,
    variables: [
      { name: "duration", type: "float", defaultValue: "3.0", description: "Time in seconds before transition" },
    ],
  },
  {
    id: "ui-death-screen",
    name: "Death Screen",
    category: "ui",
    description: "Death/Game Over UI with subviewport syncing, restart and exit buttons for game flow control",
    code: `extends Control

@onready var subviewport = $SubViewportContainer/SubViewport
@onready var restart_button = $Restart
@onready var exit_button = $Exit

func _ready():
        restart_button.pressed.connect(_on_restart_pressed)
        exit_button.pressed.connect(_on_exit_pressed)
        
        # Sync subviewport
        call_deferred("sync_subviewport")

func sync_subviewport():
        if subviewport:
                # Set subviewport to base size using Vector2i
                subviewport.size = Vector2i(1280, 720)
                subviewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

func _process(_delta):
        # Only sync if needed to avoid performance issues
        # Compare Vector2i with Vector2i
        if subviewport and subviewport.size != Vector2i(1280, 720):
                sync_subviewport()

func _on_restart_pressed():
        print("Restarting game...")
        get_tree().change_scene_to_file("res://Scenes/main.tscn")

func _on_exit_pressed():
        print("Returning to main menu...")
        get_tree().change_scene_to_file("res://Scenes/main_menu.tscn")`,
    variables: [],
  },
  {
    id: "ui-main-menu",
    name: "Main Menu",
    category: "ui",
    description: "Feature-rich main menu with about button, play button, character rotation via mouse/touch, double-tap animations, and exit",
    code: `extends Control

@onready var about_button = $Control/About
@onready var play_button = $Control/Play
@onready var exit_button = $Control/Exit
@onready var label = $Label
@onready var character_node = $BoySw

var is_label_visible = false
var is_dragging = false
var last_mouse_position = Vector2.ZERO
var rotation_sensitivity = 20.0

# Double-tap detection variables
var tap_count = 0
var last_tap_time = 0.0
var double_tap_threshold = 0.3
var tap_distance_threshold = 50.0
var first_tap_position = Vector2.ZERO

func _ready():
        about_button.pressed.connect(_on_about_pressed)
        play_button.pressed.connect(_on_play_pressed)
        exit_button.pressed.connect(_on_exit_pressed)
        
        label.visible = false
        is_label_visible = false
        
        _play_fire_animation()

func _on_about_pressed():
        is_label_visible = !is_label_visible
        label.visible = is_label_visible

func _on_play_pressed():
        var main_scene_path = "res://Scenes/main.tscn"
        if ResourceLoader.exists(main_scene_path):
                get_tree().change_scene_to_file(main_scene_path)
        else:
                print("Error: Could not find main scene at ", main_scene_path)

func _on_exit_pressed():
        get_tree().quit()

func _input(event):
        if event is InputEventScreenTouch and event.pressed:
                _handle_tap_detection(event.position)
        
        if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
                _handle_tap_detection(event.position)
        
        if event is InputEventMouseButton:
                if event.button_index == MOUSE_BUTTON_LEFT:
                        if event.pressed:
                                is_dragging = true
                                last_mouse_position = event.position
                        else:
                                is_dragging = false
        
        elif event is InputEventMouseMotion and is_dragging:
                _rotate_character_with_mouse(event)
        
        elif event is InputEventScreenTouch:
                if event.pressed:
                        is_dragging = true
                        last_mouse_position = event.position
                else:
                        is_dragging = false
        
        elif event is InputEventScreenDrag and is_dragging:
                _rotate_character_with_touch(event)
        
        elif event is InputEventKey and event.pressed:
                if event.keycode == KEY_F:
                        _play_attack_animation()

func _handle_tap_detection(tap_position: Vector2):
        var current_timestamp = Time.get_ticks_msec() / 1000.0
        
        if tap_count == 0:
                tap_count = 1
                last_tap_time = current_timestamp
                first_tap_position = tap_position
        else:
                var time_diff = current_timestamp - last_tap_time
                var distance = tap_position.distance_to(first_tap_position)
                
                if time_diff <= double_tap_threshold and distance <= tap_distance_threshold:
                        _play_attack_animation()
                        tap_count = 0
                else:
                        tap_count = 1
                        last_tap_time = current_timestamp
                        first_tap_position = tap_position

func _rotate_character_with_mouse(event: InputEventMouseMotion):
        if character_node == null:
                return
        var mouse_delta = event.position - last_mouse_position
        var rotation_amount = mouse_delta.x * rotation_sensitivity * get_process_delta_time()
        character_node.rotation.y -= deg_to_rad(rotation_amount)
        last_mouse_position = event.position

func _rotate_character_with_touch(event: InputEventScreenDrag):
        if character_node == null:
                return
        var touch_delta = event.position - last_mouse_position
        var rotation_amount = touch_delta.x * rotation_sensitivity * get_process_delta_time()
        character_node.rotation.y -= deg_to_rad(rotation_amount)
        last_mouse_position = event.position

func _play_attack_animation():
        if character_node == null:
                return
        var animation_player = character_node.get_node_or_null("AnimationPlayer")
        if animation_player == null:
                animation_player = character_node.find_child("AnimationPlayer", true, false)
        if animation_player != null and animation_player.has_animation("SwAttack"):
                animation_player.play("SwAttack")

func _play_fire_animation():
        var sketchfab_scene = $Sketchfab_Scene
        if sketchfab_scene == null:
                return
        var animation_player = sketchfab_scene.get_node_or_null("AnimationPlayer")
        if animation_player == null:
                animation_player = sketchfab_scene.find_child("AnimationPlayer", true, false)
        if animation_player != null and animation_player.has_animation("Fire"):
                animation_player.play("Fire")`,
    variables: [
      { name: "rotation_sensitivity", type: "float", defaultValue: "20.0", description: "Character rotation sensitivity" },
      { name: "double_tap_threshold", type: "float", defaultValue: "0.3", description: "Time window for double tap in seconds" },
    ],
  },
  {
    id: "ui-loading-screen",
    name: "Loading Screen",
    category: "ui",
    description: "Loading screen with animated progress bar and percentage counter that transitions after loading completes",
    code: `extends Control

@onready var loading_bar = $LoadingBar
@onready var loading_percent = $LoadingPercent

var loading_duration = 4.0
var current_time = 0.0
var is_loading = true

func _ready():
        print("Loading screen started")
        if loading_bar:
                loading_bar.value = 0
        
        if loading_percent:
                loading_percent.text = "0%"
        
        start_loading()

func start_loading():
        is_loading = true
        current_time = 0.0

func _process(delta):
        if not is_loading:
                return
        
        current_time += delta
        var progress = min(current_time / loading_duration, 1.0)
        
        if loading_bar:
                loading_bar.value = progress * 100
        
        if loading_percent:
                var percentage = int(progress * 100)
                loading_percent.text = str(percentage) + "%"
        
        if progress >= 1.0:
                loading_complete()

func loading_complete():
        is_loading = false
        print("Loading complete! Transitioning to main menu...")
        
        await get_tree().create_timer(0.5).timeout
        
        var main_menu_scene = "res://Scenes/main_menu.tscn"
        
        if ResourceLoader.exists(main_menu_scene):
                get_tree().change_scene_to_file(main_menu_scene)
        else:
                print("ERROR: Main menu scene not found at: ", main_menu_scene)`,
    variables: [
      { name: "loading_duration", type: "float", defaultValue: "4.0", description: "Loading duration in seconds" },
    ],
  },
  {
    id: "ui-victory-screen",
    name: "Victory Screen",
    category: "ui",
    description: "Victory/Win screen with animated character models, looping animations, and replay/exit buttons for match completion",
    code: `extends Control

@onready var sketchfab_animation = $Sketchfab_Scene/AnimationPlayer
@onready var boyswim_animation = $BoySw/AnimationPlayer
@onready var sketchfab_scene = $Sketchfab_Scene
@onready var boyswim_scene = $BoySw
@onready var replay_button = $Control/Replay
@onready var exit_button = $Control/Exit

var boyswim_animations = ["Taunt", "SwAttack"]
var current_animation_index = 0

func _ready():
        replay_button.pressed.connect(_on_replay_pressed)
        exit_button.pressed.connect(_on_exit_pressed)
        
        start_animations()

func start_animations():
        if sketchfab_animation and sketchfab_animation.has_animation("Fire"):
                sketchfab_animation.play("Fire", -1, 1.0, false)
                print("Playing Fire animation in loop")
        else:
                print("Fire animation not found in Sketchfab model")
        
        if boyswim_animation:
                play_next_boyswim_animation()
                boyswim_animation.animation_finished.connect(_on_boyswim_animation_finished)

func play_next_boyswim_animation():
        if boyswim_animation and current_animation_index < boyswim_animations.size():
                var anim_name = boyswim_animations[current_animation_index]
                if boyswim_animation.has_animation(anim_name):
                        boyswim_animation.play(anim_name)
                        print("Playing BoySw animation: ", anim_name)
                else:
                        print("Animation not found: ", anim_name)
                        current_animation_index += 1
                        play_next_boyswim_animation()

func _on_boyswim_animation_finished(anim_name):
        print("Animation finished: ", anim_name)
        
        current_animation_index += 1
        
        if current_animation_index >= boyswim_animations.size():
                current_animation_index = 0
                print("Looping BoySw animations")
        
        play_next_boyswim_animation()

func _on_replay_pressed():
        print("Replaying game...")
        var main_scene_path = "res://Scenes/main.tscn"
        
        if ResourceLoader.exists(main_scene_path):
                get_tree().change_scene_to_file(main_scene_path)
        else:
                print("Error: Could not find main scene at ", main_scene_path)

func _on_exit_pressed():
        print("Returning to main menu...")
        var main_menu_path = "res://Scenes/main_menu.tscn"
        
        if ResourceLoader.exists(main_menu_path):
                get_tree().change_scene_to_file(main_menu_path)
        else:
                print("Error: Could not find main menu at ", main_menu_path)`,
    variables: [],
  },
];
export const particlePresets: ParticlePreset[] = [
  {
    id: "fire-3d",
    name: "Fire (3D)",
    type: "GPUParticles3D",
    description: "3D fire particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "100", min: 20, max: 300, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "2.0", min: 0.5, max: 5.0, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.05", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "50", min: 10, max: 200, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "100", min: 30, max: 300, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "1.0", min: 0.1, max: 5, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "2.0", min: 0.5, max: 8, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "25", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "1.0", min: 0, max: 1, category: "Visual" },
    ],
  },
  {
    id: "smoke-3d",
    name: "Smoke (3D)",
    type: "GPUParticles3D",
    description: "3D smoke particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "50", min: 10, max: 200, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "3.0", min: 1.0, max: 8.0, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.1", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "20", min: 5, max: 100, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "50", min: 20, max: 200, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "2.0", min: 0.5, max: 8, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "4.0", min: 1.0, max: 15, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "0", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "40", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "60", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "0.5", min: 0, max: 1, category: "Visual" },
    ],
  },
  {
    id: "explosion-3d",
    name: "Explosion (3D)",
    type: "GPUParticles3D",
    description: "3D explosion particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "150", min: 50, max: 400, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "1.5", min: 0.5, max: 3.0, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.2", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "80", min: 20, max: 300, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "150", min: 50, max: 500, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "0.5", min: 0.1, max: 3, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "2.0", min: 0.5, max: 6, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "20", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "0.8", min: 0, max: 1, category: "Visual" },
    ],
  },
  {
    id: "blood-3d",
    name: "Blood Splatter (3D)",
    type: "GPUParticles3D",
    description: "3D blood splatter particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "60", min: 10, max: 150, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "1.5", min: 0.5, max: 4.0, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.3", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "40", min: 10, max: 150, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "100", min: 30, max: 300, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "0.3", min: 0.1, max: 1, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "1.0", min: 0.3, max: 2.5, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "0", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "80", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "1.0", min: 0, max: 1, category: "Visual" },
    ],
  },
  {
    id: "sparks-3d",
    name: "Sparks (3D)",
    type: "GPUParticles3D",
    description: "3D spark emission particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "80", min: 20, max: 200, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "1.0", min: 0.3, max: 2.5, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.15", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "60", min: 20, max: 200, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "120", min: 50, max: 400, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "0.2", min: 0.1, max: 1, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "0.8", min: 0.3, max: 2, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "40", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "1.0", min: 0, max: 1, category: "Visual" },
    ],
  },
  {
    id: "rain-3d",
    name: "Rain (3D)",
    type: "GPUParticles3D",
    description: "3D rain particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "200", min: 50, max: 500, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "2.0", min: 0.5, max: 5.0, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.05", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "30", min: 10, max: 100, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "60", min: 30, max: 200, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "0.1", min: 0.05, max: 1, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "0.3", min: 0.1, max: 2, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "200", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "30", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "80", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "0.6", min: 0, max: 1, category: "Visual" },
    ],
  },
  {
    id: "dust-3d",
    name: "Dust (3D)",
    type: "GPUParticles3D",
    description: "3D dust cloud particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "100", min: 20, max: 300, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "2.5", min: 1.0, max: 6.0, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.08", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "10", min: 2, max: 50, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "30", min: 10, max: 100, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "1.5", min: 0.5, max: 5, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "3.0", min: 1.0, max: 10, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "30", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "60", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "70", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "0.4", min: 0, max: 1, category: "Visual" },
    ],
  },
  {
    id: "magic-3d",
    name: "Magic Sparkles (3D)",
    type: "GPUParticles3D",
    description: "3D magical sparkling particle effect",
    code: `extends GPUParticles3D
func _ready() -> void:
        emitting = true
        amount = {{amount}}
        lifetime = {{lifetime}}
        var material = StandardMaterial3D.new()
        material.emission_enabled = true
        material.emission = Color.from_hsv({{hue}} / 360.0, {{saturation}} / 100.0, {{brightness}} / 100.0)
        set_surface_override_material(0, material)`,
    parameters: [
      { name: "amount", type: "int", defaultValue: "100", min: 30, max: 300, category: "Emission" },
      { name: "lifetime", type: "float", defaultValue: "2.0", min: 0.5, max: 5.0, category: "Emission" },
      { name: "damping", type: "float", defaultValue: "0.12", min: 0, max: 1, category: "Physics" },
      { name: "velocity_min", type: "float", defaultValue: "30", min: 10, max: 100, category: "Physics" },
      { name: "velocity_max", type: "float", defaultValue: "70", min: 30, max: 200, category: "Physics" },
      { name: "size_min", type: "float", defaultValue: "0.3", min: 0.1, max: 2, category: "Visual" },
      { name: "size_max", type: "float", defaultValue: "1.0", min: 0.3, max: 3, category: "Visual" },
      { name: "hue", type: "float", defaultValue: "270", min: 0, max: 360, category: "Visual" },
      { name: "saturation", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "brightness", type: "float", defaultValue: "100", min: 0, max: 100, category: "Visual" },
      { name: "alpha_fade", type: "float", defaultValue: "1.0", min: 0, max: 1, category: "Visual" },
    ],
  },
];

export function getTemplatesByCategory(category: string): Template[] {
  return templates.filter(t => t.category === category);
}

export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id);
}

export function getParticlePresetById(id: string): ParticlePreset | undefined {
  return particlePresets.find(p => p.id === id);
}
