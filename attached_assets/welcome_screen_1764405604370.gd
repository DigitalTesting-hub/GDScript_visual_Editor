# welcome_screen.gd - Updated for automatic player loading and improved flow
extends Control

@onready var loading_bar: ProgressBar = $LoadingBar
@onready var loading_label: Label = $LoadingPercent
@onready var main_scene = get_parent()
@onready var game_manager = main_scene.get_node("GameManager")
const SceneUtils = preload("res://Scripts/scene_utils.gd")

var load_progress: float = 0.0
const LOAD_SPEED := 60.0  # Faster loading for better UX
var is_loading: bool = false

func _ready():
	print("Welcome screen ready")
	
	# Initialize UI
	if loading_bar:
		loading_bar.value = 0
	if loading_label:
		loading_label.text = "0%"
	
	# Start loading automatically
	start_loading()

func start_loading():
	if is_loading:
		return
		
	print("Welcome screen starting loading")
	is_loading = true
	load_progress = 0.0
	set_process(true)

func _process(delta: float):
	if not is_loading:
		return
	
	load_progress += delta * LOAD_SPEED
	load_progress = min(load_progress, 100.0)
	
	if loading_bar:
		loading_bar.value = load_progress
	if loading_label:
		loading_label.text = str(int(load_progress)) + "%"
	
	if load_progress >= 100.0:
		complete_loading()

func complete_loading():
	print("Welcome screen loading complete")
	is_loading = false
	set_process(false)
	
	await get_tree().create_timer(0.2).timeout
	
	# Check if there are any existing player profiles
	var existing_profiles = game_manager.get_all_player_profiles()
	
	if existing_profiles.size() > 0:
		print("Found ", existing_profiles.size(), " existing player profiles")
		
		# Try to auto-load the most recent player
		var auto_load_success = game_manager.auto_load_last_player()
		
		if auto_load_success:
			print("Successfully auto-loaded last player, going to lobby")
			# Wait a moment to show completion
			await get_tree().create_timer(0.3).timeout
			show_lobby()
		else:
			print("Auto-load failed, showing new player screen")
			show_new_player_screen()
	else:
		print("No existing players found, showing character creation")
		# Wait a moment to show completion
		await get_tree().create_timer(0.3).timeout
		show_new_player_screen()

func show_lobby():
	"""Show the lobby/main game screen"""
	var lobby = main_scene.get_node("Lobby")
	if lobby:
		SceneUtils.safe_show_scene(game_manager, lobby)
		print("Navigated to lobby with loaded player: ", game_manager.get_player_name())
	else:
		print("ERROR: Lobby scene not found, falling back to new player screen")
		show_new_player_screen()

func show_new_player_screen():
	"""Show the new player creation screen"""
	var new_player = main_scene.get_node("New")
	if new_player:
		SceneUtils.safe_show_scene(game_manager, new_player)
		print("Navigated to new player creation screen")
	else:
		print("ERROR: New player scene not found")

# Debug function for testing
func _unhandled_input(event):
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_F1:
				# Force show new player screen
				print("Debug: Forcing new player screen")
				show_new_player_screen()
			KEY_F2:
				# Show debug info about existing players
				print("=== DEBUG: EXISTING PLAYER PROFILES ===")
				var profiles = game_manager.get_all_player_profiles()
				for profile in profiles:
					print("Name: ", profile.name, " Character: ", profile.character, " File: ", profile.file)
				print("======================================")
			KEY_F3:
				# Force clear all data and restart
				print("Debug: Clearing all player data")
				game_manager.clear_all_player_data()
				get_tree().reload_current_scene()
