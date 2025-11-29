extends CharacterBody3D

const ENEMY_DAMAGE = 10
const MAX_HEALTH = 100
const ROTATION_SPEED = 5.0
const PRIORITY_DISTANCE = 5.0  # If player within 5m, prioritize them

@onready var raycast: RayCast3D = $ShootPosition/RayCast3D
@onready var player_detector: Area3D = $PlayerDetector
@onready var health_label: Label3D = $HealthLabel3D
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var line_of_sight: Area3D = $ShootPosition/LineOfSightArea

# Audio nodes
@onready var walk_sound: AudioStreamPlayer3D = $WalkSound
@onready var fire_sound: AudioStreamPlayer3D = $FireSound
@onready var hit_sound: AudioStreamPlayer3D = $HitSound

# Multiplayer sync variables - MUST match MultiplayerSynchronizer properties
@export var sync_health: int = MAX_HEALTH
@export var sync_position: Vector3 = Vector3.ZERO
@export var sync_rotation_y: float = 0.0
@export var sync_is_shooting: bool = false
@export var sync_target_id: int = 0
@export var sync_is_dead: bool = false 
@export var sync_current_animation: String = "RifleIdle"
@export var sync_players_in_range: Array[int] = []  # NEW: Sync all tracked players

# Audio sync counters - MUST be @export for MultiplayerSynchronizer
@export var footstep_counter: int = 0
@export var fire_counter: int = 0
@export var hit_counter: int = 0
@export var footstep_type: String = "walk"

@export_category("Combat Settings")
@export var fire_rate: float = 1.5
@export var detection_radius: float = 20.0

# Client-side tracking variables (NOT synced)
var last_hit_counter: int = 0
var last_fire_counter: int = 0
var last_footstep_counter: int = 0
var last_sync_position: Vector3 = Vector3.ZERO
var velocity_stopped_frames: int = 0
var required_stopped_frames: int = 2

# Host-side variables (NOT synced)
var footstep_timer: float = 0.0
var walk_footstep_interval: float = 0.6
var current_health: int = MAX_HEALTH
var can_shoot: bool = true
var player_in_range: bool = false
var target_player: CharacterBody3D = null
var is_shooting: bool = false
var players_in_range: Array = []
var player_distances: Dictionary = {}  # Track distances: {player: distance}
var group_scan_timer: float = 0.0
var group_scan_interval: float = 0.3  # Scan every 0.3 seconds for responsiveness
var target_switch_timer: float = 0.0
var target_switch_check_interval: float = 0.2  # Check for better targets frequently
var is_dead: bool = false

func _ready():
	set_multiplayer_authority(1)
	current_health = sync_health
	_setup_collision()
	_setup_raycast()
	_setup_detector()
	_setup_line_of_sight()
	_setup_health_label()
	_setup_audio_nodes()
	
	print("Ranged Enemy ready - Authority: ", get_multiplayer_authority(), " | Peer: ", multiplayer.get_unique_id())

func _setup_collision():
	collision_layer = 0
	set_collision_layer_value(4, true)
	collision_mask = 0
	set_collision_mask_value(1, true)
	set_collision_mask_value(2, true)
	set_collision_mask_value(3, true)
	
func _setup_raycast():
	if not raycast:
		return
		
	raycast.enabled = true
	raycast.target_position = Vector3(0, 0, -50)
	raycast.collision_mask = 0
	raycast.set_collision_mask_value(4, true)
	raycast.set_collision_mask_value(1, true)
	raycast.set_collision_mask_value(2, true)
	
func _setup_line_of_sight():
	if not line_of_sight:
		return
	
	line_of_sight.collision_layer = 0
	line_of_sight.collision_mask = 0
	line_of_sight.set_collision_mask_value(4, true)

func _setup_detector():
	if not player_detector:
		return
		
	var collision_shape = player_detector.get_child(0)
	if collision_shape is CollisionShape3D:
		var sphere_shape = collision_shape.shape as SphereShape3D
		if sphere_shape:
			sphere_shape.radius = detection_radius
	
	player_detector.collision_layer = 0
	player_detector.collision_mask = 0
	player_detector.set_collision_mask_value(4, true)
	
	# Only host handles detection signals
	if is_multiplayer_authority():
		player_detector.area_entered.connect(_on_detection_area_entered)
		player_detector.area_exited.connect(_on_detection_area_exited)

