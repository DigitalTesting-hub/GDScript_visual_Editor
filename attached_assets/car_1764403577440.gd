extends CharacterBody3D

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

# Audio settings
@export var min_pitch: float = 0.8
@export var max_pitch: float = 1.5

# References
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var camera: Camera3D = $Camera3D
@onready var car_visual: Node3D = $car
@onready var car1_sound: AudioStreamPlayer3D = $Car1
@onready var car2_sound: AudioStreamPlayer3D = $Car2

# Camera settings
var mouse_sensitivity: float = 0.002
var camera_rotation: Vector2 = Vector2.ZERO
var initial_visual_rotation: float = 0.0
var mouse_locked: bool = false

# Movement state
var current_speed: float = 0.0
var target_speed: float = 0.0
var is_handbrake: bool = false
var last_floor_normal: Vector3 = Vector3.UP
var current_yaw: float = 0.0
var last_position: Vector3 = Vector3.ZERO
var actual_speed: float = 0.0

# Turning state
var current_turn_angle: float = 0.0
var target_turn_angle: float = 0.0
var is_turning: bool = false
var is_actually_moving: bool = false

# Audio state
var is_car1_playing: bool = false
var was_moving: bool = false

# ============ DRIVER VARIABLES ============
@export var enter_area: Area3D = null
@export var seat_marker: Marker3D = null
@export var is_driver_occupied: bool = false
@export var driver_id: int = -1
var current_driver: Node3D = null
var driver_original_transform: Transform3D
var seat_local_position: Vector3 = Vector3.ZERO
var seat_local_rotation: Vector3 = Vector3.ZERO
var is_processing_entry: bool = false
var is_processing_exit: bool = false
# ============ PASSENGER VARIABLES ============
@export var passenger_enter_area: Area3D = null
@export var passenger_seat_marker: Marker3D = null
@export var is_passenger_occupied: bool = false
@export var passenger_id: int = -1
var current_passenger: Node3D = null
var passenger_original_transform: Transform3D
var passenger_local_position: Vector3 = Vector3.ZERO
var passenger_local_rotation: Vector3 = Vector3.ZERO
var is_processing_passenger_entry: bool = false

func _ready():
	_setup_input_actions()
	_setup_engine_audio()
	_setup_enter_area()
	_setup_passenger_enter_area()
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	
	initial_visual_rotation = car_visual.rotation_degrees.y
	
	if seat_marker:
		seat_local_position = to_local(seat_marker.global_position)
		seat_local_rotation = seat_marker.rotation
		print("Seat local offset calculated: ", seat_local_position)
		
	if passenger_seat_marker:
		passenger_local_position = to_local(passenger_seat_marker.global_position)
		passenger_local_rotation = passenger_seat_marker.rotation
		print("Passenger seat local offset calculated: ", passenger_local_position)
		
	floor_snap_length = 0.3
	floor_stop_on_slope = true
	floor_max_angle = deg_to_rad(46)
	wall_min_slide_angle = deg_to_rad(15)
	floor_constant_speed = true
	floor_block_on_wall = false
	max_slides = 6
	
	current_yaw = rotation.y
	last_position = global_position
	
	if camera:
		camera.current = false
	
	set_process_input(false)
	set_physics_process(false)
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	print("Car initialized - disabled")
func _on_peer_disconnected(peer_id: int):
	# Handle driver disconnection
	if driver_id == peer_id:
		print("Driver disconnected! Resetting driver state.")
		is_driver_occupied = false
		current_driver = null
		driver_id = -1
		
		# Reset car controls
		set_process_input(false)
		set_physics_process(false)
		_stop_all_audio()
		
		# Show enter area
		if enter_area:
			enter_area.visible = true
			enter_area.monitoring = true
			enter_area.monitorable = true
		if passenger_id == peer_id:
			print("Passenger disconnected! Resetting passenger state.")
			is_passenger_occupied = false
			current_passenger = null
			passenger_id = -1
		
		# Show passenger enter area
		if passenger_enter_area:
			passenger_enter_area.visible = true
			passenger_enter_area.monitoring = true
			passenger_enter_area.monitorable = true
			
