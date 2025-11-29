extends Node3D

# Node references - Assign these in the editor
@export var zone_collision: CollisionShape3D  # Path: root/safezone/zone
@export var zone_mesh: MeshInstance3D  # Path: root/safezone/Mesh
@export var next_zone_mesh: MeshInstance3D  # Path: root/safezone/Next (for upcoming zone preview)
@export var status_label: Label  # UI Label for status updates

# Zone configuration
var is_active: bool = false
var damage_timer: float = 0.0
var damage_interval: float = 1.0  # Damage every second

# Zone progression sequence with corresponding damage values
# [radius, damage_per_second]
var zone_sequence: Array = [
	{"radius": 50.0, "damage": 0},
	{"radius": 35.0, "damage": 1},
	{"radius": 25.0, "damage": 2},
	{"radius": 20.0, "damage": 3},
	{"radius": 15.0, "damage": 5},
	{"radius": 10.0, "damage": 5},
	{"radius": 7.0, "damage": 5},
	{"radius": 3.0, "damage": 5},
	{"radius": 1.0, "damage": 5}
]

var current_zone_index: int = 0  # Index of the current active zone (what the main zone is currently at)
var current_radius: float = 50.0
var current_center: Vector3 = Vector3.ZERO
var target_radius: float = 35.0
var target_center: Vector3 = Vector3.ZERO

# Timing (5sec wait, 2sec shrink for testing - adjust as needed)
var wait_time: float = 30.0
var shrink_time: float = 10.0

# State machine
enum State { WAITING, SHRINKING }
var current_state: State = State.WAITING
var timer: float = 0.0

# Shrinking interpolation
var shrink_start_radius: float = 50.0
var shrink_start_center: Vector3 = Vector3.ZERO
var shrink_progress: float = 0.0

func _ready():
	# Validate node references
	if not zone_collision or not zone_mesh or not next_zone_mesh:
		push_error("Zone nodes not assigned! Please assign zone_collision, zone_mesh, and next_zone_mesh in the inspector.")
		return
	
	if status_label:
		status_label.hide()
	
	# Initialize first zone using editor transform (50m)
	current_zone_index = 0
	current_radius = zone_sequence[0]["radius"]
	current_center = global_position  # Use position set in editor
	update_zone_visual(current_radius, current_center)
	
	# Calculate first target (35m, same center) and show it
	calculate_next_zone()
	update_next_zone_preview()  # Show next zone from the start
	
	print("🟢 SafeZone initialized: Zone 0 (%.1fm, %d damage/sec)" % [current_radius, get_current_damage()])
	
	# Connect to lobby signals
	var lobby = get_tree().get_current_scene()
	if lobby:
		await get_tree().process_frame
		if lobby.has_signal("zone_start"):
			lobby.zone_start.connect(_on_zone_start)
			print("✅ Connected to zone_start signal")
		else:
			print("❌ zone_start signal not found in lobby")
			
		if lobby.has_signal("zone_reset"):
			lobby.zone_reset.connect(_on_zone_reset)
			print("✅ Connected to zone_reset signal")
		else:
			print("❌ zone_reset signal not found in lobby")
	
	# Don't start immediately
	set_process(false)

func _process(delta: float):
	if not is_active:
		return
	
	timer += delta
	damage_timer += delta
	
	# Apply zone damage
	if damage_timer >= damage_interval:
		_apply_zone_damage()
		damage_timer = 0.0
	
	# State machine
	match current_state:
		State.WAITING:
			update_status_waiting()
			if timer >= wait_time:
				start_shrinking()
		
		State.SHRINKING:
			update_status_shrinking()
			shrink_progress = timer / shrink_time
			if shrink_progress >= 1.0:
				complete_shrinking()
			else:
				interpolate_zone(shrink_progress)