func _setup_health_label():
	if not health_label:
		health_label = Label3D.new()
		health_label.name = "HealthLabel3D"
		add_child(health_label)
		health_label.position = Vector3(0, 2, 0)
		health_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_update_health_ui()

func _setup_audio_nodes():
	if walk_sound:
		walk_sound.bus = "SFX"
		walk_sound.max_distance = 8.0
		walk_sound.unit_size = 3.0
		walk_sound.attenuation_filter_cutoff_hz = 5000
		walk_sound.attenuation_filter_db = 24.0
		
	if fire_sound:
		fire_sound.bus = "SFX"
		fire_sound.max_distance = 20.0
		fire_sound.unit_size = 4.0
		fire_sound.attenuation_filter_cutoff_hz = 5000
		fire_sound.attenuation_filter_db = 24.0
		
	if hit_sound:
		hit_sound.bus = "SFX"
		hit_sound.max_distance = 12.0
		hit_sound.unit_size = 3.0
		hit_sound.attenuation_filter_cutoff_hz = 5000
		hit_sound.attenuation_filter_db = 24.0

func _physics_process(delta):
	# Check death sync - ALL PEERS check this
	if sync_is_dead:
		if not is_multiplayer_authority() and not is_dead:
			_die()
			return
		elif is_multiplayer_authority() and not is_dead:
			_die()
		return
	
	if is_dead:
		return
	
	# CLIENT: Apply synced data from server
	if not is_multiplayer_authority():
		global_position = sync_position
		rotation.y = sync_rotation_y
		current_health = sync_health
		is_shooting = sync_is_shooting
		_apply_synced_animation()
		_update_health_ui()
		return
	
	# === HOST ONLY BELOW ===
	
	# Apply gravity
	if not is_on_floor():
		velocity.y -= 20.0 * delta
	else:
		velocity.y = 0
	move_and_slide()
	
	# CONTINUOUS group-based scan (every 0.3s)
	group_scan_timer += delta
	if group_scan_timer >= group_scan_interval:
		_scan_for_players_by_group()
		_update_player_distances()
		group_scan_timer = 0.0
	
	# Check for target switching based on priority (every 0.2s)
	target_switch_timer += delta
	if target_switch_timer >= target_switch_check_interval:
		_check_for_priority_target_switch()
		target_switch_timer = 0.0
	
	# Validate current target
	_validate_current_target()
	
	# Acquire target if we don't have one
	if players_in_range.size() > 0 and (target_player == null or not is_instance_valid(target_player) or not _is_target_valid(target_player)):
		_acquire_best_target()
	
	# AI behavior
	if target_player and is_instance_valid(target_player) and _is_target_valid(target_player):
		_rotate_to_face_player(delta)
		
		var can_see_player = _check_can_see_player()
		
		if can_see_player:
			if not is_shooting:
				_start_shooting_animation()
			
			if can_shoot:
				_fire_at_player()
		else:
			if is_shooting:
				_stop_shooting_animation()
	else:
		_stop_shooting_animation()
	
	# Update footstep audio
	_update_footstep_audio(delta)
	
	# HOST: Update ALL sync variables (including player list)
	sync_position = global_position
	sync_rotation_y = rotation.y
	sync_health = current_health
	sync_is_shooting = is_shooting
	sync_is_dead = (current_health <= 0)
	
	# Sync the list of players in range
	sync_players_in_range.clear()
	for player in players_in_range:
		if is_instance_valid(player):
			sync_players_in_range.append(int(player.name))
	
	if animation_player and animation_player.current_animation != "":
		sync_current_animation = animation_player.current_animation
	
	if target_player and is_instance_valid(target_player):
		sync_target_id = int(target_player.name)
	else:
		sync_target_id = 0

func _process(_delta):
	# ALL PEERS check death state
	if sync_is_dead:
		if not is_multiplayer_authority() and not is_dead:
			_die()
		return
		
	# CLIENT: Check for audio updates
	if not is_multiplayer_authority():
		_check_remote_audio()
		_check_remote_audio_stop()
		_update_health_ui()

# ROBUST: Update distances for all tracked players
func _update_player_distances():
	player_distances.clear()
	
	for player in players_in_range:
		if is_instance_valid(player):
			var distance = global_position.distance_to(player.global_position)
			player_distances[player] = distance

