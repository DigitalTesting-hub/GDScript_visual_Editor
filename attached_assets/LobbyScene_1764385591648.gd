extends Control

@onready var player_name_label: Label = $PlayerInfo/PlayerName
@onready var character_info_label: Label = $PlayerInfo/ChInfo
@onready var logout_button: Button = $MenuButtons/Logout
@onready var spawn_point: Node3D = $Node3D/Spawn

var character_scenes = {
	"RedTop": "res://scenes/RedTop.tscn",
	"BlackOutfit": "res://scenes/BlackOutfit.tscn",
	"RedTShirt": "res://scenes/RedTShirt.tscn",
	"ScarfShades": "res://scenes/BlueTShirt.tscn"
}

var spawned_character: Node3D = null

func _ready():	
	# Display player info
	display_player_info()
	# Spawn character
	spawn_player_character()

func display_player_info():
	if GameManager.is_logged_in and GameManager.current_player_data:
		var player_data = GameManager.current_player_data
		player_name_label.text = "Welcome, " + player_data.get("username", "Player") + "!"
		character_info_label.text = "Character: " + player_data.get("character", "None")
		print("Lobby: Displaying player - ", player_data)
	else:
		player_name_label.text = "Not logged in"
		character_info_label.text = "Please log in"
		print("Lobby: No player data found")
		# Go back to character selection after delay
		await get_tree().create_timer(2.0).timeout
		get_tree().change_scene_to_file("res://scenes/CharacterSelection.tscn")

func spawn_player_character():
	if not GameManager.is_logged_in or not GameManager.current_player_data:
		print("Lobby: Cannot spawn character - no player data")
		return
	
	var character_name = GameManager.current_player_data.get("character", "RedTop")
	
	# Check if character scene exists
	if not character_scenes.has(character_name):
		print("Lobby: Character scene not found for: ", character_name)
		character_name = "RedTop"  # Fallback to default
	
	var scene_path = character_scenes[character_name]
	
	# Check if file exists
	if not FileAccess.file_exists(scene_path):
		print("Lobby: Character scene file does not exist: ", scene_path)
		return
	
	# Load and instance character scene
	var character_scene = load(scene_path)
	if character_scene:
		spawned_character = character_scene.instantiate()
		
		# Add to spawn point
		if spawn_point:
			spawn_point.add_child(spawned_character)
			
			# Position at spawn point (character will be at spawn point's position)
			spawned_character.global_position = spawn_point.global_position
			
			print("Lobby: Character spawned successfully: ", character_name)
		else:
			print("Lobby: Spawn point not found!")
			spawned_character.queue_free()
	else:
		print("Lobby: Failed to load character scene: ", scene_path)

# Button handlers
func _on_play_solo_pressed():
	get_tree().change_scene_to_file("res://scenes/city.tscn")
	print("Play Solo clicked")
	# Implement solo gameplay

func _on_play_multiplayer_pressed():
	get_tree().change_scene_to_file("res://scenes/spawn.tscn")
	print("Play Multiplayer clicked")
	# Implement multiplayer gameplay

func _on_settings_pressed():
	print("Settings clicked")
	# Open settings menu

func _on_stats_pressed():
	print("Stats clicked")
	# Show player stats

func _on_store_pressed():
	print("Store clicked")
	# Open in-game store

func _on_logout_pressed():
	print("Logging out...")
	
	# Remove spawned character
	if spawned_character:
		spawned_character.queue_free()
		spawned_character = null
	
	# This will clear everything including credentials
	GameManager.logout()
	get_tree().change_scene_to_file("res://scenes/CharacterSelection.tscn")

func _on_battle_royale_pressed() -> void:
	get_tree().change_scene_to_file("res://level/scenes/lobby.tscn")
	print("Joined Battle Royale")