func _setup_engine_audio():
	if car1_sound and car1_sound.stream and car2_sound and car2_sound.stream:
		car1_sound.finished.connect(_on_car1_finished)
		car2_sound.finished.connect(_on_car2_finished)
		if car1_sound.stream is AudioStreamWAV:
			car1_sound.stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
		if car2_sound.stream is AudioStreamWAV:
			car2_sound.stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
		car1_sound.max_distance = 5.0
		car1_sound.unit_size = 1.0
		car2_sound.max_distance = 5.0
		car2_sound.unit_size = 1.0
		print("Car audio ready")

func _on_car1_finished():
	is_car1_playing = false
	if abs(current_speed) > 0.1 or abs(target_speed) > 0.1:
		car2_sound.play()

func _on_car2_finished():
	if (abs(current_speed) > 0.1 or abs(target_speed) > 0.1) and not is_car1_playing:
		car2_sound.play()

func _setup_input_actions():
	var actions = {
		"move_forward": KEY_W,
		"move_left": KEY_A,
		"move_backward": KEY_S,
		"move_right": KEY_D,
		"door_open": KEY_F,
		"handbrake": KEY_SPACE,
		"toggle_mouse": KEY_M,
		"exit_vehicle": KEY_P,
		"map": KEY_N
	}
	for action_name in actions.keys():
		if not InputMap.has_action(action_name):
			InputMap.add_action(action_name)
			var event = InputEventKey.new()
			event.keycode = actions[action_name]
			InputMap.action_add_event(action_name, event)

func _input(event: InputEvent):
	if event is InputEventMouseMotion and mouse_locked:
		camera_rotation.x -= event.relative.y * mouse_sensitivity
		camera_rotation.y -= event.relative.x * mouse_sensitivity
		camera_rotation.x = clamp(camera_rotation.x, -PI/2, PI/2)
				
	if event is InputEventKey and event.keycode == KEY_M and event.pressed:
		mouse_locked = !mouse_locked
		if mouse_locked:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
		else:
			Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	
	if event.is_action_pressed("exit_vehicle") and not is_processing_exit:
		if is_driver_occupied:
			start_exit_sequence()

func _physics_process(delta: float):
	if is_processing_entry or is_processing_exit:
		return
	
	if not is_on_floor():
		velocity.y -= custom_gravity * delta
	else:
		if velocity.y < 0:
			velocity.y = 0
	
	var current_position = global_position
	actual_speed = (current_position - last_position).length() / delta
	last_position = current_position
	
	is_actually_moving = actual_speed > 1.0
	is_handbrake = Input.is_action_pressed("handbrake")

	if is_handbrake:
		target_speed = 0.0
		current_speed = move_toward(current_speed, 0.0, handbrake_deceleration * delta)
	else:
		var forward_pressed = Input.is_action_pressed("move_backward")
		var backward_pressed = Input.is_action_pressed("move_forward")
		if forward_pressed:
			target_speed = speed
		elif backward_pressed:
			target_speed = -speed
		else:
			target_speed = 0.0
		if abs(target_speed) > 0.01:
			current_speed = move_toward(current_speed, target_speed, acceleration * delta)
		else:
			current_speed = move_toward(current_speed, 0.0, deceleration * delta)

	if is_actually_moving and abs(current_speed) > 1.0:
		var turn_input = 0.0
		if Input.is_action_pressed("move_left"):
			turn_input += 1.0
		if Input.is_action_pressed("move_right"):
			turn_input -= 1.0
		if Input.is_action_pressed("move_backward"):
			turn_input = -turn_input
		if abs(turn_input) > 0.01:
			var speed_factor = abs(current_speed) / speed
			var effective_rotation_speed = max_rotation_speed * speed_factor
			current_yaw += turn_input * effective_rotation_speed * delta

	_update_turn_animation()

	if Input.is_action_just_pressed("door_open"):
		play_car_animation_synced("DoorOpen", 1.0, 1.0)

	_apply_movement()
	move_and_slide()
	_align_with_floor(delta)
	_update_camera()
	_update_engine_audio()
	_update_driver_position()