# ROBUST: Check if we should switch to a priority target
func _check_for_priority_target_switch():
	if players_in_range.size() <= 1:
		return  # Only one or no players, no need to switch
	
	# Check if current target has line of sight
	var current_target_visible = false
	if target_player and is_instance_valid(target_player) and _is_target_valid(target_player):
		current_target_visible = _check_can_see_player()
	
	# Find closest player and check for firable targets
	var closest_player: CharacterBody3D = null
	var closest_distance: float = INF
	var closest_firable_player: CharacterBody3D = null
	var closest_firable_distance: float = INF
	
	for player in players_in_range:
		if is_instance_valid(player) and _is_target_valid(player):
			var distance = player_distances.get(player, global_position.distance_to(player.global_position))
			
			if distance < closest_distance:
				closest_distance = distance
				closest_player = player
			
			# Check if this player has line of sight
			var temp_target = target_player
			target_player = player  # Temporarily set to check LOS
			var has_los = _check_can_see_player()
			target_player = temp_target  # Restore original target
			
			if has_los and distance < closest_firable_distance:
				closest_firable_distance = distance
				closest_firable_player = player
	
	# CRITICAL: If current target is NOT visible but another player IS visible, switch immediately
	if not current_target_visible and closest_firable_player:
		if target_player != closest_firable_player:
			print("🎯 IMMEDIATE SWITCH: Current target not visible, switching to firable player ", closest_firable_player.name)
			target_player = closest_firable_player
			player_in_range = true
			if is_shooting:
				_stop_shooting_animation()
			return
	
	# Priority switch: If any player is within 5m, ALWAYS target them
	if closest_player and closest_distance < PRIORITY_DISTANCE:
		if target_player != closest_player:
			print("⚠️ PRIORITY SWITCH: Player ", closest_player.name, " is within ", closest_distance, "m - switching target!")
			target_player = closest_player
			player_in_range = true
			# Interrupt current shooting to retarget
			if is_shooting:
				_stop_shooting_animation()
			return
	
	# If current target is dead or invalid, switch immediately
	if target_player == null or not is_instance_valid(target_player) or not _is_target_valid(target_player):
		if closest_player:
			print("🎯 Target lost, switching to: ", closest_player.name)
			target_player = closest_player
			player_in_range = true

# GROUP-BASED DETECTION SYSTEM (runs continuously)
func _scan_for_players_by_group():
	var all_players = get_tree().get_nodes_in_group("player")
	var players_found_this_scan: Array = []
	
	for player in all_players:
		if is_instance_valid(player) and player is CharacterBody3D:
			var distance = global_position.distance_to(player.global_position)
			
			# If player is within detection radius
			if distance <= detection_radius and _is_target_valid(player):
				players_found_this_scan.append(player)
				
				if not players_in_range.has(player):
					players_in_range.append(player)
					print("✅ GROUP DETECTION: Player ", player.name, " entered range (distance: ", distance, ")")
					
					# Notify via RPC that player was detected
					rpc("_sync_player_detected", int(player.name), distance)
	
	# Remove players that are no longer in range
	for player in players_in_range.duplicate():
		if not players_found_this_scan.has(player):
			var distance = global_position.distance_to(player.global_position) if is_instance_valid(player) else INF
			
			if distance > detection_radius or not _is_target_valid(player):
				players_in_range.erase(player)
				print("❌ GROUP DETECTION: Player ", player.name if is_instance_valid(player) else "invalid", " left range")
				
				# If this was our target, clear it
				if player == target_player:
					target_player = null
					player_in_range = false
					print("🎯 Current target lost, will acquire new target")

# RPC to notify all clients about player detection (for consistency)
@rpc("authority", "call_local", "reliable")
func _sync_player_detected(player_id: int, distance: float):
	if not is_multiplayer_authority():
		print("CLIENT: Received detection sync - Player ", player_id, " at distance ", distance)

# AREA-BASED DETECTION SYSTEM (instant response)
func _on_detection_area_entered(area: Area3D):
	if not is_multiplayer_authority():
		return
	
	var player = area.get_parent()
	
	if player and player.is_in_group("player") and _is_target_valid(player):
		if not players_in_range.has(player):
			players_in_range.append(player)
			var distance = global_position.distance_to(player.global_position)
			print("✅ AREA DETECTION: Player ", player.name, " entered range (distance: ", distance, ")")
			
			# If no current target or this player is closer, acquire immediately
			if target_player == null or distance < PRIORITY_DISTANCE:
				target_player = player
				player_in_range = true
				print("🎯 IMMEDIATE TARGET: ", player.name)

