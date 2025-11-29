extends Node3D

@onready var address_input: LineEdit = $Menu/IPInput
@onready var spawn_player: Node3D = $SpawnPlayer
@onready var menu: Control = $Menu
@onready var active_player_label: Label = $GameUI/Active
@export var city_portal: Area3D
@export var village_portal: Area3D
@export var island_portal: Area3D
@export var graveyard_portal: Area3D
# Multiplayer chat
@onready var multiplayer_chat: Control = $MultiplayerChat

var active_players_count: int = 0
var stored_player_data = {}
var player_states = {}  # Format: {player_id: {"nick": "name", "alive": true, "color": Color.WHITE}}

# Character scenes
var character_scenes = {
	"RedTop": "res://scenes/RedTop.tscn",
	"BlackOutfit": "res://scenes/BlackOutfit.tscn",
	"RedTShirt": "res://scenes/RedTShirt.tscn",
	"ScarfShades": "res://scenes/BlueTShirt.tscn"
}

# Portal scene mapping
var portal_scenes = {
	"city": "res://scenes/city.tscn",
	"village": "res://scenes/city.tscn", 
	"island": "res://scenes/city.tscn",
	"graveyard": "res://scenes/city.tscn"
}

var chat_visible = false
var players_pending_removal = []  # Track players being removed to prevent sync issues