# Calculate next zone using your mathematical system
func calculate_next_zone():
	var next_zone_index = current_zone_index + 1
	
	if next_zone_index >= zone_sequence.size():
		if status_label:
			status_label.text = "Final Zone Reached!"
		return
	
	# Get next radius and damage from sequence
	target_radius = zone_sequence[next_zone_index]["radius"]
	
	# Special case: First transition (50m → 35m) uses same center
	if current_zone_index == 0:
		target_center = current_center
		print("Zone transition: %.1fm → %.1fm | Center stays at origin | Next damage: %d hp/sec" % [
			current_radius, target_radius, get_next_damage()
		])
		return
	
	# Your mathematical formula for subsequent zones:
	# 1. Pick random point on circumference
	var random_angle = randf() * TAU
	var point_on_circumference = Vector3(
		cos(random_angle) * current_radius,
		0,
		sin(random_angle) * current_radius
	) + current_center
	
	# 2. Divide line from center to point in ratio 1:2
	# New point = center + (1/3) * (point - center)
	var line_vector = point_on_circumference - current_center
	target_center = current_center + (line_vector / 3.0)
	
	var distance_moved = current_center.distance_to(target_center)
	var next_damage = get_next_damage()
	print("Zone transition: %.1fm → %.1fm | Center moved %.2fm | Next damage: %d hp/sec" % [
		current_radius, target_radius, distance_moved, next_damage
	])

# Get current damage based on zone index
func get_current_damage() -> int:
	if current_zone_index < zone_sequence.size():
		return zone_sequence[current_zone_index]["damage"]
	return 5  # Default to max damage

# Get next zone damage for display
func get_next_damage() -> int:
	var next_index = current_zone_index + 1
	if next_index < zone_sequence.size():
		return zone_sequence[next_index]["damage"]
	return 5  # Default to max damage

# Get current zone radius
func get_current_radius() -> float:
	if current_zone_index < zone_sequence.size():
		return zone_sequence[current_zone_index]["radius"]
	return 1.0

# Get next zone radius
func get_next_radius() -> float:
	var next_index = current_zone_index + 1
	if next_index < zone_sequence.size():
		return zone_sequence[next_index]["radius"]
	return 1.0

# Get current zone info for minimap
func get_current_zone_info() -> Dictionary:
	return {
		"radius": current_radius,
		"center": current_center,
		"damage": get_current_damage(),
		"stage": current_zone_index
	}

# Get next zone info for minimap safe circle
func get_next_zone_info() -> Dictionary:
	return {
		"radius": target_radius,
		"center": target_center,
		"damage": get_next_damage()
	}

# Smooth interpolation during shrinking
func interpolate_zone(progress: float):
	var smooth_progress = smoothstep(0.0, 1.0, progress)
	
	var current_r = lerp(shrink_start_radius, target_radius, smooth_progress)
	var current_c = shrink_start_center.lerp(target_center, smooth_progress)
	
	update_zone_visual(current_r, current_c)
	
	# Sync visual changes to all clients
	if multiplayer.is_server():
		rpc("_sync_zone_visual", current_r, current_c, smooth_progress)

# Update the physical zone (collision + mesh)
func update_zone_visual(radius: float, center: Vector3):
	if not zone_collision or not zone_mesh:
		return
	
	# Update collision shape position
	zone_collision.global_position = center
	
	# Update collision shape (CylinderShape3D)
	if zone_collision.shape is CylinderShape3D:
		var cylinder_shape = zone_collision.shape as CylinderShape3D
		cylinder_shape.radius = radius
	
	# Update mesh position
	var mesh_position = Vector3(
		center.x,
		zone_mesh.global_position.y,  # ← Keep editor Y
		center.z
	)
	zone_mesh.global_position = mesh_position
	
	# Update mesh scale (CylinderMesh)
	if zone_mesh.mesh is CylinderMesh:
		var cylinder_mesh = zone_mesh.mesh as CylinderMesh
		cylinder_mesh.top_radius = radius
		cylinder_mesh.bottom_radius = radius

# Update next zone preview - ALWAYS VISIBLE
func update_next_zone_preview():
	if not next_zone_mesh:
		return
	
	# Always show next zone mesh
	next_zone_mesh.show()
	
	# Use editor Y position, but target X and Z for the center
	var preview_position = Vector3(
		target_center.x,
		next_zone_mesh.global_position.y,  # ← Keep editor Y
		target_center.z
	)
	next_zone_mesh.global_position = preview_position
	
	# Update next zone mesh scale
	if next_zone_mesh.mesh is CylinderMesh:
		var next_cylinder_mesh = next_zone_mesh.mesh as CylinderMesh
		next_cylinder_mesh.top_radius = target_radius
		next_cylinder_mesh.bottom_radius = target_radius
	
	# Sync to all clients
	if multiplayer.is_server():
		rpc("_sync_next_zone_preview", preview_position, target_radius)  # ← Use preview_position here too

# State transitions
func start_waiting():
	current_state = State.WAITING
	timer = 0.0
	# DON'T hide next zone - it stays visible
	update_status_waiting()
	
	# Sync state to all clients
	if multiplayer.is_server():
		rpc("_sync_zone_state", "waiting", current_radius, current_center, target_radius, target_center, current_zone_index)