func _update_driver_position():
	if is_driver_occupied and current_driver and seat_marker:
		var car_basis = global_transform.basis
		var visual_rotation_basis = Basis(Vector3.UP, deg_to_rad(car_visual.rotation_degrees.y))
		var combined_basis = visual_rotation_basis * car_basis
		var seat_world_position = global_transform.origin + combined_basis * seat_local_position
		var seat_local_basis = Basis.from_euler(seat_local_rotation)
		var final_basis = combined_basis * seat_local_basis
		var seat_world_rotation = final_basis.get_euler()
		
		current_driver.global_position = seat_world_position
		current_driver.global_rotation = seat_world_rotation
		
		if current_driver._body:
			current_driver._body.rotation = Vector3.ZERO

func _update_engine_audio():
	if not car1_sound or not car1_sound.stream or not car2_sound or not car2_sound.stream:
		return
	var is_moving = abs(current_speed) > 0.1 or abs(target_speed) > 0.1
	var speed_ratio = abs(current_speed) / speed
	var target_pitch = lerp(min_pitch, max_pitch, speed_ratio)
	car1_sound.pitch_scale = target_pitch
	car2_sound.pitch_scale = 1.0
	if is_moving:
		if not was_moving and not car1_sound.playing and not car2_sound.playing:
			is_car1_playing = true
			car1_sound.play()
		elif not is_car1_playing and not car2_sound.playing:
			car2_sound.play()
	else:
		_stop_all_audio()
	was_moving = is_moving

func _stop_all_audio():
	if car1_sound and car1_sound.playing:
		car1_sound.stop()
	if car2_sound and car2_sound.playing:
		car2_sound.stop()
	is_car1_playing = false
	was_moving = false

func _update_turn_animation():
	var left_pressed = Input.is_action_pressed("move_left")
	var right_pressed = Input.is_action_pressed("move_right")
	var forward_pressed = Input.is_action_pressed("move_backward")
	var backward_pressed = Input.is_action_pressed("move_forward")
	var should_turn = (forward_pressed or backward_pressed) and (left_pressed or right_pressed) and is_actually_moving

	if forward_pressed:
		target_turn_angle = 0.0
		is_turning = false
	elif should_turn:
		if right_pressed:
			target_turn_angle = -turn_angle
			is_turning = true
		elif left_pressed:
			target_turn_angle = turn_angle
			is_turning = true
	else:
		target_turn_angle = 0.0
		is_turning = false

	current_turn_angle = lerp(current_turn_angle, target_turn_angle, turn_speed * get_physics_process_delta_time())
	car_visual.rotation_degrees.y = initial_visual_rotation + current_turn_angle

	if animation_player:
		if should_turn:
			if right_pressed:
				play_car_animation_synced("Right", 4.0, 1.0)
			elif left_pressed:
				play_car_animation_synced("Left", 4.0, 1.0)
		elif abs(current_speed) > 0.1:
			if not is_turning:
				play_car_animation_synced("Drive", 4.0, -sign(current_speed))
		elif not (forward_pressed or backward_pressed) and animation_player.current_animation != "DoorOpen":
			play_car_animation_synced("Idle", 1.0, 1.0)

func _apply_movement():
	var direction = Vector3(sin(current_yaw), 0, cos(current_yaw)).normalized()
	var horizontal_velocity = direction * current_speed
	velocity.x = horizontal_velocity.x
	velocity.z = horizontal_velocity.z

