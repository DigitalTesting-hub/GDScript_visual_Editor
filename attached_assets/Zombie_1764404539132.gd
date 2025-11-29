# Zombie Script - Melee Combat System
extends CharacterBody3D

const ZOMBIE_DAMAGE = 15
const MAX_HEALTH = 100
const ROTATION_SPEED = 5.0
const MOVE_SPEED = 1.0

# Add near the top with other constants
const PRIORITY_DISTANCE = 5.0  # If player within 5m, prioritize them

# Add with other @export variables
@export var sync_players_in_range: Array[int] = []  # Sync all tracked players

# Add with other host-side variables
var players_in_range: Array = []
var player_distances: Dictionary = {}  # Track distances: {player: distance}
var group_scan_timer: float = 0.0
var group_scan_interval: float = 0.3  # Scan every 0.3 seconds
var target_switch_timer: float = 0.0
var target_switch_check_interval: float = 0.2  # Check for better targets frequently
# Multiplayer sync variables
@export var sync_health: int = MAX_HEALTH
@export var sync_position: Vector3 = Vector3.ZERO
@export var sync_rotation_y: float = 0.0
@export var sync_velocity: Vector3 = Vector3.ZERO
@export var sync_is_attacking: bool = false
@export var sync_current_animation: String = "zombieidle"
@export var sync_target_id: int = 0
@export var sync_is_dead: bool = false 

@onready var health_label: Label3D = $HealthLabel3D
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var player_detector: Area3D = $PlayerDetector
@onready var damage_hitbox: Area3D = $Zombie/Armature/Skeleton3D/Hitbox/Attack

@export_category("Combat Settings")
@export var detection_radius: float = 20.0
@export var attack_range: float = 0.7
@export var attack_cooldown: float = 1.0

var current_health: int = MAX_HEALTH
var target_player: CharacterBody3D = null
var player_in_range: bool = false
var is_attacking: bool = false
var can_attack: bool = true
var can_deal_damage: bool = false
var is_dead: bool = false

func _ready():
	add_to_group("zombie")
	set_multiplayer_authority(1)
	_setup_collision()
	_setup_detector()
	_setup_damage_hitbox()
	_setup_health_label()
	_setup_animations()
	print("Zombie ready on layer 6")
	
func _setup_collision():
	# Zombie body collision
	collision_layer = 0
	set_collision_layer_value(4, true)  # Zombies on layer 6
	collision_mask = 0
	set_collision_mask_value(1, true)   # Detect world
	set_collision_mask_value(2, true)   # Detect obstacles
	set_collision_mask_value(3, true)   # Detect player
	print("Zombie collision: Layer 6, Mask 1,2,3")

func _setup_detector():
	if not player_detector:
		player_detector = Area3D.new()
		player_detector.name = "PlayerDetector"
		add_child(player_detector)
		
		var collision_shape = CollisionShape3D.new()
		var sphere = SphereShape3D.new()
		sphere.radius = detection_radius
		collision_shape.shape = sphere
		player_detector.add_child(collision_shape)
		print("Created PlayerDetector for zombie")
	else:
		# Update existing detector radius
		var collision_shape = player_detector.get_child(0)
		if collision_shape is CollisionShape3D:
			var sphere_shape = collision_shape.shape as SphereShape3D
			if sphere_shape:
				sphere_shape.radius = detection_radius
	
	# Detector detects player's DetectionArea (layer 5)
	player_detector.collision_layer = 0
	player_detector.collision_mask = 0
	player_detector.set_collision_mask_value(5, true)
	player_detector.area_entered.connect(_on_detection_area_entered)
	player_detector.area_exited.connect(_on_detection_area_exited)
	print("Zombie PlayerDetector configured: Mask 5")

func _setup_damage_hitbox():
	if not damage_hitbox:
		damage_hitbox = Area3D.new()
		damage_hitbox.name = "DamageHitbox"
		add_child(damage_hitbox)
		
		var collision_shape = CollisionShape3D.new()
		var sphere = SphereShape3D.new()
		sphere.radius = 1.2  # Attack reach
		collision_shape.shape = sphere
		collision_shape.position = Vector3(0, 1, -0.8)  # In front of zombie
		damage_hitbox.add_child(collision_shape)
			
	damage_hitbox.collision_layer = 0
	damage_hitbox.set_collision_layer_value(7, true)  # Zombie attack layer
	damage_hitbox.collision_mask = 0
	damage_hitbox.set_collision_mask_value(3, true)  # Players (CharacterBody3D)
	damage_hitbox.monitoring = false  # Start disabled
	
	# Connect to body_entered instead of area_entered
	damage_hitbox.body_entered.connect(_on_damage_hitbox_body_entered)

func _setup_health_label():
	if not health_label:
		health_label = Label3D.new()
		health_label.name = "HealthLabel3D"
		add_child(health_label)
		health_label.position = Vector3(0, 2.5, 0)
		health_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		health_label.font_size = 32
		print("Created HealthLabel3D for zombie")
	_update_health_ui()

