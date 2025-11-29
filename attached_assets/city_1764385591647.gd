extends Node3D

@onready var address_input: LineEdit = $Menu/IPInput
@onready var spawn_player: Node3D = $Spawn
@onready var menu: Control = $Menu
@onready var active_player_label: Label = $GameUI/Active
# Multiplayer chat
@onready var multiplayer_chat: Control = $MultiplayerChat

var active_players_count: int = 0
var stored_player_data = {}
var player_states = {}  # Format: {player_id: {"nick": "name", "alive": true, "color": Color.WHITE}}

# Character scenes (same as LobbyScene.gd)
var character_scenes = {
	"RedTop": "res://scenes/RedTop.tscn",
	"BlackOutfit": "res://scenes/BlackOutfit.tscn",
	"RedTShirt": "res://scenes/RedTShirt.tscn",
	"ScarfShades": "res://scenes/BlueTShirt.tscn"
}

var chat_visible = false

func _ready():
	multiplayer_chat.hide()
	menu.show()
	active_player_label.hide()
	multiplayer_chat.set_process_input(true)
	
	Network.server_disconnected.connect(_on_server_disconnected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	
	if multiplayer.is_server():
		Network.connect("player_connected", Callable(self, "_on_player_connected"))

# ============ MULTIPLAYER MODE FUNCTIONS ============

func _on_player_connected(peer_id, player_info):
	_add_player(peer_id, player_info)

func _on_peer_disconnected(id):
	if multiplayer.is_server():
		_remove_player(id)
		
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
	if spawn_player.has_node(str(id)):
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
	
	# ENABLE GOD MODE ONLY FOR THIS NEW PLAYER
	#if player.has_method("set_god_mode"):
		#player.set_god_mode(true)
		#print("God mode enabled for new player: ", nick)
	# Update player display
	if multiplayer.is_server():
		_update_active_players_display()
		rpc("sync_player_states", player_states)

func get_spawn_point() -> Vector3:
	var base_position = spawn_player.global_position
	var random_angle = randf() * 2 * PI
	var random_radius = randf() * 4.0  # Increased to 3 as requested
	
	var offset = Vector3(
		cos(random_angle) * random_radius,
		0,
		sin(random_angle) * random_radius
	)
	
	return base_position + offset

func _remove_player(id):
	if not multiplayer.is_server():
		return
		
	var minimap_node = get_node_or_null("Minimap_" + str(id))
	if minimap_node:
		minimap_node.queue_free()
			
	# Remove active player
	if spawn_player.has_node(str(id)):
		var player_node = spawn_player.get_node(str(id))
		
		if player_node:
			player_node.queue_free()
	
	# Remove from player states
	player_states.erase(id)
		
	# Update player display
	_update_active_players_display()
	
	# Sync with all clients
	if multiplayer.is_server():
		rpc("sync_player_states", player_states)

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
		rpc("sync_player_states", player_states)

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
	player_states = states
	_update_active_player_label()
	
	# Update visual nickname colors for all players
	for player_id in player_states:
		var player_node = spawn_player.get_node_or_null(str(player_id))
		if player_node and player_node.has_node("PlayerNick/Nickname"):
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
		# Focus will be handled by the separate chat scene
	else:
		multiplayer_chat.hide()
		get_viewport().set_input_as_handled()

func is_chat_visible() -> bool:
	return chat_visible

func _on_server_disconnected():
	
	# Clear all player nodes
	for child in spawn_player.get_children():
		child.queue_free()
	
	# Reset game state
	player_states.clear()
	stored_player_data.clear()
	active_players_count = 0
	
	# Show menu for reconnection
	menu.show()
	active_player_label.hide()


func _create_minimap_for_player(player_id: int, player_node: Node3D):
	var minimap_scene = load("res://scenes/topmap.tscn")
	if not minimap_scene:
		return
	
	var minimap_instance = minimap_scene.instantiate()
	add_child(minimap_instance)
	minimap_instance.name = "Minimap_" + str(player_id)
	
	# Setup minimap with player reference
	minimap_instance.setup_minimap(player_node)

# Manual RPC call for player death (call this from champ.gd when player dies)
@rpc("any_peer", "call_local", "reliable")
func report_player_death(player_id: int):
	if multiplayer.is_server():
		on_player_died(player_id)

func on_player_died(player_id: int):
	if player_states.has(player_id):
		player_states[player_id]["alive"] = false
		player_states[player_id]["color"] = Color.RED
		
		# Update the actual player's nickname color
		var player_node = spawn_player.get_node_or_null(str(player_id))
		if player_node and player_node.has_node("PlayerNick/Nickname"):
			player_node.get_node("PlayerNick/Nickname").modulate = Color.RED
		
		# Update display
		_update_active_players_display()
		
		# Sync with all clients
		if multiplayer.is_server():
			rpc("sync_player_states", player_states)
			
func _on_send_pressed() -> void:
	pass # Replace with function body.
