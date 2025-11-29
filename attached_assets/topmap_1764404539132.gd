extends Control

@onready var moving_camera: Camera3D = $SubViewportContainer/SubViewport/Camera3D

var target_player: CharacterBody3D = null

# Map reference
var map_node: Node3D = null
var map_bounds_min: Vector3
var map_bounds_max: Vector3

# Layer definitions
const MAP_LAYER = 1
const MY_PLAYER_VISUAL_LAYER = 11
const OTHER_PLAYERS_LAYER = 12

# Store original layers for cleanup
var original_mesh_layers = {}
var other_players_original_layers = {}

func _ready():
	if not map_node:
		_find_map_node()
	
	if map_node:
		_calculate_map_bounds()
	else:
		map_bounds_min = Vector3(-50, 0, -50)
		map_bounds_max = Vector3(50, 0, 50)
		push_warning("No map node found. Using default bounds.")

func _find_map_node():
	var map_nodes = get_tree().get_nodes_in_group("map")
	if map_nodes.size() > 0:
		map_node = map_nodes[0]

func setup_minimap(player: CharacterBody3D):
	target_player = player
	
	# Configure moving camera - follows player
	moving_camera.cull_mask = (1 << (MAP_LAYER-1))
	moving_camera.rotation_degrees = Vector3(-90, 0, 0)
	
	# Force visual meshes for LOCAL PLAYER and hide OTHER PLAYERS
	if target_player and target_player.is_multiplayer_authority():
		_force_visual_meshes_to_layer()
		_hide_other_players_from_cameras()

func _force_visual_meshes_to_layer():
	if not target_player:
		return
	
	original_mesh_layers.clear()
	
	var mesh_paths = [
		"Champ/Armature/Skeleton3D/LHand/Gun",
		"Champ/Armature/Skeleton3D/Girl",
		"Champ/Armature/Skeleton3D/Hand/MeleeAttack/Sword"
	]
	
	for path in mesh_paths:
		var mesh_node = target_player.get_node_or_null(path)
		if mesh_node and mesh_node is Node3D:
			original_mesh_layers[path] = mesh_node.layers
			mesh_node.layers = (1 << (MY_PLAYER_VISUAL_LAYER-1))
			print("Forced local player ", path, " to layer ", MY_PLAYER_VISUAL_LAYER)

func _hide_other_players_from_cameras():
	if not target_player:
		return
	
	other_players_original_layers.clear()
	
	var players = get_tree().get_nodes_in_group("players")
	var mesh_paths = [
		"Champ/Armature/Skeleton3D/LHand/Gun",
		"Champ/Armature/Skeleton3D/Girl",
		"Champ/Armature/Skeleton3D/Hand/MeleeAttack/Sword"
	]
	
	for player in players:
		if player == target_player:
			continue
		
		for path in mesh_paths:
			var mesh_node = player.get_node_or_null(path)
			if mesh_node and mesh_node is Node3D:
				var unique_key = str(player.get_instance_id()) + ":" + path
				other_players_original_layers[unique_key] = {
					"node": mesh_node,
					"layers": mesh_node.layers
				}
				mesh_node.layers = (1 << (OTHER_PLAYERS_LAYER-1))
				print("Forced other player ", path, " to layer ", OTHER_PLAYERS_LAYER)

func _process(delta):
	if not target_player or not is_instance_valid(target_player):
		_cleanup()
		return
	
	# Update moving camera to follow player
	var camera_position = Vector3(
		target_player.global_position.x,
		50,
		target_player.global_position.z
	)
	moving_camera.global_position = camera_position
	moving_camera.rotation_degrees.y = target_player.rotation_degrees.y

func _cleanup():
	if target_player and is_instance_valid(target_player):
		_restore_original_layers()
		_restore_other_players_layers()
	
	queue_free()

func _restore_original_layers():
	for path in original_mesh_layers:
		var mesh_node = target_player.get_node_or_null(path)
		if mesh_node and mesh_node is Node3D:
			mesh_node.layers = original_mesh_layers[path]
			print("Restored local player ", path, " to original layers")

func _restore_other_players_layers():
	for unique_key in other_players_original_layers:
		var data = other_players_original_layers[unique_key]
		var mesh_node = data["node"]
		if mesh_node and is_instance_valid(mesh_node) and mesh_node is Node3D:
			mesh_node.layers = data["layers"]
			print("Restored other player mesh to original layers")

func _calculate_map_bounds():
	if not map_node:
		return
	
	var aabb = _get_total_aabb(map_node)
	
	if aabb != AABB():
		map_bounds_min = aabb.position
		map_bounds_max = aabb.end
		print("Calculated map bounds: ", map_bounds_min, " to ", map_bounds_max)
	else:
		map_bounds_min = Vector3(-50, 0, -50)
		map_bounds_max = Vector3(50, 0, 50)
		push_warning("Could not calculate map bounds. Using defaults.")

func _get_total_aabb(node: Node3D) -> AABB:
	var total_aabb = AABB()
	var first_aabb = true
	
	if node is MeshInstance3D and node.mesh:
		var mesh_aabb = node.mesh.get_aabb()
		var global_aabb = node.global_transform * mesh_aabb
		total_aabb = global_aabb
		first_aabb = false
	
	elif node is CollisionShape3D and node.shape:
		var shape_aabb = node.shape.get_debug_mesh().get_aabb()
		var global_aabb = node.global_transform * shape_aabb
		if first_aabb:
			total_aabb = global_aabb
			first_aabb = false
		else:
			total_aabb = total_aabb.merge(global_aabb)
	
	for child in node.get_children():
		if child is Node3D:
			var child_aabb = _get_total_aabb(child)
			if child_aabb != AABB():
				if first_aabb:
					total_aabb = child_aabb
					first_aabb = false
				else:
					total_aabb = total_aabb.merge(child_aabb)
	
	return total_aabb