func _align_with_floor(delta: float):
	if not is_on_floor():
		last_floor_normal = last_floor_normal.lerp(Vector3.UP, 5.0 * delta)
	else:
		var space_state = get_world_3d().direct_space_state
		var query = PhysicsRayQueryParameters3D.create(
			global_position + Vector3(0, 0.5, 0),
			global_position + Vector3.DOWN * 2.0
		)
		query.exclude = [self]
		var result = space_state.intersect_ray(query)
		if result:
			last_floor_normal = last_floor_normal.lerp(result.normal, 15.0 * delta)

	var target_basis = Basis()
	target_basis.y = last_floor_normal
	var forward_flat = Vector3(sin(current_yaw), 0, cos(current_yaw))
	var forward_on_slope = forward_flat - last_floor_normal * forward_flat.dot(last_floor_normal)
	forward_on_slope = forward_on_slope.normalized()
	target_basis.z = forward_on_slope
	target_basis.x = target_basis.y.cross(target_basis.z).normalized()
	target_basis.z = target_basis.x.cross(target_basis.y).normalized()
	target_basis = target_basis.orthonormalized()
	transform.basis = transform.basis.slerp(target_basis, alignment_speed * delta)

func _update_camera():
	if camera:
		camera.transform.basis = Basis()
		camera.rotation.x = camera_rotation.x
		camera.rotation.y = camera_rotation.y

func _setup_enter_area():
	if enter_area:
		enter_area.body_entered.connect(_on_enter_area_body_entered)
		enter_area.body_exited.connect(_on_enter_area_body_exited)
		print("Enter area setup complete")
		
func _on_enter_area_body_entered(body: Node3D):
	if is_driver_occupied or is_processing_entry or is_processing_exit:
		return
	if body.is_in_group("player"):
		body.nearby_car = self
		print("Car: Player ", body.name, " entered DRIVER area")

func _on_enter_area_body_exited(body: Node3D):
	if body.is_in_group("player"):
		if body.nearby_car == self:
			body.nearby_car = null
		print("Car: Player ", body.name, " left DRIVER area")

# ============ DRIVER ENTRY SEQUENCE ============

func start_entry_sequence(player: Node3D):
	if is_driver_occupied or is_processing_entry or is_processing_exit:
		print("Car is already occupied or processing!")
		return
	
	is_processing_entry = true
	print("=== DRIVER ENTRY SEQUENCE STARTED ===")
	
	_entry_step1_save_transform(player)
	await get_tree().create_timer(0.1).timeout
	
	_entry_step2_teleport_to_seat(player)
	await get_tree().create_timer(0.1).timeout
	
	_entry_step3_play_animation(player)
	await get_tree().create_timer(0.2).timeout
	
	_entry_step4_hide_enter_area()
	
	_entry_step5_enable_car(player)
	
	is_processing_entry = false
	print("=== DRIVER ENTRY SEQUENCE COMPLETE ===")

func _entry_step1_save_transform(player: Node3D):
	driver_original_transform = player.global_transform
	print("Entry Step 1: Saved player original transform")
	sync_entry_step1.rpc(player.get_multiplayer_authority(), driver_original_transform)

@rpc("any_peer", "call_local", "reliable")
func sync_entry_step1(player_id: int, original_transform: Transform3D):
	driver_original_transform = original_transform

func _entry_step2_teleport_to_seat(player: Node3D):
	if not seat_marker:
		print("ERROR: No seat marker!")
		return
	var seat_world_position = global_transform.origin + global_transform.basis * seat_local_position
	var seat_world_rotation = global_rotation + seat_local_rotation
	player.global_position = seat_world_position
	player.global_rotation = seat_world_rotation
	print("Entry Step 2: Player teleported to seat")
	sync_entry_step2.rpc(player.get_multiplayer_authority(), seat_world_position, seat_world_rotation)

@rpc("any_peer", "call_local", "reliable")
func sync_entry_step2(player_id: int, world_pos: Vector3, world_rot: Vector3):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == player_id:
			player.global_position = world_pos
			player.global_rotation = world_rot
			break

