extends CharacterBody3D

@export var speed = 3.0
@export var max_hp = 100
@export var attack_damage = 25

var current_hp: int
var is_attacking = false
var is_dead = false
var attack_targets: Array = []

# Multi-touch variables
var active_touches = {}
var max_touches = 10
var touch_movement = Vector2.ZERO
var touch_attack = false

@onready var animation_player = $AnimationPlayer
@onready var collision_shape = $CollisionShape3D
@onready var sword_area = $BoySw/Armature/Skeleton3D/Sword/SwordAr
@onready var hp_label = get_node("../CanvasLayer/Label")
@onready var hp_color = get_node("../CanvasLayer/HPcolor")

# Mobile control buttons
@onready var mobile_controls = get_node("../Buttons")
@onready var forward_button = get_node("../Buttons/Forward")
@onready var right_button = get_node("../Buttons/Right")
@onready var left_button = get_node("../Buttons/Left")
@onready var back_button = get_node("../Buttons/Back")
@onready var attack_button = get_node("../Buttons/Attack")

var mobile_input = {
	"Forward": false,
	"Right": false,
	"Left": false,
	"Back": false,
	"attack": false
}

signal player_died
signal hp_changed(new_hp: int)

func _ready():
	current_hp = max_hp
	add_to_group("player")
	setup_input_map()
	setup_mobile_controls()
	connect_sword_area()
	connect_exit_area()
	hp_changed.emit(current_hp)

func _input(event):
	# Handle multi-touch events
	if event is InputEventScreenTouch:
		handle_screen_touch(event)
	elif event is InputEventScreenDrag:
		handle_screen_drag(event)

func handle_screen_touch(event: InputEventScreenTouch):
	if event.pressed:
		# Touch started
		active_touches[event.index] = {
			"position": event.position,
			"start_time": Time.get_ticks_msec(),
			"is_dragging": false,
			"start_position": event.position
		}
		print("Touch started - Index: ", event.index, " Position: ", event.position)
		
		on_touch_started(event.index, event.position)
		
	else:
		# Touch ended
		if event.index in active_touches:
			var touch_data = active_touches[event.index]
			var duration = Time.get_ticks_msec() - touch_data.start_time
			
			print("Touch ended - Index: ", event.index, " Duration: ", duration, "ms")
			
			on_touch_ended(event.index, event.position, duration)
			
			active_touches.erase(event.index)

func handle_screen_drag(event: InputEventScreenDrag):
	if event.index in active_touches:
		active_touches[event.index].position = event.position
		active_touches[event.index].is_dragging = true
		
		print("Touch drag - Index: ", event.index, " Position: ", event.position)
		
		on_touch_dragged(event.index, event.position, event.relative)

func on_touch_started(touch_index: int, position: Vector2):
	# Get screen size for position calculations
	var screen_size = get_viewport().get_visible_rect().size
	var screen_center = screen_size * 0.5
	
	# Check if touch is on right side of screen (attack area)
	if position.x > screen_size.x * 0.7:
		touch_attack = true
		print("Attack touch started")
	else:
		# Left side is for movement
		print("Movement touch started at: ", position)

func on_touch_ended(touch_index: int, position: Vector2, duration: int):
	var screen_size = get_viewport().get_visible_rect().size
	
	# Reset movement when touch ends on left side
	if position.x <= screen_size.x * 0.7:
		touch_movement = Vector2.ZERO
		print("Movement touch ended")
	
	# Handle attack tap (short duration touch on right side)
	if position.x > screen_size.x * 0.7 and duration < 200:
		if not is_attacking:
			perform_attack()
		print("Attack tap detected")
	
	touch_attack = false

func on_touch_dragged(touch_index: int, position: Vector2, relative: Vector2):
	var screen_size = get_viewport().get_visible_rect().size
	
	# Only handle movement on left side of screen
	if position.x <= screen_size.x * 0.7:
		var touch_data = active_touches[touch_index]
		var start_pos = touch_data.start_position
		
		# Calculate movement direction from start position
		var movement_delta = position - start_pos
		var deadzone = 50.0  # Minimum distance before registering movement
		
		if movement_delta.length() > deadzone:
			# Normalize and scale movement
			touch_movement = movement_delta.normalized()
			print("Touch movement: ", touch_movement)
		else:
			touch_movement = Vector2.ZERO

func get_active_touch_count() -> int:
	return active_touches.size()

func is_touch_active(touch_index: int) -> bool:
	return touch_index in active_touches
	
func setup_mobile_controls():
	# Detect if we're on mobile platform
	var is_mobile = OS.has_feature("mobile") or OS.has_feature("web")
	
	if mobile_controls:
		mobile_controls.visible = is_mobile
		print("Mobile controls visibility set to: ", is_mobile)
		
		if is_mobile:
			connect_mobile_buttons()
	else:
		print("Mobile controls (Buttons) not found")

