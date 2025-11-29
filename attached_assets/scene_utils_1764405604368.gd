# scene_utils.gd - Fixed return types and pass-by-reference issues
extends Node

static func hide_all_scenes_except(root_node: Node, exclude_node: Node = null):
	"""Hide all scene nodes and their children except GameManager and the excluded node"""
	print("Hiding all scenes except GameManager and: ", exclude_node.name if exclude_node else "none")
	
	for child in root_node.get_children():
		# Always keep GameManager active (never hide or disable it)
		var is_game_manager = _is_game_manager_node(child)
		var is_excluded = child == exclude_node
		
		if not is_game_manager and not is_excluded:
			# Recursively hide and disable this node and all its children
			recursively_hide_and_disable(child)
			print("Hidden: ", child.name)
		elif is_game_manager:
			print("Preserved: ", child.name, " (GameManager - always active)")
		else:
			print("Skipped: ", child.name, " (excluded scene)")

static func _is_game_manager_node(node: Node) -> bool:
	"""Check if a node is the GameManager"""
	return node is GameManager or node.has_method("save_current_player_data") or "GameManager" in node.name

static func recursively_hide_and_disable(node: Node):
	"""Recursively hide and disable a node and all its children"""
	# Skip GameManager nodes even if they're nested
	if _is_game_manager_node(node):
		print("  Preserved nested GameManager: ", node.name)
		return
	
	# Hide this node if it has visible property
	if "visible" in node:
		node.visible = false
	
	# Disable processing for this node
	node.process_mode = Node.PROCESS_MODE_DISABLED
	
	# Special handling for cameras - disable them completely
	if node is Camera3D:
		var camera = node as Camera3D
		camera.current = false
		print("  Disabled camera: ", node.name)
	
	# Recursively process all children
	for child in node.get_children():
		recursively_hide_and_disable(child)

static func recursively_show_and_enable(node: Node):
	"""Recursively show and enable a node and all its children"""
	# Skip GameManager nodes (they should always stay enabled)
	if _is_game_manager_node(node):
		return
	
	# Show this node if it has visible property
	if "visible" in node:
		node.visible = true
	
	# Enable processing for this node
	node.process_mode = Node.PROCESS_MODE_INHERIT
	
	# Recursively process all children
	for child in node.get_children():
		recursively_show_and_enable(child)

static func disable_all_cameras_in_scene(root_node: Node) -> Array:
	"""Disable all cameras in the entire scene, regardless of where they are"""
	var disabled_cameras = []
	_find_and_disable_cameras_recursive(root_node, disabled_cameras, false, null)
	return disabled_cameras

static func disable_all_cameras_except(root_node: Node, exclude_node: Node = null) -> Array:
	"""Disable all cameras except those in the excluded node hierarchy"""
	var disabled_cameras = []
	_find_and_disable_cameras_recursive(root_node, disabled_cameras, true, exclude_node)
	return disabled_cameras

static func _find_and_disable_cameras_recursive(node: Node, disabled_cameras: Array, check_exclusion: bool, exclude_node: Node):
	"""Recursive helper function to find and disable cameras"""
	# Check if we're in the excluded node hierarchy
	var is_in_excluded = false
	if check_exclusion and exclude_node:
		var current = node
		while current != null:
			if current == exclude_node:
				is_in_excluded = true
				break
			current = current.get_parent()
	
	if node is Camera3D:
		var camera = node as Camera3D
		if not is_in_excluded:
			camera.current = false
			disabled_cameras.append({
				"camera": camera,
				"path": node.get_path(),
				"was_current": camera.is_current()
			})
			print("Disabled camera: ", node.name)
		else:
			print("Skipped camera in excluded hierarchy: ", node.name)
	
	# Continue searching in children
	for child in node.get_children():
		_find_and_disable_cameras_recursive(child, disabled_cameras, check_exclusion, exclude_node)