func _entry_step3_play_animation(player: Node3D):
	if player._body:
		player._body.is_in_car = true
	if player._body and player._body.animation_player:
		if player._body.animation_player.has_animation("CarTP"):
			player._body.animation_player.play("CarTP")
	print("Entry Step 3: Playing CarTP animation")
	sync_entry_step3.rpc(player.get_multiplayer_authority())

@rpc("any_peer", "call_local", "reliable")
func sync_entry_step3(player_id: int):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == player_id:
			if player._body:
				player._body.is_in_car = true
			if player._body and player._body.animation_player:
				if player._body.animation_player.has_animation("CarTP"):
					player._body.animation_player.play("CarTP")
			break

func _entry_step4_hide_enter_area():
	if enter_area:
		enter_area.visible = false
		enter_area.monitoring = false
		enter_area.monitorable = false
	is_driver_occupied = true
	print("Entry Step 4: Enter area hidden")
	sync_entry_step4.rpc()

@rpc("any_peer", "call_local", "reliable")
func sync_entry_step4():
	if enter_area:
		enter_area.visible = false
		enter_area.monitoring = false
		enter_area.monitorable = false
	is_driver_occupied = true

func _entry_step5_enable_car(player: Node3D):
	current_driver = player
	is_driver_occupied = true
	driver_id = player.get_multiplayer_authority()
	set_multiplayer_authority(driver_id)
	set_process_input(true)
	set_physics_process(true)
	mouse_locked = true
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	if camera:
		camera.current = true
	print("Entry Step 5: Car enabled - Authority: ", driver_id)
	sync_entry_step5.rpc(driver_id)

@rpc("any_peer", "call_local", "reliable")
func sync_entry_step5(new_driver_id: int):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == new_driver_id:
			current_driver = player
			break
	is_driver_occupied = true
	driver_id = new_driver_id
	set_multiplayer_authority(new_driver_id)

# ============ DRIVER EXIT SEQUENCE ============

func start_exit_sequence():
	if not is_driver_occupied or not current_driver or is_processing_exit or is_processing_entry:
		return
	
	is_processing_exit = true
	print("=== DRIVER EXIT SEQUENCE STARTED ===")
	
	var exiting_driver = current_driver
	var exiting_driver_id = driver_id
	
	_exit_step1_stop_vehicle()
	await get_tree().create_timer(0.1).timeout
	
	_exit_step2_camera_and_teleport(exiting_driver)
	await get_tree().create_timer(0.1).timeout
	
	_exit_step3_clear_vehicle_state(exiting_driver)
	await get_tree().create_timer(0.1).timeout
	
	_exit_step4_reset_animation(exiting_driver)
	await get_tree().create_timer(0.1).timeout
	
	_exit_step5_enable_player(exiting_driver, exiting_driver_id)
	await get_tree().create_timer(0.1).timeout
	
	_exit_step6_show_enter_area_and_cleanup()
	
	is_processing_exit = false
	print("=== DRIVER EXIT SEQUENCE COMPLETE ===")

func _exit_step1_stop_vehicle():
	set_process_input(false)
	set_physics_process(false)
	
	if animation_player:
		animation_player.stop()
	
	_stop_all_audio()
	
	if car_visual:
		car_visual.rotation_degrees.y = initial_visual_rotation
	current_speed = 0.0
	target_speed = 0.0
	velocity = Vector3.ZERO
	current_turn_angle = 0.0
	target_turn_angle = 0.0
	
	mouse_locked = false
	camera_rotation = Vector2.ZERO
	
	print("Exit Step 1: Vehicle stopped")
	sync_exit_step1.rpc()

@rpc("any_peer", "call_local", "reliable")
func sync_exit_step1():
	set_process_input(false)
	set_physics_process(false)
	if animation_player:
		animation_player.stop()
	_stop_all_audio()
	if car_visual:
		car_visual.rotation_degrees.y = initial_visual_rotation
	current_speed = 0.0
	target_speed = 0.0
	velocity = Vector3.ZERO
	current_turn_angle = 0.0
	target_turn_angle = 0.0
	mouse_locked = false
	camera_rotation = Vector2.ZERO