func start_shrinking():
	current_state = State.SHRINKING
	timer = 0.0
	shrink_start_radius = current_radius
	shrink_start_center = current_center
	# Next zone already visible, just update status
	update_status_shrinking()
	
	# Sync state to all clients
	if multiplayer.is_server():
		rpc("_sync_zone_state", "shrinking", current_radius, current_center, target_radius, target_center, current_zone_index)

func complete_shrinking():
	# IMPORTANT: Update current values to target (zone has completed shrinking)
	current_radius = target_radius
	current_center = target_center
	current_zone_index += 1  # Move to next zone index FIRST
	
	update_zone_visual(current_radius, current_center)
	
	print("✅ Zone %d active | Radius: %.1fm | Damage: %d hp/sec" % [
		current_zone_index, current_radius, get_current_damage()
	])
	
	# Sync zone completion to all clients
	if multiplayer.is_server():
		rpc("_sync_zone_complete", current_radius, current_center, current_zone_index)
	
	# Check if final zone reached
	if current_zone_index >= zone_sequence.size() - 1:
		if status_label:
			status_label.text = "Final Zone - %d hp/sec" % get_current_damage()
		# Hide next zone only at final zone
		if next_zone_mesh:
			next_zone_mesh.hide()
		set_process(false)
		return
	
	# Calculate next zone and update preview
	calculate_next_zone()
	update_next_zone_preview()  # Update to show the new next zone
	start_waiting()

# UI Updates
func update_status_waiting():
	if status_label:
		var time_left = wait_time - timer
		var current_damage = get_current_damage()
		var next_damage = get_next_damage()
		status_label.text = "Next Zone in %.0f sec | Current: %d hp/sec | Next: %d hp/sec" % [ceil(time_left), current_damage, next_damage]
		
		# Sync label to all clients
		if multiplayer.is_server():
			rpc("_sync_status_label", status_label.text)

func update_status_shrinking():
	if status_label:
		var time_left = shrink_time - timer
		var current_damage = get_current_damage()
		var next_damage = get_next_damage()
		status_label.text = "Zone Shrinking! %.0f sec | Current: %d hp/sec | Next: %d hp/sec" % [ceil(time_left), current_damage, next_damage]
		
		# Sync label to all clients
		if multiplayer.is_server():
			rpc("_sync_status_label", status_label.text)

# Signal handlers
func _on_zone_start():
	print("🟢 Zone system activated!")
	is_active = true
	current_zone_index = 0
	damage_timer = 0.0
	set_process(true)
	
	# Start from initial zone
	current_radius = zone_sequence[0]["radius"]
	current_center = global_position  # Use editor position
	update_zone_visual(current_radius, current_center)
	calculate_next_zone()
	update_next_zone_preview()  # Show next zone immediately
	start_waiting()
	
	if status_label:
		status_label.show()
	
	# Sync zone start to all clients
	if multiplayer.is_server():
		rpc("_sync_zone_start")

func _on_zone_reset():
	print("🔄 Zone system reset!")
	is_active = false
	set_process(false)
	
	# Reset to initial state
	current_zone_index = 0
	current_radius = zone_sequence[0]["radius"]
	current_center = global_position  # Use editor position
	target_radius = zone_sequence[1]["radius"]
	target_center = current_center
	timer = 0.0
	
	if status_label:
		status_label.hide()
	
	if next_zone_mesh:
		next_zone_mesh.hide()
	
	update_zone_visual(current_radius, current_center)
	calculate_next_zone()
	
	# Sync zone reset to all clients
	if multiplayer.is_server():
		rpc("_sync_zone_reset")