func _setup_animations():
	if animation_player:
		if animation_player.has_animation("zombieidle"):
			animation_player.play("zombieidle")
		print("Zombie animations ready")

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
		velocity = sync_velocity
		current_health = sync_health
		is_attacking = sync_is_attacking
		_apply_synced_animation()
		_update_health_ui()
		return
	
	# === HOST ONLY BELOW ===
	
	# Apply gravity
	if not is_on_floor():
		velocity.y -= 20.0 * delta
	else:
		velocity.y = 0
	
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
		
		var distance_to_player = global_position.distance_to(target_player.global_position)
		
		if distance_to_player <= attack_range:
			velocity = Vector3.ZERO
			if can_attack and not is_attacking:
				_start_attack()
		else:
			if not is_attacking:
				_move_towards_player()
				_play_animation("zombiewalk")
	else:
		# No target behavior
		velocity = Vector3.ZERO
		if not is_attacking:
			_play_animation("zombieidle")
	
	move_and_slide()
	
	# HOST: Update ALL sync variables (including player list)
	sync_position = global_position
	sync_rotation_y = rotation.y
	sync_velocity = velocity
	sync_health = current_health
	sync_is_attacking = is_attacking
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

func _apply_synced_animation():
	if not animation_player:
		return
	
	if sync_current_animation != "" and animation_player.current_animation != sync_current_animation:
		if animation_player.has_animation(sync_current_animation):
			animation_player.play(sync_current_animation)
			# Apply 2x speed specifically for zombiewalk animation
			if sync_current_animation == "zombiewalk":
				animation_player.speed_scale = 2.0
			else:
				animation_player.speed_scale = 1.0
			print("CLIENT: Zombie playing synced animation: ", sync_current_animation)
		else:
			push_warning("Zombie animation not found: ", sync_current_animation)

func _rotate_to_face_player(delta: float):
	if not target_player:
		return
	
	var direction_to_player = target_player.global_position - global_position
	direction_to_player.y = 0
	direction_to_player = direction_to_player.normalized()
	
	if direction_to_player.length() > 0.01:
		var target_rotation = atan2(direction_to_player.x, direction_to_player.z)
		rotation.y = lerp_angle(rotation.y, target_rotation, ROTATION_SPEED * delta)

func _move_towards_player():
	if not target_player:
		return
	
	var direction = (target_player.global_position - global_position).normalized()
	direction.y = 0
	velocity.x = direction.x * MOVE_SPEED
	velocity.z = direction.z * MOVE_SPEED

func _start_attack():
	if is_attacking or not can_attack or is_dead:
		return
	
	is_attacking = true
	sync_is_attacking = true  # Sync attack state
	can_attack = false
	can_deal_damage = false
	
	# Choose random attack animation
	var attack_animations = ["Attack1", "Attack2", "Attack3"]
	var chosen_attack = attack_animations[randi() % attack_animations.size()]
	_play_animation(chosen_attack)
	
	print("Zombie attacking with: ", chosen_attack)
	
	# Delay before damage can occur (animation windup)
	await get_tree().create_timer(0.4).timeout
	
	if is_dead:
		return
	
	# Enable damage hitbox
	if damage_hitbox and is_attacking:
		damage_hitbox.monitoring = true
		can_deal_damage = true
		print("Zombie damage hitbox enabled")
	
	# Keep hitbox active for attack duration
	await get_tree().create_timer(1.5).timeout
	
	if is_dead:
		return
	
	# Disable damage hitbox
	if damage_hitbox:
		damage_hitbox.monitoring = false
		can_deal_damage = false
		print("Zombie damage hitbox disabled")
	
	await get_tree().create_timer(0.3).timeout
	
	if is_dead:
		return
	
	is_attacking = false
	
	# Cooldown before next attack
	await get_tree().create_timer(attack_cooldown).timeout
	
	if is_dead:
		return
		
	can_attack = true

func _play_animation(anim_name: String):
	if animation_player and animation_player.has_animation(anim_name):
		if animation_player.current_animation != anim_name:
			animation_player.play(anim_name)
			# Apply 2x speed specifically for zombiewalk animation
			if anim_name == "zombiewalk":
				animation_player.speed_scale = 2.0
			else:
				animation_player.speed_scale = 1.0
			sync_current_animation = anim_name

func _on_damage_hitbox_body_entered(body: Node):
	if is_dead or not can_deal_damage or not is_attacking:
		return
	
	print("Zombie damage hitbox hit body: ", body.name, " in groups: ", body.get_groups())
	
	# Check if we hit a player CharacterBody3D directly
	if body and body.is_in_group("player") and body.has_method("take_damage"):
		body.take_damage(ZOMBIE_DAMAGE, 0, "melee")
		can_deal_damage = false  # Prevent multiple hits in same attack
		print("✓ Zombie dealt ", ZOMBIE_DAMAGE, " damage to player ", body.name, "!")

