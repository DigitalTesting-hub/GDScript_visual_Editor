# stats.gd - Stats Scene (Updated for single scene)
extends Control
const SceneUtils = preload("res://Scripts/scene_utils.gd")
@onready var main_scene = get_parent()
@onready var game_manager = main_scene.get_node("GameManager")

# UI Node references
@onready var name_label: Label = $Name
@onready var coins_label: Label = $Coins
@onready var distance_label: Label = $Distance
@onready var best_dis_label: Label = $BestDis
@onready var ave_dis_label: Label = $AveDis
@onready var games_played_label: Label = $GamePlayed
@onready var exit_button: Button = $Exit

# Touch handling
var is_android: bool = false

func _ready():
	is_android = OS.get_name() == "Android"
	SceneUtils.hide_all_scenes_except(main_scene, self)
	setup_ui()
	connect_signals()
	load_stats()
	
	if is_android:
		setup_touch_handling()

func setup_touch_handling():
	# Enable touch on exit button
	if exit_button:
		exit_button.focus_mode = Control.FOCUS_NONE
	
	print("Stats touch handling enabled for Android")

func setup_ui():
	# Setup button
	exit_button.text = "Exit"
	
	# Initialize labels
	name_label.text = "Name: Loading..."
	coins_label.text = "Coins: 0"
	distance_label.text = "Distance: 0"
	best_dis_label.text = "Best Distance: 0"
	ave_dis_label.text = "Average Distance: 0"
	games_played_label.text = "Games Played: 0"

func connect_signals():
	# Connect button signal
	exit_button.pressed.connect(_on_exit_button_pressed)
	
	# Connect GameManager signals
	if game_manager:
		game_manager.data_updated.connect(_on_data_updated)

func load_stats():
	if game_manager:
		var stats = game_manager.get_stats()
		
		# Update all labels with current stats
		name_label.text = stats.name
		coins_label.text = str(stats.total_coins)
		distance_label.text = str(stats.total_distance) + "m"
		best_dis_label.text = str(stats.best_distance) + "m"
		ave_dis_label.text = str(stats.average_distance) + "m"
		games_played_label.text = str(stats.games_played)
		
		print("Stats loaded for: ", stats.name)

func _on_exit_button_pressed():
	var lobby = main_scene.get_node("Lobby")
	SceneUtils.safe_show_scene(game_manager, lobby)

func _on_data_updated():
	# Refresh stats when data updates
	load_stats()

# Add touch event handling for Android
func _input(event):
	if is_android and event is InputEventScreenTouch:
		handle_touch_event(event)

func handle_touch_event(event: InputEventScreenTouch):
	if event.pressed:
		var touch_pos = event.position
		
		# Check if touch is on exit button
		if exit_button and exit_button.get_global_rect().has_point(touch_pos):
			_on_exit_button_pressed()

# Handle keyboard shortcuts
func _unhandled_input(event):
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_ESCAPE:
				_on_exit_button_pressed()
			KEY_R:
				# Refresh stats
				load_stats()
				print("Stats refreshed")