func _on_detection_area_exited(area: Area3D):
	if not is_multiplayer_authority():
		return
	
	var player = area.get_parent()
	
	if player and player.is_in_group("player") and players_in_range.has(player):
		players_in_range.erase(player)
		print("❌ AREA DETECTION: Player ", player.name, " left range")
		
		if player == target_player:
			target_player = null
			player_in_range = false
			_acquire_best_target()

func _validate_current_target():
	if target_player and is_instance_valid(target_player):
		if not _is_target_valid(target_player):
			print("⚠️ Current target invalid: ", target_player.name)
			target_player = null
	else:
		target_player = null

func _is_target_valid(player: CharacterBody3D) -> bool:
	if not player or not is_instance_valid(player):
		return false
	
	# Check if player is dead
	if player.has_method("get") and player.get("sync_is_dead"):
		if player.sync_is_dead:
			return false
	
	# Check if player is in range
	var distance = global_position.distance_to(player.global_position)
	if distance > detection_radius:
		return false
	
	# Check if player is a spectator
	if player.has_method("get") and player.get("is_spectator"):
		if player.is_spectator:
			return false
	
	return true

# ROBUST: Acquire the BEST target (closest or priority)
func _acquire_best_target():
	var closest_player: CharacterBody3D = null
	var closest_distance: float = INF
	var priority_player: CharacterBody3D = null  # Player within 5m
	
	for player in players_in_range:
		if is_instance_valid(player) and _is_target_valid(player):
			var distance = player_distances.get(player, global_position.distance_to(player.global_position))
			
			# Check for priority target (within 5m)
			if distance < PRIORITY_DISTANCE:
				if priority_player == null or distance < global_position.distance_to(priority_player.global_position):
					priority_player = player
			
			# Track closest regardless
			if distance < closest_distance:
				closest_distance = distance
				closest_player = player
	
	# Prioritize close players
	if priority_player:
		target_player = priority_player
		player_in_range = true
		print("🎯 PRIORITY TARGET: ", priority_player.name, " (within 5m)")
	elif closest_player:
		target_player = closest_player
		player_in_range = true
		print("🎯 TARGET ACQUIRED: ", closest_player.name, " at distance: ", closest_distance)
	else:
		target_player = null
		player_in_range = false
		print("⚠️ No valid targets available")

func _check_remote_audio():
	if footstep_counter != last_footstep_counter:
		_play_footstep_sound_client(footstep_type)
		last_footstep_counter = footstep_counter
	
	if fire_counter != last_fire_counter:
		_play_fire_sound_client()
		last_fire_counter = fire_counter
	
	if hit_counter != last_hit_counter:
		_play_hit_sound_client()
		last_hit_counter = hit_counter

func _check_remote_audio_stop():
	if is_multiplayer_authority():
		return
	
	var is_stopped_now = sync_position.distance_to(last_sync_position) < 0.1
	
	if is_stopped_now:
		velocity_stopped_frames += 1
	else:
		velocity_stopped_frames = 0
		last_sync_position = sync_position
	
	if velocity_stopped_frames >= required_stopped_frames:
		_stop_footstep_sounds()
		velocity_stopped_frames = required_stopped_frames

func _stop_footstep_sounds():
	if walk_sound and walk_sound.playing:
		walk_sound.stop()

func _apply_synced_animation():
	if not animation_player:
		return
	
	if sync_current_animation != "" and animation_player.current_animation != sync_current_animation:
		if animation_player.has_animation(sync_current_animation):
			animation_player.play(sync_current_animation)
		else:
			push_warning("Animation not found: ", sync_current_animation)

func _rotate_to_face_player(delta: float):
	if not target_player or not is_instance_valid(target_player):
		return
	
	var direction_to_player = target_player.global_position - global_position
	direction_to_player.y = 0
	direction_to_player = direction_to_player.normalized()
	
	if direction_to_player.length() > 0.01:
		var target_rotation = atan2(direction_to_player.x, direction_to_player.z)
		rotation.y = lerp_angle(rotation.y, target_rotation, ROTATION_SPEED * delta)

func _check_can_see_player() -> bool:
	if not target_player or not is_instance_valid(target_player):
		return false
	
	var space_state = get_world_3d().direct_space_state
	var origin = global_position + Vector3(0, 1.5, 0)
	var target_pos = target_player.global_position + Vector3(0, 1.0, 0)
	
	var query = PhysicsRayQueryParameters3D.create(origin, target_pos)
	query.collision_mask = 1 | 2 | 4
	query.exclude = [self]
	
	var result = space_state.intersect_ray(query)
	
	if result:
		var collider = result.collider
		if collider == target_player or (collider and collider.is_in_group("player")):
			return true
		else:
			return false
	
	return false