func _exit_step2_camera_and_teleport(player: Node3D):
	if not player or not enter_area:
		return
	player.global_position = enter_area.global_position
	
	var original_rotation = driver_original_transform.basis.get_euler()
	player.global_rotation = original_rotation
	
	if player._body:
		player._body.rotation = Vector3.ZERO
	
	print("Exit Step 2: Camera switched, player teleported and rotation restored")
	sync_exit_step2.rpc(player.get_multiplayer_authority(), enter_area.global_position, original_rotation)

@rpc("any_peer", "call_local", "reliable")
func sync_exit_step2(player_id: int, exit_pos: Vector3, original_rot: Vector3):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == player_id:
			player.global_position = exit_pos
			player.global_rotation = original_rot
			if player._body:
				player._body.rotation = Vector3.ZERO
			break

func _exit_step3_clear_vehicle_state(player: Node3D):
	if player:
		player.is_in_vehicle = false
		player.is_driver = false
		player.nearby_car = null
	
	is_driver_occupied = false
	
	print("Exit Step 3: Vehicle state cleared")
	sync_exit_step3.rpc(player.get_multiplayer_authority() if player else -1)

@rpc("any_peer", "call_local", "reliable")
func sync_exit_step3(player_id: int):
	is_driver_occupied = false
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == player_id:
			player.is_in_vehicle = false
			player.is_driver = false
			player.nearby_car = null
			break

func _exit_step4_reset_animation(player: Node3D):
	if not player:
		return
	
	if player._body:
		player._body.is_in_car = false
		player._body.is_melee_attacking = false
		player._body.is_dancing = false
		
		if player._body.animation_player:
			player._body.animation_player.stop()
			if player._body.animation_player.has_animation("RifleIdle"):
				player._body.animation_player.play("RifleIdle")
	
	print("Exit Step 4: Animation reset")
	sync_exit_step4.rpc(player.get_multiplayer_authority())

@rpc("any_peer", "call_local", "reliable")
func sync_exit_step4(player_id: int):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == player_id:
			if player._body:
				player._body.is_in_car = false
				player._body.is_melee_attacking = false
				player._body.is_dancing = false
				if player._body.animation_player:
					player._body.animation_player.stop()
					if player._body.animation_player.has_animation("RifleIdle"):
						player._body.animation_player.play("RifleIdle")
			break

func _exit_step5_enable_player(player: Node3D, player_id: int):
	if not player:
		return
	
	if player.has_method("_enable_after_vehicle_exit"):
		player._enable_after_vehicle_exit()
	
	if player.is_multiplayer_authority():
		if player.camera:
			player.camera.current = true
		player.mouse_locked = true
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	
	print("Exit Step 5: Player controls enabled")

func _exit_step6_show_enter_area_and_cleanup():
	if enter_area:
		enter_area.visible = true
		enter_area.monitoring = true
		enter_area.monitorable = true
	
	current_driver = null
	driver_id = -1
	
	set_multiplayer_authority(1)
	
	print("Exit Step 6: Enter area shown, driver cleared")
	sync_exit_step6.rpc()

@rpc("any_peer", "call_local", "reliable")
func sync_exit_step6():
	if enter_area:
		enter_area.visible = true
		enter_area.monitoring = true
		enter_area.monitorable = true
	current_driver = null
	driver_id = -1
	is_driver_occupied = false
	set_multiplayer_authority(1)

func _process(_delta):
	if is_processing_entry or is_processing_exit:
		return
	
	_update_passenger_position()