static func safe_show_scene(game_manager: GameManager, scene_node: Node) -> bool:
	"""Save data and then show the specified scene with comprehensive error handling"""
	if not game_manager:
		print("ERROR: GameManager is null in safe_show_scene")
		return false
	
	if not scene_node:
		print("ERROR: Scene node is null in safe_show_scene")
		return false
	
	print("Attempting to save and show scene: ", scene_node.name)
	
	# Use the correct method name - save_current_player_data()
	var save_success = game_manager.save_current_player_data()
	if save_success or not game_manager.has_save_data():
		# First, disable ALL cameras in the entire scene to prevent any camera conflicts
		var disabled_cameras = disable_all_cameras_in_scene(game_manager.get_parent())
		print("Disabled ", disabled_cameras.size(), " cameras to prevent conflicts")
		
		# Hide all scenes except GameManager and the target scene
		hide_all_scenes_except(game_manager.get_parent(), scene_node)
		
		# Recursively show and enable the target scene and all its children
		recursively_show_and_enable(scene_node)
		
		# ACTIVATE THE TARGET SCENE'S CAMERA AFTER SHOWING IT
		activate_scene_camera(scene_node)
		
		print("Successfully changed to scene: ", scene_node.name)
		
		# Call initialization method if the scene has one
		if scene_node.has_method("initialize"):
			scene_node.initialize()
		
		return true
	else:
		print("ERROR: Could not change scene due to save failure")
		return false

static func activate_scene_camera(scene_node: Node):
	"""Find and activate the first camera in the scene hierarchy"""
	var cameras = []
	_find_cameras_recursive(scene_node, cameras)
	
	if cameras.size() > 0:
		# Activate the first camera found in the scene
		cameras[0].current = true
		print("Activated camera: ", cameras[0].name, " in scene: ", scene_node.name)
	else:
		print("Warning: No cameras found in scene: ", scene_node.name)

static func _find_cameras_recursive(node: Node, cameras: Array):
	"""Recursive helper function to find cameras"""
	if node is Camera3D:
		cameras.append(node)
	
	for child in node.get_children():
		_find_cameras_recursive(child, cameras)

static func debug_visible_nodes(root_node: Node, indent: String = ""):
	"""Print debug information about visible nodes and cameras"""
	var node_info = indent + root_node.name + " (" + root_node.get_class() + ")"
	
	if "visible" in root_node:
		node_info += " - " + ("VISIBLE" if root_node.visible else "hidden")
	else:
		node_info += " - no visible property"
	
	node_info += " - process_mode: " + str(root_node.process_mode)
	
	if root_node is Camera3D:
		var cam = root_node as Camera3D
		node_info += " - Camera Current: " + str(cam.is_current())
	
	print(node_info)
	
	# Recursively process children
	for child in root_node.get_children():
		debug_visible_nodes(child, indent + "  ")

static func debug_active_cameras(root_node: Node) -> Array:
	"""Find and print all active cameras in the scene"""
	var active_cameras = []
	_find_active_cameras_recursive(root_node, active_cameras)
	
	print("=== ACTIVE CAMERAS ===")
	if active_cameras.size() == 0:
		print("No active cameras found")
	else:
		for cam_info in active_cameras:
			print("Active camera: ", cam_info.name, " | Path: ", cam_info.path, " | Parent: ", cam_info.parent)
	print("=====================")
	
	return active_cameras

static func _find_active_cameras_recursive(node: Node, active_cameras: Array):
	"""Recursive helper function to find active cameras"""
	if node is Camera3D:
		var cam = node as Camera3D
		if cam.is_current():
			active_cameras.append({
				"camera": cam,
				"name": cam.name,
				"path": cam.get_path(),
				"parent": cam.get_parent().name if cam.get_parent() else "none"
			})
	
	for child in node.get_children():
		_find_active_cameras_recursive(child, active_cameras)

static func force_disable_all_cameras(root_node: Node) -> int:
	"""Force disable all cameras in the scene, no exceptions"""
	var disabled_count = 0
	disabled_count = _disable_cameras_recursive(root_node, disabled_count)
	print("Force disabled ", disabled_count, " cameras")
	return disabled_count

static func _disable_cameras_recursive(node: Node, disabled_count: int) -> int:
	"""Recursive helper function to disable cameras - FIXED to return count"""
	var count = disabled_count
	
	if node is Camera3D:
		var cam = node as Camera3D
		if cam.is_current():
			cam.current = false
			count += 1
			print("Force disabled camera: ", node.name, " at path: ", node.get_path())
	
	# Process children and accumulate counts
	for child in node.get_children():
		count = _disable_cameras_recursive(child, count)
	
	return count
