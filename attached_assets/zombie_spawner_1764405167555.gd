# ZombieSpawner.gd - Attach this to a Node3D in your main scene
extends Node3D

@export var zombie_scene: PackedScene
@export var spawn_interval: float = 5.0
@export var max_zombies: int = 5
@export var spawn_radius_min: float = 8.0  # Minimum distance from player
@export var spawn_radius_max: float = 20.0  # Maximum distance from player

var active_zombies: Array = []
var spawn_timer: Timer
var player: CharacterBody3D
var player_original_forward: Vector3  # Store the original forward direction

func _ready():
	print("Zombie Spawner initialized")
	setup_spawn_timer()
	find_player()
	
	# Store the player's original forward direction at start
	if player:
		player_original_forward = player.global_transform.basis.z.normalized()
		player_original_forward.y = 0  # Keep on ground level
		print("Player original forward direction stored: ", player_original_forward)
	
	# Load zombie scene - MAKE SURE THIS PATH IS CORRECT
	if not zombie_scene:
		zombie_scene = load("res://Scenes/zombie.tscn") # Adjust path to your zombie scene
		if not zombie_scene:
			print("ERROR: Could not load zombie scene! Check the path.")
			return
	
	print("Zombie scene loaded successfully")
	
	# Test spawn after 2 seconds
	await get_tree().create_timer(2.0).timeout
	print("Testing manual spawn...")
	debug_spawn()

func setup_spawn_timer():
	# Create timer as child
	spawn_timer = Timer.new()
	add_child(spawn_timer)
	
	spawn_timer.wait_time = spawn_interval
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	
	# Start the timer manually (autostart doesn't always work reliably)
	spawn_timer.start()
	
	print("Spawn timer setup complete - interval: ", spawn_interval, " seconds")
	print("Timer started: ", spawn_timer.is_stopped() == false)

func find_player():
	# First try to find player by group
	var players = get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		player = players[0]
		print("Player found by group: ", player.name)
		return
	
	# Alternative: try to find by node path (adjust as needed)
	var potential_paths = [
		"../Player",
		"Player", 
		"../Penny2/Penny", # Based on your scene structure
		"Penny2/Penny",
		"CharacterBody3D"  # Added based on your scene structure
	]
	
	for path in potential_paths:
		var node = get_node_or_null(path)
		if node and node is CharacterBody3D:
			player = node
			print("Player found at path: ", path)
			return
	
	print("WARNING: Player not found! Make sure player is in 'player' group or adjust paths.")

func _on_spawn_timer_timeout():
	print("Spawn timer triggered - Active zombies: ", active_zombies.size(), "/", max_zombies)
	
	if active_zombies.size() < max_zombies and player:
		spawn_zombie()
		# Restart timer for next spawn
		spawn_timer.start()
	elif not player:
		print("Cannot spawn - no player found")
		spawn_timer.start()  # Keep trying
	else:
		print("Max zombies reached, waiting...")
		spawn_timer.start()  # Keep checking

func spawn_zombie():
	if not zombie_scene:
		print("ERROR: No zombie scene assigned!")
		return
	
	if not player:
		print("ERROR: No player found for spawning!")
		return
	
	print("Spawning zombie...")
	
	var zombie = zombie_scene.instantiate()
	if not zombie:
		print("ERROR: Failed to instantiate zombie!")
		return
	
	# Add to scene FIRST before setting position
	get_parent().add_child(zombie)
	
	# Use the original forward direction instead of current facing
	var forward_direction = player_original_forward
	
	# Calculate spawn position in front of player using original direction
	var spawn_pos = player.global_position
	var distance = randf_range(spawn_radius_min, spawn_radius_max)
	
	# Add random angle variation within ±15 degrees (±π/12 radians)
	var max_angle_variation = deg_to_rad(15.0)  # 15 degrees in radians
	var angle_variation = randf_range(-max_angle_variation, max_angle_variation)
	
	# Rotate the original forward direction by the random angle
	var rotated_forward = Vector3(
		forward_direction.x * cos(angle_variation) - forward_direction.z * sin(angle_variation),
		0,
		forward_direction.x * sin(angle_variation) + forward_direction.z * cos(angle_variation)
	)
	
	spawn_pos += rotated_forward * distance
	
	# Make sure zombie spawns on ground level (same as player)
	spawn_pos.y = player.global_position.y
	
	zombie.global_position = spawn_pos
	
	print("Zombie spawn position: ", spawn_pos)
	print("Player position: ", player.global_position)
	print("Using original forward direction: ", forward_direction)
	print("Angle variation (degrees): ", rad_to_deg(angle_variation))
	print("Distance from player: ", player.global_position.distance_to(spawn_pos))
	
	# Connect death signal
	if zombie.has_signal("zombie_died"):
		zombie.zombie_died.connect(_on_zombie_died.bind(zombie))
	
	# Add to active zombies list
	active_zombies.append(zombie)
	
	print("Zombie spawned successfully! Total active: ", active_zombies.size())

func _on_zombie_died(zombie):
	print("Zombie died, removing from active list")
	if zombie in active_zombies:
		active_zombies.erase(zombie)
	print("Active zombies remaining: ", active_zombies.size())

# Debug function - call this to test spawning manually
func debug_spawn():
	spawn_zombie()

# Add this for testing - press Z to spawn zombie
func _input(event):
	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_Z:
			print("Manual spawn triggered by Z key")
			debug_spawn()