func _update_passenger_position():
	if is_passenger_occupied and current_passenger and passenger_seat_marker:
		var car_basis = global_transform.basis
		var visual_rotation_basis = Basis(Vector3.UP, deg_to_rad(car_visual.rotation_degrees.y))
		var combined_basis = visual_rotation_basis * car_basis
		var seat_world_position = global_transform.origin + combined_basis * passenger_local_position
		var seat_local_basis = Basis.from_euler(passenger_local_rotation)
		var final_basis = combined_basis * seat_local_basis
		var seat_world_rotation = final_basis.get_euler()
		
		current_passenger.global_position = seat_world_position
		current_passenger.global_rotation = seat_world_rotation
		
		if current_passenger._body:
			current_passenger._body.rotation = Vector3.ZERO

# ============ ANIMATION SYNC ============

func play_car_animation_synced(anim_name: String, speed: float = 1.0, direction: float = 1.0):
	_play_animation_local(anim_name, speed, direction)
	sync_car_animation.rpc(anim_name, speed, direction)

func _play_animation_local(anim_name: String, speed: float, direction: float):
	if animation_player and animation_player.has_animation(anim_name):
		animation_player.play(anim_name, -1, speed * direction)

@rpc("any_peer", "call_remote", "reliable")
func sync_car_animation(anim_name: String, speed: float, direction: float):
	_play_animation_local(anim_name, speed, direction)

func stop_car_animation_synced():
	if animation_player:
		animation_player.stop()
	sync_stop_car_animation.rpc()

@rpc("any_peer", "call_remote", "reliable")
func sync_stop_car_animation():
	if animation_player:
		animation_player.stop()

# ============ PASSENGER SETUP ============

func _setup_passenger_enter_area():
	if passenger_enter_area:
		passenger_enter_area.body_entered.connect(_on_passenger_enter_area_body_entered)
		passenger_enter_area.body_exited.connect(_on_passenger_enter_area_body_exited)
		print("Passenger enter area setup complete")

func _on_passenger_enter_area_body_entered(body: Node3D):
	if is_passenger_occupied or is_processing_passenger_entry:
		return
	if body.is_in_group("player"):
		body.nearby_passenger_car = self
		print("Car: Player ", body.name, " entered PASSENGER area")

func _on_passenger_enter_area_body_exited(body: Node3D):
	if body.is_in_group("player"):
		if body.nearby_passenger_car == self:
			body.nearby_passenger_car = null
		print("Car: Player ", body.name, " left PASSENGER area")

# ============ PASSENGER ENTRY SEQUENCE ============

func start_passenger_entry_sequence(player: Node3D):
	if is_passenger_occupied or is_processing_passenger_entry:
		print("Car passenger seat is already occupied or processing!")
		return
	
	is_processing_passenger_entry = true
	print("=== PASSENGER ENTRY SEQUENCE STARTED ===")
	
	_passenger_entry_step1_save_transform(player)
	await get_tree().create_timer(0.1).timeout
	
	_passenger_entry_step2_teleport_to_seat(player)
	await get_tree().create_timer(0.1).timeout
	
	_passenger_entry_step3_play_animation(player)
	await get_tree().create_timer(0.2).timeout
	
	_passenger_entry_step4_hide_enter_area()
	
	_passenger_entry_step5_set_passenger(player)
	
	is_processing_passenger_entry = false
	print("=== PASSENGER ENTRY SEQUENCE COMPLETE ===")

func _passenger_entry_step1_save_transform(player: Node3D):
	passenger_original_transform = player.global_transform
	print("Passenger Entry Step 1: Saved passenger original transform")
	sync_passenger_entry_step1.rpc(player.get_multiplayer_authority(), passenger_original_transform)

@rpc("any_peer", "call_local", "reliable")
func sync_passenger_entry_step1(player_id: int, original_transform: Transform3D):
	passenger_original_transform = original_transform

func _passenger_entry_step2_teleport_to_seat(player: Node3D):
	if not passenger_seat_marker:
		print("ERROR: No passenger seat marker!")
		return
	var seat_world_position = global_transform.origin + global_transform.basis * passenger_local_position
	var seat_world_rotation = global_rotation + passenger_local_rotation
	player.global_position = seat_world_position
	player.global_rotation = seat_world_rotation
	print("Passenger Entry Step 2: Passenger teleported to seat")
	sync_passenger_entry_step2.rpc(player.get_multiplayer_authority(), seat_world_position, seat_world_rotation)