func _ready():
	multiplayer_chat.hide()
	menu.show()
	active_player_label.hide()
	multiplayer_chat.set_process_input(true)
	
	Network.server_disconnected.connect(_on_server_disconnected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	
	if multiplayer.is_server():
		Network.connect("player_connected", Callable(self, "_on_player_connected"))
	_setup_portals()

# ============ Scene Management ============
func _setup_portals():
	# Connect each portal if it exists
	if city_portal:
		city_portal.body_entered.connect(_on_portal_entered.bind("city"))
	if village_portal:
		village_portal.body_entered.connect(_on_portal_entered.bind("village"))
	if island_portal:
		island_portal.body_entered.connect(_on_portal_entered.bind("island"))
	if graveyard_portal:
		graveyard_portal.body_entered.connect(_on_portal_entered.bind("graveyard"))

# ============ MULTIPLAYER MODE FUNCTIONS ============

func _on_player_connected(peer_id, player_info):
	_add_player(peer_id, player_info)

func _on_peer_disconnected(id):
	if multiplayer.is_server():
		_safe_remove_player(id)
		
func _on_host_pressed():
	menu.hide()
	
	# Get player name from GameManager
	var player_name = "Player"
	if GameManager.is_logged_in and GameManager.current_player_data:
		player_name = GameManager.current_player_data.get("username", "Player")
	
	Network.start_host(player_name, "player")
	# Add host as first player
	await get_tree().process_frame
	var host_id = multiplayer.get_unique_id()
	if Network.players.has(host_id):
		_add_player(host_id, Network.players[host_id])

func _on_join_pressed():
	menu.hide()
	
	# Get player name from GameManager
	var player_name = "Player"
	if GameManager.is_logged_in and GameManager.current_player_data:
		player_name = GameManager.current_player_data.get("username", "Player")
	
	Network.join_game(player_name, "player", address_input.text.strip_edges())

func _add_player(id: int, player_info: Dictionary):
	if spawn_player.has_node(str(id)) or id in players_pending_removal:
		return
	
	# Each player loads their exact character from their local GameManager
	var character_name = "RedTop"
	
	if GameManager.is_logged_in and GameManager.current_player_data:
		character_name = GameManager.current_player_data.get("character")
		print("Player ", id, " loading character: ", character_name)
	
	# Load the exact character scene they selected
	var scene_path = character_scenes.get(character_name)
	var character_scene = load(scene_path)
	
	if not character_scene:
		return
	
	var player = character_scene.instantiate()
	player.name = str(id)
	spawn_player.add_child(player, true)
	
	# Spawn with increased radius (8)
	player.global_position = get_spawn_point()
	
	# Set nickname from player_info
	var nick = player_info.get("nick", "Player")
	player_states[id] = {"nick": nick, "alive": true, "color": Color.WHITE}
	
	# Set player nickname display
	if player.has_node("PlayerNick/Nickname"):
		player.get_node("PlayerNick/Nickname").text = nick
		player.get_node("PlayerNick/Nickname").modulate = Color.WHITE
	
	# Create minimap for local player
	if id == multiplayer.get_unique_id():
		_create_minimap_for_player(id, player)
	
	# Update player display
	if multiplayer.is_server():
		_update_active_players_display()
		rpc("sync_player_states", player_states)

func get_spawn_point() -> Vector3:
	var base_position = spawn_player.global_position
	var random_angle = randf() * 2 * PI
	var random_radius = randf() * 4.0
	
	var offset = Vector3(
		cos(random_angle) * random_radius,
		0,
		sin(random_angle) * random_radius
	)
	
	return base_position + offset

func _safe_remove_player(id: int):
	"""Safely remove player with proper cleanup order"""
	if id in players_pending_removal:
		return
	
	players_pending_removal.append(id)
	
	# 1. First destroy the minimap to prevent reference errors
	_destroy_minimap_for_player(id)
	
	# 2. Remove from player states
	player_states.erase(id)
	
	# 3. Remove the player node safely
	if spawn_player.has_node(str(id)):
		var player_node = spawn_player.get_node(str(id))
		if player_node:
			# Disable the player node first to stop any processing
			player_node.set_process(false)
			player_node.set_physics_process(false)
			player_node.hide()
			
			# Queue free for safe deletion
			player_node.queue_free()
	
	# 4. Update display and sync
	_update_active_players_display()
	
	# 5. Sync with all clients if server
	if multiplayer.is_server():
		rpc("sync_player_states", player_states)
	
	# 6. Remove from pending list after a frame
	call_deferred("_remove_from_pending_removal", id)

func _remove_from_pending_removal(id: int):
	players_pending_removal.erase(id)

func _on_quit_pressed() -> void:
	get_tree().quit()

# ============ PLAYER STATES AND DISPLAY ============

func _update_active_players_display():
	var alive_count = 0
	for player_id in player_states:
		if player_states[player_id]["alive"]:
			alive_count += 1
	
	active_players_count = alive_count
	
	# Update the display label with names and status
	_update_active_player_label()
	
	# Sync with all clients if server
	if multiplayer.is_server():
		rpc("sync_active_players_count", active_players_count)

func _update_active_player_label():
	if active_player_label:
		var display_text = "Connected Players (" + str(active_players_count) + "):\n"
		
		for player_id in player_states:
			var player_data = player_states[player_id]
			var status_icon = "🟢" if player_data["alive"] else "🔴"
			display_text += status_icon + " " + player_data["nick"] + "\n"
		
		active_player_label.text = display_text
		active_player_label.show()

# RPC to sync player states across all clients
@rpc("any_peer", "call_local", "reliable")
func sync_player_states(states: Dictionary):
	# Only process states for players that aren't being removed
	var filtered_states = {}
	for player_id in states:
		if player_id not in players_pending_removal:
			filtered_states[player_id] = states[player_id]
	
	player_states = filtered_states
	_update_active_player_label()
	
	# Update visual nickname colors for all players
	for player_id in player_states:
		var player_node = spawn_player.get_node_or_null(str(player_id))
		if player_node and player_node.has_node("PlayerNick/Nickname") and is_instance_valid(player_node):
			var player_data = player_states[player_id]
			player_node.get_node("PlayerNick/Nickname").modulate = player_data["color"]

@rpc("any_peer", "call_local", "reliable")
func sync_active_players_count(count: int):
	active_players_count = count
	_update_active_player_label()

# ============ INPUT HANDLING ============

func _input(event):
	# Chat toggle
	if event.is_action_pressed("toggle_chat"):
		toggle_chat()

# ============ MULTIPLAYER CHAT ============

func toggle_chat():
	if menu.visible:
		return

	chat_visible = !chat_visible
	if chat_visible:
		multiplayer_chat.show()
	else:
		multiplayer_chat.hide()
		get_viewport().set_input_as_handled()

func is_chat_visible() -> bool:
	return chat_visible

func _on_server_disconnected():
	# Clear all player nodes safely
	for child in spawn_player.get_children():
		if is_instance_valid(child):
			child.queue_free()
	
	# Clear all minimaps
	_clear_all_minimaps()
	
	# Reset game state
	player_states.clear()
	stored_player_data.clear()
	players_pending_removal.clear()
	active_players_count = 0
	
	# Show menu for reconnection
	menu.show()
	active_player_label.hide()

func _create_minimap_for_player(player_id: int, player_node: Node3D):
	var minimap_scene = load("res://level/scenes/minimap.tscn")
	if not minimap_scene:
		return
	
	var minimap_instance = minimap_scene.instantiate()
	add_child(minimap_instance)
	minimap_instance.name = "Minimap_" + str(player_id)
	
	# Setup minimap with player reference
	if is_instance_valid(player_node):
		minimap_instance.setup_minimap(player_node)

func _destroy_minimap_for_player(player_id: int):
	"""Safely destroy minimap for any player"""
	var minimap_node = get_node_or_null("Minimap_" + str(player_id))
	if minimap_node and is_instance_valid(minimap_node):
		minimap_node.queue_free()
		print("Destroyed minimap for player ", player_id)

func _clear_all_minimaps():
	"""Clear all minimap nodes"""
	for child in get_children():
		if child.name.begins_with("Minimap_") and is_instance_valid(child):
			child.queue_free()

# Manual RPC call for player death (call this from champ.gd when player dies)
@rpc("any_peer", "call_local", "reliable")
func report_player_death(player_id: int):
	if multiplayer.is_server() and player_id not in players_pending_removal:
		on_player_died(player_id)

func on_player_died(player_id: int):
	if player_states.has(player_id) and player_id not in players_pending_removal:
		player_states[player_id]["alive"] = false
		player_states[player_id]["color"] = Color.RED
		
		# Update the actual player's nickname color
		var player_node = spawn_player.get_node_or_null(str(player_id))
		if player_node and player_node.has_node("PlayerNick/Nickname") and is_instance_valid(player_node):
			player_node.get_node("PlayerNick/Nickname").modulate = Color.RED
		
		# Update display
		_update_active_players_display()
		
		# Sync with all clients
		if multiplayer.is_server():
			rpc("sync_player_states", player_states)

# ============ PORTAL SCENE TRANSITION ============

func _on_portal_entered(body: Node, target_scene: String):
	if body.is_in_group("player") and body.name == str(multiplayer.get_unique_id()):
		print("Player entering portal to: ", target_scene)
		
		# Get the scene path from mapping
		var scene_path = portal_scenes.get(target_scene)
		if not scene_path:
			print("❌ No scene mapped for portal: ", target_scene)
			return
		
		# Clean up local player minimap before scene change
		_destroy_local_minimap()
		
		# Notify server to remove this player from spawn for all clients
		if multiplayer.is_server():
			# Server can remove directly
			_safe_remove_player(multiplayer.get_unique_id())
		else:
			# Client requests removal from server
			rpc_id(1, "request_player_removal", multiplayer.get_unique_id(), target_scene)
		
		# IMPORTANT: Disconnect from multiplayer temporarily to prevent sync errors
		_cleanup_multiplayer_before_scene_change()
		
		# Load the respective scene based on portal
		print("Loading scene: ", scene_path)
		get_tree().change_scene_to_file(scene_path)

func _cleanup_multiplayer_before_scene_change():
	"""Clean up multiplayer references before changing scenes to prevent sync errors"""
	var local_id = multiplayer.get_unique_id()
	
	# If we're the server, update the player states to remove ourselves
	if multiplayer.is_server():
		player_states.erase(local_id)
		# Sync the updated player states with remaining clients
		rpc("sync_player_states", player_states)
	
	# For all players (host and clients), disconnect from multiplayer
	# This prevents RPC sync errors when the scene changes
	if multiplayer.multiplayer_peer != null:
		multiplayer.multiplayer_peer.close()
		multiplayer.multiplayer_peer = null
	
	print("Multiplayer disconnected for scene transition - player ", local_id)

@rpc("any_peer", "call_local", "reliable")
func request_player_removal(player_id: int, target_scene: String = ""):
	"""Server receives request to remove a player who entered portal"""
	if multiplayer.is_server():
		var scene_info = " to " + target_scene if target_scene else ""
		print("Removing player ", player_id, " from spawn (entered portal", scene_info, ")")
		_safe_remove_player(player_id)

func _destroy_local_minimap():
	var local_id = multiplayer.get_unique_id()
	var minimap_node = get_node_or_null("Minimap_" + str(local_id))
	if minimap_node and is_instance_valid(minimap_node):
		minimap_node.queue_free()
		print("Destroyed local minimap for player ", local_id)
