extends Node3D

@onready var address_input: LineEdit = $Menu/MainContainer/MainMenu/Option3/AddressInput
@onready var players_container: Node3D = $PlayersContainer
@onready var menu: Control = $Menu
@onready var won: Label = $GameUI/Won
@onready var markers_container: Node3D = $Markers
@onready var main_menu: Control = $Menu/MainContainer/MainMenu

# Multiplayer chat
@onready var message: LineEdit = $MultiplayerChat/VBoxContainer/HBoxContainer/Message
@onready var send: Button = $MultiplayerChat/VBoxContainer/HBoxContainer/Send
@onready var chat: TextEdit = $MultiplayerChat/VBoxContainer/Chat
@onready var multiplayer_chat: Control = $MultiplayerChat

# Active players label
@onready var active_player_label: Label = $GameUI/Active
@onready var kill_feed_label: Label = $GameUI/KillFeedLabel
var kill_feed_messages: Array = []
var max_kill_messages: int = 5
var kill_message_lifetime: float = 5.0

var active_players_count: int = 0
var game_started: bool = false
var stored_player_data = {} 

#signals
signal zone_start
signal zone_reset
# Start button
@onready var start_button: Button = $GameUI/StartButton 
var chat_visible = false

# Track player states
var victory_in_progress: bool = false
var player_states = {}  # Format: {player_id: {"nick": "name", "alive": true, "color": Color.WHITE}}