func _on_detection_area_entered(area: Area3D):
	if is_dead:
		return
		
	if area.name == "DetectionArea":
		var player = area.get_parent()
		if player and player.is_in_group("player") and _is_target_valid(player):
			# Calculate distance first
			var distance = global_position.distance_to(player.global_position)
			
			if not players_in_range.has(player):
				players_in_range.append(player)
				print("✅ ZOMBIE AREA DETECTION: Player ", player.name, " entered range (distance: ", distance, ")")
			
			# If no current target or this player is closer, acquire immediately
			if target_player == null or distance < PRIORITY_DISTANCE:
				target_player = player
				player_in_range = true
				print("🎯 ZOMBIE IMMEDIATE TARGET: ", player.name)

func _on_detection_area_exited(area: Area3D):
	if area.name == "DetectionArea":
		var player = area.get_parent()
		if player and player.is_in_group("player") and players_in_range.has(player):
			players_in_range.erase(player)
			print("❌ ZOMBIE AREA DETECTION: Player ", player.name, " left range")
			
			if player == target_player:
				target_player = null
				player_in_range = false
				_acquire_best_target()

func take_damage(damage: int):
	if sync_is_dead or is_dead:
		return
	
	# IMPORTANT: Only host can modify synced variables
	if not is_multiplayer_authority():
		# Client detected hit - tell host via RPC
		rpc_id(1, "_apply_damage_on_host", damage)
		return
	
	# Host applies immediately
	_apply_damage_on_host(damage)

@rpc("any_peer", "call_local", "reliable")
func _apply_damage_on_host(damage: int):
	if sync_is_dead or is_dead:
		return
	
	# Only host should execute this logic
	if not is_multiplayer_authority():
		return
	
	current_health -= damage
	current_health = max(0, current_health)
	sync_health = current_health  # MultiplayerSynchronizer auto-syncs this
	_update_health_ui()
	
	print("Zombie took ", damage, " damage. Health: ", current_health)
	
	if current_health <= 0:
		sync_is_dead = true  # MultiplayerSynchronizer auto-syncs this
		print("Zombie died! (syncing to clients...)")
		# Death cleanup happens in _physics_process -> _die()

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

func _die():
	if is_dead:
		return
	
	is_dead = true
	print("Zombie _die() called! (Authority: ", is_multiplayer_authority(), ")")
	
	# Disable all interactions
	if damage_hitbox:
		damage_hitbox.monitoring = false
	if player_detector:
		player_detector.monitoring = false
	
	collision_layer = 0
	collision_mask = 0
	
	# Play death animation if available
	if animation_player and animation_player.has_animation("zombiedeath"):
		animation_player.play("zombiedeath")
		await get_tree().create_timer(1.0).timeout
	
	# Cleanup on both host and clients
	queue_free()

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
					print("✅ ZOMBIE GROUP DETECTION: Player ", player.name, " entered range (distance: ", distance, ")")
	
	# Remove players that are no longer in range
	for player in players_in_range.duplicate():
		if not players_found_this_scan.has(player):
			var distance = global_position.distance_to(player.global_position) if is_instance_valid(player) else INF
			
			if distance > detection_radius or not _is_target_valid(player):
				players_in_range.erase(player)
				print("❌ ZOMBIE GROUP DETECTION: Player ", player.name if is_instance_valid(player) else "invalid", " left range")
				
				# If this was our target, clear it
				if player == target_player:
					target_player = null
					player_in_range = false
					print("🎯 Zombie target lost, will acquire new target")

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
	
	# Find closest player and check for attackable targets
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
		if target_player != priority_player:
			target_player = priority_player
			player_in_range = true
			print("🎯 ZOMBIE PRIORITY TARGET: ", priority_player.name, " (within 5m)")
			# Interrupt current attack to retarget
			if is_attacking:
				is_attacking = false
				can_attack = true
	elif closest_player:
		if target_player != closest_player:
			target_player = closest_player
			player_in_range = true
			print("🎯 ZOMBIE TARGET ACQUIRED: ", closest_player.name, " at distance: ", closest_distance)

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
		print("🎯 ZOMBIE PRIORITY TARGET: ", priority_player.name, " (within 5m)")
	elif closest_player:
		target_player = closest_player
		player_in_range = true
		print("🎯 ZOMBIE TARGET ACQUIRED: ", closest_player.name, " at distance: ", closest_distance)
	else:
		target_player = null
		player_in_range = false
		print("⚠️ Zombie: No valid targets available")

# Enhanced target validation
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

func _validate_current_target():
	if target_player and is_instance_valid(target_player):
		if not _is_target_valid(target_player):
			print("⚠️ Zombie current target invalid: ", target_player.name)
			target_player = null
			player_in_range = false
	else:
		target_player = null
		player_in_range = false