func take_damage(damage: int):
	if sync_is_dead:
		return
	
	if is_multiplayer_authority():
		_apply_damage_on_host(damage)
	else:
		rpc_id(1, "_apply_damage_on_host", damage)

@rpc("any_peer", "call_local", "reliable")
func _apply_damage_on_host(damage: int):
	if not is_multiplayer_authority():
		return
	
	if sync_is_dead:
		return
	
	current_health -= damage
	current_health = max(0, current_health)
	sync_health = current_health
	hit_counter += 1
	
	_play_hit_sound_host()
	_update_health_ui()
	
	print("HOST: Enemy health now: ", current_health)
	
	if current_health <= 0:
		print("HOST: Enemy died!")
		sync_is_dead = true
		# Death cleanup happens in _physics_process -> _die()

func _start_shooting_animation():
	if animation_player and animation_player.has_animation("Firing"):
		is_shooting = true
		sync_is_shooting = true
		animation_player.play("Firing")
		animation_player.speed_scale = 1.0
		sync_current_animation = "Firing"

func _stop_shooting_animation():
	if is_shooting:
		is_shooting = false
		sync_is_shooting = false
		if animation_player and animation_player.has_animation("RifleIdle"):
			animation_player.play("RifleIdle")
			sync_current_animation = "RifleIdle"

func _update_health_ui():
	if health_label:
		health_label.text = str(current_health)
		var health_percent = float(current_health) / float(MAX_HEALTH)
		if health_percent > 0.6:
			health_label.modulate = Color(0, 1, 0)
		elif health_percent > 0.3:
			health_label.modulate = Color(1, 1, 0)
		else:
			health_label.modulate = Color(1, 0, 0)

func _play_footstep_sound_host(step_type: String):
	if walk_sound and walk_sound.stream:
		if walk_sound.playing:
			walk_sound.stop()
		walk_sound.play()

func _play_fire_sound_host():
	if fire_sound and fire_sound.stream:
		fire_sound.play()

func _play_hit_sound_host():
	if hit_sound and hit_sound.stream:
		hit_sound.play()

func _play_footstep_sound_client(step_type: String):
	if walk_sound and walk_sound.stream:
		if walk_sound.playing:
			walk_sound.stop()
		walk_sound.play()

func _play_fire_sound_client():
	if fire_sound and fire_sound.stream:
		fire_sound.play()

func _play_hit_sound_client():
	if hit_sound and hit_sound.stream:
		hit_sound.play()

func _update_footstep_audio(delta):
	if sync_is_dead:
		_stop_footstep_sounds()
		footstep_timer = 0.0
		return
	
	var is_moving = velocity.length() > 0.1 and is_on_floor()
	
	if is_moving:
		footstep_timer += delta
		
		if footstep_timer >= walk_footstep_interval:
			footstep_type = "walk"
			footstep_counter += 1
			_play_footstep_sound_host(footstep_type)
			footstep_timer = 0.0
	else:
		_stop_footstep_sounds()
		footstep_timer = 0.0

func _fire_at_player():
	if not target_player or not is_instance_valid(target_player):
		return
	
	can_shoot = false
	fire_counter += 1
	_play_fire_sound_host()
	
	print("🔫 HOST: Firing at player: ", target_player.name)
	
	if _check_can_see_player():
		if target_player.has_method("take_damage"):
			target_player.take_damage(ENEMY_DAMAGE)
			print("💥 HOST: Dealt ", ENEMY_DAMAGE, " damage to player: ", target_player.name)
			
	await get_tree().create_timer(fire_rate).timeout
	can_shoot = true

func _die():
	if is_dead:
		return
	
	is_dead = true
	print("Ranged Enemy _die() called! (Authority: ", is_multiplayer_authority(), ")")
	
	# Disable all interactions
	if player_detector:
		player_detector.monitoring = false
	
	collision_layer = 0
	collision_mask = 0
	
	# Play death animation if available
	if animation_player and animation_player.has_animation("Death"):
		animation_player.play("Death")
		sync_current_animation = "Death"
		await get_tree().create_timer(1.0).timeout
	
	# Cleanup on both host and clients
	queue_free()