# Apply damage to players outside the zone
func _apply_zone_damage():
	# Only the server should apply damage to prevent duplicates
	if not multiplayer.is_server():
		return
	
	var players_container = get_tree().get_current_scene().get_node_or_null("PlayersContainer")
	if not players_container:
		return
	
	var current_damage = get_current_damage()
	
	# Skip if no damage for current zone
	if current_damage <= 0:
		return
	
	for player in players_container.get_children():
		# Skip if player doesn't have take_damage method
		if not player.has_method("take_damage"):
			continue
		
		# Skip dead players
		if player.get("sync_is_dead") != null and player.sync_is_dead:
			continue
		
		# Skip spectators
		if player.get("is_spectator") != null and player.is_spectator:
			continue
		
		# Skip god mode players
		if player.get("god_mode") != null and player.god_mode:
			continue
		
		# Check if player is outside zone (use 2D distance on XZ plane)
		var player_pos = player.global_position
		var distance_from_center = Vector2(
			player_pos.x - current_center.x, 
			player_pos.z - current_center.z
		).length()
		
		if distance_from_center > current_radius:
			# Zone damage (source_id = -1 for zone)
			# Only apply damage on the server - it will sync to clients via RPC
			player.take_damage(current_damage, -1, "zone")
			
			# Check if this damage will kill the player
			if player.current_health <= current_damage:
				# Report zone kill immediately
				var lobby = get_tree().get_current_scene()
				if lobby and lobby.has_method("report_kill"):
					lobby.report_kill(-1, int(player.name), "zone")
			
			print("⚡ Player %s taking zone damage: %d (Zone %d)" % [
				player.name, current_damage, current_zone_index
			])
# ============ RPC SYNC METHODS ============

# Sync zone visual state to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_zone_visual(radius: float, center: Vector3, progress: float):
	if multiplayer.is_server():
		return
	
	update_zone_visual(radius, center)
	
	if status_label:
		var time_left = shrink_time * (1.0 - progress)
		var current_damage = get_current_damage()
		var next_damage = get_next_damage()
		status_label.text = "Zone Shrinking! %.0f sec | Current: %d hp/sec | Next: %d hp/sec" % [ceil(time_left), current_damage, next_damage]

# Sync next zone preview to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_next_zone_preview(center: Vector3, radius: float):
	if multiplayer.is_server():
		return
	
	if not next_zone_mesh:
		return
	
	next_zone_mesh.show()
	
	# Use editor Y position, but received X and Z
	var preview_position = Vector3(
		center.x,
		next_zone_mesh.global_position.y,  # ← Keep editor Y
		center.z
	)
	next_zone_mesh.global_position = preview_position
	
	if next_zone_mesh.mesh is CylinderMesh:
		var next_cylinder_mesh = next_zone_mesh.mesh as CylinderMesh
		next_cylinder_mesh.top_radius = radius
		next_cylinder_mesh.bottom_radius = radius

# Sync zone state to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_zone_state(state: String, start_radius: float, start_center: Vector3, end_radius: float, end_center: Vector3, zone_index: int):
	if multiplayer.is_server():
		return
	
	current_zone_index = zone_index
	current_radius = start_radius
	current_center = start_center
	target_radius = end_radius
	target_center = end_center
	
	match state:
		"waiting":
			current_state = State.WAITING
			timer = 0.0
			update_status_waiting()
		"shrinking":
			current_state = State.SHRINKING
			timer = 0.0
			shrink_start_radius = start_radius
			shrink_start_center = start_center
			update_status_shrinking()

# Sync zone completion to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_zone_complete(radius: float, center: Vector3, zone_index: int):
	if multiplayer.is_server():
		return
	
	current_radius = radius
	current_center = center
	current_zone_index = zone_index
	update_zone_visual(radius, center)
	
	if status_label:
		var current_damage = get_current_damage()
		status_label.text = "Zone Complete - %d hp/sec" % current_damage

# Sync status label to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_status_label(text: String):
	if multiplayer.is_server():
		return
	
	if status_label:
		status_label.text = text

# Sync zone start to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_zone_start():
	if multiplayer.is_server():
		return
	
	print("🟢 Zone system activated (client)!")
	is_active = true
	current_zone_index = 0
	damage_timer = 0.0
	set_process(true)
	
	# Reset to initial state
	current_radius = zone_sequence[0]["radius"]
	current_center = global_position
	update_zone_visual(current_radius, current_center)
	
	# Show next zone preview
	target_radius = zone_sequence[1]["radius"]
	target_center = current_center
	update_next_zone_preview()
	
	if status_label:
		status_label.show()

# Sync zone reset to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_zone_reset():
	if multiplayer.is_server():
		return
	
	print("🔄 Zone system reset (client)!")
	is_active = false
	set_process(false)
	
	# Reset to initial state
	current_zone_index = 0
	current_radius = zone_sequence[0]["radius"]
	current_center = global_position
	target_radius = zone_sequence[1]["radius"]
	target_center = current_center
	timer = 0.0
	
	if status_label:
		status_label.hide()
	
	if next_zone_mesh:
		next_zone_mesh.hide()
	
	update_zone_visual(current_radius, current_center)