func _ready():
	multiplayer_chat.hide()
	menu.show()
	active_player_label.hide()
	won.hide()
	start_button.hide()
	multiplayer_chat.set_process_input(true)
	Network.server_disconnected.connect(_on_server_disconnected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	if kill_feed_label:
		kill_feed_label.text = ""
		kill_feed_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		kill_feed_label.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	if multiplayer.is_server():
		Network.connect("player_connected", Callable(self, "_on_player_connected"))
		multiplayer.peer_disconnected.connect(_remove_player)

func report_kill(killer_id: int, victim_id: int, weapon_type: String = ""):
	if not multiplayer.is_server():
		return
	
	# Get player names
	var killer_nick = get_player_nickname(killer_id)
	var victim_nick = get_player_nickname(victim_id)
	
	print("Kill reported: ", killer_nick, " -> ", victim_nick, " with ", weapon_type)
	
	# Broadcast to all clients
	rpc("_sync_kill_message", killer_nick, victim_nick, weapon_type)
	
# RPC to sync kill message to all clients
@rpc("any_peer", "call_local", "reliable")
func _sync_kill_message(killer_nick: String, victim_nick: String, weapon_type: String):
	_add_kill_message(killer_nick, victim_nick, weapon_type)

func get_player_nickname(player_id: int) -> String:
	if player_states.has(player_id):
		return player_states[player_id].get("nick", "Player" + str(player_id))
	
	# Check stored data for waiting players
	if stored_player_data.has(player_id):
		return stored_player_data[player_id].get("nick", "Player" + str(player_id))
	
	return "Player" + str(player_id)
	
func _add_kill_message(killer_nick: String, victim_nick: String, weapon_type: String):
	if not kill_feed_label:
		return
	
	# Weapon icons
	var weapon_icons = {
		"gun": "🔫",
		"melee": "🗡️",
		"zone": "💥"
	}
	
	var weapon_icon = weapon_icons.get(weapon_type, "💀")
	var kill_message = ""
	
	if killer_nick == "" or weapon_type == "zone":
		# Zone death or self death
		kill_message = "{victim} {weapon}".format({
			"victim": victim_nick,
			"weapon": weapon_icon
		})
	else:
		# Player kill
		kill_message = "{killer} {weapon} {victim}".format({
			"killer": killer_nick,
			"weapon": weapon_icon,
			"victim": victim_nick
		})
	
	# Add to messages array
	kill_feed_messages.push_front(kill_message)
	
	# Limit the number of messages
	if kill_feed_messages.size() > max_kill_messages:
		kill_feed_messages.pop_back()
	
	# Update display
	_update_kill_feed_display()
	
	# Set timer to remove this message
	var timer = get_tree().create_timer(kill_message_lifetime)
	timer.timeout.connect(_remove_oldest_kill_message.bind(kill_message))

func _remove_oldest_kill_message(message_to_remove: String):
	if kill_feed_messages.has(message_to_remove):
		kill_feed_messages.erase(message_to_remove)
		_update_kill_feed_display()

func _update_kill_feed_display():
	if not kill_feed_label:
		return
		
	kill_feed_label.text = ""
	for i in range(kill_feed_messages.size()):
		kill_feed_label.text += kill_feed_messages[i]
		if i < kill_feed_messages.size() - 1:
			kill_feed_label.text += "\n"
# ============ MULTIPLAYER MODE FUNCTIONS ============

func _on_player_connected(peer_id, player_info):
	# If game is active, don't add player to game
	if game_started:
		print("Game in progress - player ", player_info.get("nick", "Player"), " must wait in lobby")
		# Store their info for next round
		stored_player_data[peer_id] = {
			"nick": player_info.get("nick", "Player"),
			"peer_id": peer_id,
			"waiting": true
		}
		rpc_id(peer_id, "_notify_waiting_for_round")
	else:
		_add_player(peer_id, player_info)

@rpc("any_peer", "call_local", "reliable")
func _notify_waiting_for_round():
	print("Waiting for current round to finish...")
	# You could show a UI message here later
	chat.text += "*** Waiting for current round to finish ***\n"

func _on_peer_disconnected(id):
	if multiplayer.is_server():
		_remove_player(id)
		
func _on_host_pressed():
	menu.hide()
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
	var player_name = "Player"
	if GameManager.is_logged_in and GameManager.current_player_data:
		player_name = GameManager.current_player_data.get("username", "Player")
	
	Network.join_game(player_name, "player", address_input.text.strip_edges())

func _add_player(id: int, player_info: Dictionary):
	if players_container.has_node(str(id)):
		return
	
	var character_scene = load("res://level/scenes/champ.tscn")
	if not character_scene:
		print("Error: Could not load character scene")
		return
	
	var player = character_scene.instantiate()
	player.name = str(id)
	players_container.add_child(player, true)
	
	player.global_position = get_spawn_point()
	
	if id == multiplayer.get_unique_id():
		_create_minimap_for_player(id, player)
	# Set nickname and track player state
	var nick = player_info.get("nick", "Player")
	player_states[id] = {"nick": nick, "alive": true, "color": Color.WHITE}
	
	if player.has_node("PlayerNick/Nickname"):
		player.get_node("PlayerNick/Nickname").text = nick
		player.get_node("PlayerNick/Nickname").modulate = Color.WHITE
	
	print("Added player: ", nick, " (ID: ", id, ")")
	
	# Enable god mode for this player only (they're in lobby)
	if player.has_method("set_god_mode"):
		player.set_god_mode(true)
		print("God mode enabled for new player: ", nick)
	
	# Update player display
	if multiplayer.is_server():
		_update_active_players_display()
		rpc("sync_player_states", player_states)
		
func get_spawn_point() -> Vector3:
	var base_position = players_container.global_position
	var random_angle = randf() * 2 * PI
	var random_radius = randf() * 1.0
	
	var offset = Vector3(
		cos(random_angle) * random_radius,
		0,
		sin(random_angle) * random_radius
	)
	
	return base_position + offset

func _remove_player(id):
	if not multiplayer.is_server():
		return
		
	# Remove from waiting list if present
	if stored_player_data.has(id) and stored_player_data[id].get("waiting", false):
		stored_player_data.erase(id)
		print("Removed waiting player: ", id)
		return
		
	var minimap_node = get_node_or_null("Minimap_" + str(id))
	if minimap_node:
		minimap_node.queue_free()
		print("Removed minimap for player: ", id)
	# Remove active player
	if players_container.has_node(str(id)):
		var player_node = players_container.get_node(str(id))
		if player_node:
			player_node.queue_free()
	
	# Remove from player states
	player_states.erase(id)
	
	# Remove from stored data
	stored_player_data.erase(id)
		
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
	
	# Update start button visibility based on player count
	_update_start_button_visibility()
	
	# Check for winner only if game is active and not already in victory
	if game_started and alive_count == 1 and not victory_in_progress:
		victory_in_progress = true
		_declare_winner()
	
	# Sync with all clients if server
	if multiplayer.is_server():
		rpc("sync_active_players_count", active_players_count)
		rpc("sync_player_states", player_states)

func _update_start_button_visibility():
	# Don't show button if game already started
	if game_started:
		if start_button.visible:
			_hide_button_for_all()
		return
		
	# Show button when 2+ players and game not started
	if active_players_count >= 2:
		if not start_button.visible:
			_show_button_for_all()
	else:
		if start_button.visible:
			_hide_button_for_all()

func _update_active_player_label():
	if active_player_label:
		var display_text = "Active Players (" + str(active_players_count) + "):\n"
		
		for player_id in player_states:
			var player_data = player_states[player_id]
			var status_icon = "🟢" if player_data["alive"] else "🔴"
			display_text += status_icon + " " + player_data["nick"] + "\n"
		
		active_player_label.text = display_text
		active_player_label.show()

func on_player_died(player_id: int):
	if player_states.has(player_id):
		player_states[player_id]["alive"] = false
		player_states[player_id]["color"] = Color.RED
		
		# Update the actual player's nickname color
		var player_node = players_container.get_node_or_null(str(player_id))
		if player_node and player_node.has_node("PlayerNick/Nickname"):
			player_node.get_node("PlayerNick/Nickname").modulate = Color.RED
		
		# Update display
		_update_active_players_display()
		
		# Sync with all clients
		if multiplayer.is_server():
			rpc("sync_player_states", player_states)

# RPC to sync player states across all clients
@rpc("any_peer", "call_local", "reliable")
func sync_player_states(states: Dictionary):
	player_states = states
	_update_active_player_label()
	
	# Update visual nickname colors for all players
	for player_id in player_states:
		var player_node = players_container.get_node_or_null(str(player_id))
		if player_node and player_node.has_node("PlayerNick/Nickname"):
			var player_data = player_states[player_id]
			player_node.get_node("PlayerNick/Nickname").modulate = player_data["color"]

@rpc("any_peer", "call_local", "reliable")
func sync_active_players_count(count: int):
	active_players_count = count
	_update_active_player_label()

# ============ START BUTTON FUNCTIONS ============
func _on_start_button_pressed():
	# Only server should handle game start logic
	if multiplayer.is_server():
		game_started = true
		_execute_game_start()
	else:
		# Non-server clients send request to server
		rpc_id(1, "_request_game_start")

@rpc("any_peer", "call_remote", "reliable")
func _request_game_start():
	# Only server processes this request
	if multiplayer.is_server():
		game_started = true
		_execute_game_start()

func _execute_game_start():
	if not multiplayer.is_server():
		return
	
	print("=== GAME STARTING ===")
	
	# Store current player data for respawn after round
	stored_player_data.clear()
	for player_id in player_states:
		stored_player_data[player_id] = {
			"nick": player_states[player_id]["nick"],
			"peer_id": player_id,
			"waiting": false
		}
	
	print("Stored player data: ", stored_player_data)
	
	# Hide button for everyone
	_hide_button_for_all()
	
	# Teleport all players to random markers
	teleport_all_players_to_random_markers()
	
	# Wait 2 seconds after teleport, then disable god mode
	await get_tree().create_timer(2.0).timeout
	disable_god_mode_all()
	
	zone_start.emit()
	
	print("God mode disabled - GAME ACTIVE!")

func _hide_button_for_all():
	start_button.hide()
	rpc("_receive_hide_button")

@rpc("any_peer", "call_local", "reliable")
func _receive_hide_button():
	start_button.hide()

func _show_button_for_all():
	start_button.show()
	rpc("_receive_show_button")

@rpc("any_peer", "call_local", "reliable")
func _receive_show_button():
	start_button.show()

# Manual RPC call for player death (call this from champ.gd when player dies)
@rpc("any_peer", "call_local", "reliable")
func report_player_death(player_id: int):
	if multiplayer.is_server():
		on_player_died(player_id)

# ============ INPUT HANDLING ============

func _input(event):
	# Chat toggle
	if event.is_action_pressed("toggle_chat"):
		toggle_chat()
	elif event is InputEventKey and event.keycode == KEY_ENTER:
		_on_send_pressed()

# ============ MULTIPLAYER CHAT ============

func toggle_chat():
	if menu.visible:
		return

	chat_visible = !chat_visible
	if chat_visible:
		multiplayer_chat.show()
		message.grab_focus()
	else:
		multiplayer_chat.hide()
		get_viewport().set_input_as_handled()

func is_chat_visible() -> bool:
	return chat_visible

func _on_send_pressed() -> void:
	var trimmed_message = message.text.strip_edges()
	if trimmed_message == "":
		return

	var nick = Network.players[multiplayer.get_unique_id()]["nick"]
	rpc("msg_rpc", nick, trimmed_message)
	message.text = ""
	message.grab_focus()

@rpc("any_peer", "call_local")
func msg_rpc(nick, msg):
	chat.text += str(nick, " : ", msg, "\n")

# ============ GOD MODE CONTROL ============

func enable_god_mode_all():
	if not multiplayer.is_server():
		rpc_id(1, "_request_enable_god_mode")
		return
	
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.has_method("set_god_mode"):
			player.set_god_mode(true)
	
	# Sync to all clients
	rpc("_receive_god_mode_change", true)
	print("God mode enabled for all players")

func disable_god_mode_all():
	if not multiplayer.is_server():
		rpc_id(1, "_request_disable_god_mode")
		return
	
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.has_method("set_god_mode"):
			player.set_god_mode(false)
	
	# Sync to all clients
	rpc("_receive_god_mode_change", false)
	print("God mode disabled for all players")

@rpc("any_peer", "call_remote", "reliable")
func _request_enable_god_mode():
	if multiplayer.is_server():
		enable_god_mode_all()

@rpc("any_peer", "call_remote", "reliable")
func _request_disable_god_mode():
	if multiplayer.is_server():
		disable_god_mode_all()

@rpc("any_peer", "call_local", "reliable")
func _receive_god_mode_change(enabled: bool):
	var players = get_tree().get_nodes_in_group("player")
	for player in players:
		if player.has_method("set_god_mode"):
			player.set_god_mode(enabled)
	print("God mode ", "enabled" if enabled else "disabled", " (synced)")

func _on_server_disconnected():
	print("Disconnected from server - returning to menu")
	
	# Clear all player nodes
	for child in players_container.get_children():
		child.queue_free()
	
	# Reset game state
	player_states.clear()
	stored_player_data.clear()
	game_started = false
	victory_in_progress = false
	active_players_count = 0
	
	# Show menu for reconnection
	menu.show()
	active_player_label.hide()
	start_button.hide()
	won.hide()
	
	# Optional: Show disconnect message
	chat.text += "*** Disconnected from server ***\n"
	
func teleport_all_players_to_random_markers():
	if not multiplayer.is_server():
		return
	
	if not markers_container:
		print("Error: Markers container not found")
		return
	
	# Collect all available marker positions
	var marker_positions = []
	for i in range(1, 9):  # M1 to M8
		var marker = markers_container.get_node_or_null("M" + str(i))
		if marker:
			marker_positions.append(marker.global_position)
			print("Found marker M", i, " at position: ", marker.global_position)
	
	if marker_positions.size() == 0:
		print("Error: No markers found in Markers container")
		return
	
	if marker_positions.size() < players_container.get_child_count():
		print("Warning: More players than markers! Some markers will be reused")
	
	# Shuffle marker positions to randomize
	marker_positions.shuffle()
	
	# Get all player nodes
	var players = players_container.get_children()
	
	# Assign each player to a unique marker
	for i in range(players.size()):
		var player = players[i]
		var marker_index = i % marker_positions.size()
		var target_position = marker_positions[marker_index]
		var player_id = int(player.name)
		
		# Teleport via RPC
		rpc("_teleport_player", player_id, target_position)

@rpc("any_peer", "call_local", "reliable")
func _teleport_player(player_id: int, target_position: Vector3):
	var player = players_container.get_node_or_null(str(player_id))
	if player:
		player.global_position = target_position
		print("Teleported player ", player_id, " to position: ", target_position)

# ============ WINNER & GAME CYCLE ============

func _declare_winner():
	if not multiplayer.is_server():
		return
	
	# Find the winning player ID
	var winner_id = -1
	var winner_nick = ""
	
	for player_id in player_states:
		if player_states[player_id]["alive"]:
			winner_id = player_id
			winner_nick = player_states[player_id]["nick"]
			break
	
	if winner_id == -1:
		print("No winner found - all dead?")
		victory_in_progress = false
		return
	
	print("=== WINNER DECLARED: ", winner_nick, " (ID: ", winner_id, ") ===")
	
	# Trigger victory for all clients
	rpc("_show_victory", winner_id, winner_nick)
	
	# Wait 5 seconds then restart cycle
	await get_tree().create_timer(5.0).timeout
	_restart_game_cycle()

@rpc("any_peer", "call_local", "reliable")
func _show_victory(winner_id: int, winner_nick: String):
	print("Showing victory for: ", winner_nick)
	
	# Show won label
	if won:
		won.text = winner_nick + " Wins!"
		won.show()
	
	# Find and trigger victory dance on winner
	var winner_player = players_container.get_node_or_null(str(winner_id))
	if winner_player and winner_player.has_method("play_victory_dance"):
		print("Triggering victory dance for ", winner_nick)
		winner_player.play_victory_dance()

func _restart_game_cycle():
	if not multiplayer.is_server():
		return
	
	print("=== RESTARTING GAME CYCLE ===")
	zone_reset.emit()
	# Hide victory screen for all
	rpc("_hide_victory_screen")
	_cleanup_all_minimaps()
	# Collect ALL players (game players + waiting players)
	var all_player_ids = []
	for player_id in stored_player_data:
		all_player_ids.append(player_id)
	
	print("Deleting ALL ", all_player_ids.size(), " players for fresh restart")
	
	# Delete ALL players on all clients
	rpc("_delete_game_players", all_player_ids)
	
	# Wait for cleanup
	await get_tree().create_timer(0.5).timeout
	
	# Reset game state
	player_states.clear()
	game_started = false
	victory_in_progress = false
	active_players_count = 0
	
	# Prepare to reinstantiate ALL players (previous game players + new joiners)
	var players_to_create = []
	for player_id in stored_player_data:
		# Mark all as no longer waiting - they're all in the next game
		stored_player_data[player_id]["waiting"] = false
		players_to_create.append({
			"id": player_id,
			"nick": stored_player_data[player_id]["nick"]
		})
	
	print("Reinstantiating ALL ", players_to_create.size(), " players (including new joiners)")
	
	# Recreate each player with fresh state
	for player_info in players_to_create:
		var player_data = {"nick": player_info["nick"]}
		_add_player_from_stored(player_info["id"], player_data)
		await get_tree().create_timer(0.1).timeout
	
	# Wait a moment for all to spawn
	await get_tree().create_timer(0.5).timeout
	
	# Update displays - now includes new joiners
	_update_active_players_display()
	
	# Enable god mode for ALL players (back in lobby)
	_enable_god_mode_for_all_players(all_player_ids)
	
	print("=== GAME CYCLE RESET - READY FOR NEW ROUND ===")
	print("Total players ready: ", players_to_create.size())
	rpc("_announce_new_round")

@rpc("any_peer", "call_local", "reliable")
func _hide_victory_screen():
	if won:
		won.hide()
	print("Victory screen hidden")

@rpc("any_peer", "call_local", "reliable")
func _delete_game_players(player_ids: Array):
	print("Deleting game players: ", player_ids)
	for player_id in player_ids:
		var player_node = players_container.get_node_or_null(str(player_id))
		if player_node:
			player_node.queue_free()
			print("Deleted player: ", player_id)

@rpc("any_peer", "call_local", "reliable")
func _announce_new_round():
	print("New round ready - waiting for start!")

func _enable_god_mode_for_all_players(player_ids: Array):
	"""Enable god mode for all players in the new cycle"""
	for player_id in player_ids:
		var player_node = players_container.get_node_or_null(str(player_id))
		if player_node and player_node.has_method("set_god_mode"):
			player_node.set_god_mode(true)
			print("God mode enabled for player: ", player_id)
	
	# Sync to all clients
	rpc("_receive_god_mode_for_players", player_ids)

func _add_player_from_stored(id: int, player_info: Dictionary):
	"""Create player from stored data during game cycle reset"""
	if players_container.has_node(str(id)):
		print("Player ", id, " already exists, skipping")
		return
	
	var character_scene = load("res://level/scenes/champ.tscn")
	if not character_scene:
		print("Error: Could not load character scene")
		return
	
	var player = character_scene.instantiate()
	player.name = str(id)
	players_container.add_child(player, true)
	
	# Spawn at lobby position
	player.global_position = get_spawn_point()
	
	# Set nickname and track player state
	var nick = player_info.get("nick", "Player")
	player_states[id] = {"nick": nick, "alive": true, "color": Color.WHITE}
	
	if player.has_node("PlayerNick/Nickname"):
		player.get_node("PlayerNick/Nickname").text = nick
		player.get_node("PlayerNick/Nickname").modulate = Color.WHITE
	
	print("Recreated player: ", nick, " (ID: ", id, ")")
	
	if id == multiplayer.get_unique_id():
		_create_minimap_for_player(id, player)
	# Sync to all clients
	if multiplayer.is_server():
		rpc("_sync_player_recreation", id, player_info)

@rpc("any_peer", "call_local", "reliable")
func _sync_player_recreation(id: int, player_info: Dictionary):
	if not multiplayer.is_server():
		# Clients recreate the player on their side
		_add_player_from_stored(id, player_info)

@rpc("any_peer", "call_local", "reliable")
func _receive_god_mode_for_players(player_ids: Array):
	"""Sync god mode for specific players on all clients"""
	for player_id in player_ids:
		var player_node = players_container.get_node_or_null(str(player_id))
		if player_node and player_node.has_method("set_god_mode"):
			player_node.set_god_mode(true)
	print("God mode synced for reinstantiated players")

func _create_minimap_for_player(player_id: int, player_node: Node3D):
	var minimap_scene = load("res://level/scenes/minimap.tscn")  # Your minimap scene path
	if not minimap_scene:
		print("Error: Could not load minimap scene")
		return
	
	var minimap_instance = minimap_scene.instantiate()
	# Add as sibling to players_container at the same level
	add_child(minimap_instance)  
	minimap_instance.name = "Minimap_" + str(player_id)
	
	# Setup minimap with player reference
	minimap_instance.setup_minimap(player_node)
	print("Created minimap for player: ", player_id)

func _cleanup_all_minimaps():
	"""Remove all existing minimaps before recreating players"""
	for child in get_children():
		if child.name.begins_with("Minimap_"):
			child.queue_free()
			print("Cleaned up minimap: ", child.name)
	
	# Sync to all clients
	rpc("_receive_cleanup_minimaps")

@rpc("any_peer", "call_local", "reliable")
func _receive_cleanup_minimaps():
	"""Clients clean up their minimaps too"""
	for child in get_children():
		if child.name.begins_with("Minimap_"):
			child.queue_free()
			print("Client cleaned up minimap: ", child.name)