func connect_mobile_buttons():
	if forward_button:
		forward_button.button_down.connect(_on_forward_pressed)
		forward_button.button_up.connect(_on_forward_released)
	
	if right_button:
		right_button.button_down.connect(_on_right_pressed)
		right_button.button_up.connect(_on_right_released)
	
	if left_button:
		left_button.button_down.connect(_on_left_pressed)
		left_button.button_up.connect(_on_left_released)
	
	if back_button:
		back_button.button_down.connect(_on_back_pressed)
		back_button.button_up.connect(_on_back_released)
	
	if attack_button:
		attack_button.pressed.connect(_on_attack_pressed)
	
	print("Mobile button signals connected")

func _on_forward_pressed():
	mobile_input["Forward"] = true

func _on_forward_released():
	mobile_input["Forward"] = false

func _on_right_pressed():
	mobile_input["Right"] = true

func _on_right_released():
	mobile_input["Right"] = false

func _on_left_pressed():
	mobile_input["Left"] = true

func _on_left_released():
	mobile_input["Left"] = false

func _on_back_pressed():
	mobile_input["Back"] = true

func _on_back_released():
	mobile_input["Back"] = false

func _on_attack_pressed():
	mobile_input["attack"] = true
	await get_tree().create_timer(0.1).timeout
	mobile_input["attack"] = false

func connect_exit_area():
	var exit_area = get_node("../Area3D")
	if exit_area:
		exit_area.body_entered.connect(_on_body_entered)
		print("Exit area connected successfully")
	else:
		print("Could not find exit area")

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

func connect_sword_area():
	if sword_area:
		sword_area.body_entered.connect(_on_sword_hit)

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
	
	# Regular keyboard/button input
	var move_forward = Input.is_action_pressed("move_forward") or Input.is_key_pressed(KEY_W) or mobile_input["Forward"]
	var move_backward = Input.is_action_pressed("move_backward") or Input.is_key_pressed(KEY_S) or mobile_input["Back"]
	var move_left = Input.is_action_pressed("move_left") or Input.is_key_pressed(KEY_A) or mobile_input["Left"]
	var move_right = Input.is_action_pressed("move_right") or Input.is_key_pressed(KEY_D) or mobile_input["Right"]
	
	# Add touch input to movement
	if touch_movement != Vector2.ZERO:
		# Convert 2D touch movement to 3D world movement
		# touch_movement.x controls left/right, touch_movement.y controls forward/back
		input_vector.x -= touch_movement.x  # Negative because screen coordinates are flipped
		input_vector.z -= touch_movement.y  # Negative because screen Y is inverted
		is_moving = true
	
	# Regular input handling
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
		
	if input_vector != Vector3.ZERO:
		var target_rotation = 0.0
	
		if input_vector.z < 0:
			target_rotation = 180.0
		elif input_vector.z > 0:
			target_rotation = 0.0
		elif input_vector.x > 0:
			target_rotation = 90.0
		elif input_vector.x < 0:
			target_rotation = -90.0
	
		if input_vector.x > 0 and input_vector.z < 0:
			target_rotation = 135.0
		elif input_vector.x < 0 and input_vector.z < 0:
			target_rotation = -135.0
		elif input_vector.x > 0 and input_vector.z > 0:
			target_rotation = 45.0
		elif input_vector.x < 0 and input_vector.z > 0:
			target_rotation = -45.0
			
		rotation_degrees.y = target_rotation
	else:
		velocity.x = 0
		velocity.z = 0
	
	if is_moving:
		if animation_player.current_animation != "Walking":
			animation_player.play("Walking")
	else:
		if animation_player.current_animation == "Walking":
			animation_player.play("Idle")
	
	move_and_slide()

func handle_attack():
	var attack_input = Input.is_action_just_pressed("attack") or Input.is_key_pressed(KEY_F) or mobile_input["attack"] or touch_attack
	
	if attack_input:
		if not is_attacking:
			perform_attack()

func perform_attack():
	is_attacking = true
	attack_targets.clear()
	animation_player.play("SwAttack")
	
	await animation_player.animation_finished
	
	is_attacking = false
	if not is_dead:
		animation_player.play("Idle")

func _on_sword_hit(body):
	if not is_attacking or is_dead:
		return
	
	if body.is_in_group("zombies") and body not in attack_targets:
		attack_targets.append(body)
		body.take_damage(attack_damage)
		print("Player hit zombie for ", attack_damage, " damage")

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
	animation_player.play("DeathBack")
	
	await animation_player.animation_finished
	
	get_tree().change_scene_to_file("res://Scenes/death.tscn")

func _on_body_entered(body):
	print("Area entered by: ", body.name)
	print("Body groups: ", body.get_groups())
	
	if body == self:
		await get_tree().create_timer(1.0).timeout
		print("Exit area triggered!")
		get_tree().change_scene_to_file("res://Scenes/victory_scene.tscn")