@rpc("any_peer", "call_local", "reliable")
func sync_passenger_entry_step2(player_id: int, world_pos: Vector3, world_rot: Vector3):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == player_id:
			player.global_position = world_pos
			player.global_rotation = world_rot
			break

func _passenger_entry_step3_play_animation(player: Node3D):
	if player._body:
		player._body.is_in_car = true
	if player._body and player._body.animation_player:
		if player._body.animation_player.has_animation("CarTP"):
			player._body.animation_player.play("CarTP")
	print("Passenger Entry Step 3: Playing CarTP animation")
	sync_passenger_entry_step3.rpc(player.get_multiplayer_authority())

@rpc("any_peer", "call_local", "reliable")
func sync_passenger_entry_step3(player_id: int):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == player_id:
			if player._body:
				player._body.is_in_car = true
			if player._body and player._body.animation_player:
				if player._body.animation_player.has_animation("CarTP"):
					player._body.animation_player.play("CarTP")
			break

func _passenger_entry_step4_hide_enter_area():
	if passenger_enter_area:
		passenger_enter_area.visible = false
		passenger_enter_area.monitoring = false
		passenger_enter_area.monitorable = false
	is_passenger_occupied = true
	print("Passenger Entry Step 4: Passenger enter area hidden")
	sync_passenger_entry_step4.rpc()

@rpc("any_peer", "call_local", "reliable")
func sync_passenger_entry_step4():
	if passenger_enter_area:
		passenger_enter_area.visible = false
		passenger_enter_area.monitoring = false
		passenger_enter_area.monitorable = false
	is_passenger_occupied = true

func _passenger_entry_step5_set_passenger(player: Node3D):
	current_passenger = player
	is_passenger_occupied = true
	passenger_id = player.get_multiplayer_authority()
	
	# Passenger keeps their camera and can look around
	# But disable movement and combat
	player.is_in_vehicle = true
	player.is_passenger = true
	player.set_physics_process(false)
	player.can_shoot = false
	player.can_melee = false
	player.can_switch_weapon = false
	
	if player.gun_node:
		player.gun_node.visible = false
	if player.melee_node:
		player.melee_node.visible = false
	
	# Keep their camera active and mouse control for looking around
	if player.is_multiplayer_authority():
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
		player.mouse_locked = true
	
	print("Passenger Entry Step 5: Passenger seated - Passenger ID: ", passenger_id)
	sync_passenger_entry_step5.rpc(passenger_id)

@rpc("any_peer", "call_local", "reliable")
func sync_passenger_entry_step5(new_passenger_id: int):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.get_multiplayer_authority() == new_passenger_id:
			current_passenger = player
			player.is_in_vehicle = true
			player.is_passenger = true
			break
	is_passenger_occupied = true
	passenger_id = new_passenger_id

# ============ PASSENGER EXIT (CALLED FROM CHAMP.GD) ============

func clear_passenger_seat():
	"""Called by passenger when they exit via champ.gd"""
	print("=== CLEARING PASSENGER SEAT ===")
	
	# Show passenger enter area
	if passenger_enter_area:
		passenger_enter_area.visible = true
		passenger_enter_area.monitoring = true
		passenger_enter_area.monitorable = true
	
	# Clear passenger references
	current_passenger = null
	passenger_id = -1
	is_passenger_occupied = false
	
	print("Passenger seat cleared and area shown")
	sync_clear_passenger_seat.rpc()

@rpc("any_peer", "call_local", "reliable")
func sync_clear_passenger_seat():
	if passenger_enter_area:
		passenger_enter_area.visible = true
		passenger_enter_area.monitoring = true
		passenger_enter_area.monitorable = true
	current_passenger = null
	passenger_id = -1
	is_passenger_occupied = false
