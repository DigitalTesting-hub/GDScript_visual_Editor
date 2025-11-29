# store.gd - Fixed node access timing
extends Node3D
const SceneUtils = preload("res://Scripts/scene_utils.gd")

# Don't use @onready for nodes that require get_parent() - initialize in _ready()
var main_scene
var game_manager

# UI Node references - these are direct children so @onready works
@onready var boy_button: Button = $UI/Boy
@onready var girl_button: Button = $UI/Girl
@onready var notify_label: Label = $UI/Notify
@onready var exit_button: Button = $UI/Exit
@onready var coins_label: Label = $UI/Coins

var notify_tween: Tween
const CHARACTER_COST = 5000

# Touch handling
var is_android: bool = false

func _ready():
	# Initialize parent references safely after the node is in the scene tree
	main_scene = get_parent()
	if main_scene and main_scene.has_node("GameManager"):
		game_manager = main_scene.get_node("GameManager")
	else:
		print("WARNING: Could not find GameManager in main scene")
		return
	
	is_android = OS.get_name() == "Android"
	SceneUtils.hide_all_scenes_except(main_scene, self)
	setup_ui()
	connect_signals()
	update_display()
	
	if is_android:
		setup_touch_handling()

func setup_touch_handling():
	# Enable touch on all buttons
	boy_button.focus_mode = Control.FOCUS_NONE
	girl_button.focus_mode = Control.FOCUS_NONE
	exit_button.focus_mode = Control.FOCUS_NONE
	print("Store touch handling enabled for Android")

func setup_ui():
	# Setup buttons
	boy_button.text = "Boy Character"
	girl_button.text = "Girl Character"
	exit_button.text = "Exit"
	
	# Setup notify label
	notify_label.text = ""
	notify_label.modulate = Color.WHITE

func connect_signals():
	# Connect button signals
	boy_button.pressed.connect(_on_boy_button_pressed)
	girl_button.pressed.connect(_on_girl_button_pressed)
	exit_button.pressed.connect(_on_exit_button_pressed)
	
	# Connect GameManager signals
	if game_manager:
		game_manager.data_updated.connect(_on_data_updated)
		game_manager.coins_changed.connect(_on_coins_changed)

func update_display():
	if not game_manager:
		print("Cannot update display - GameManager not available")
		return
		
	# Update coins display
	coins_label.text = "Coins: " + str(game_manager.get_total_coins())
	
	# Check current player gender and unlocked status
	var current_gender = game_manager.get_gender()
	var boy_unlocked = game_manager.is_character_unlocked("boy")
	var girl_unlocked = game_manager.is_character_unlocked("girl")
	
	# Update button states based on unlock status
	if boy_unlocked and girl_unlocked:
		# Both characters unlocked - buttons work as selection
		setup_character_selection_mode()
	else:
		# At least one character locked - buttons work as purchase
		setup_purchase_mode(current_gender, boy_unlocked, girl_unlocked)
	
	# Clear notification when updating display
	notify_label.text = ""

func setup_purchase_mode(current_gender: String, boy_unlocked: bool, girl_unlocked: bool):
	if current_gender == "boy":
		# Player is boy, can only buy girl
		boy_button.disabled = true
		boy_button.text = "Boy (Owned)"
		boy_button.modulate = Color.GREEN
		
		if girl_unlocked:
			girl_button.disabled = true
			girl_button.text = "Girl (Owned)"
			girl_button.modulate = Color.GREEN
		else:
			girl_button.disabled = false
			girl_button.text = "Girl (" + str(CHARACTER_COST) + " coins)"
			girl_button.modulate = Color.WHITE
	else:
		# Player is girl, can only buy boy
		girl_button.disabled = true
		girl_button.text = "Girl (Owned)"
		girl_button.modulate = Color.GREEN
		
		if boy_unlocked:
			boy_button.disabled = true
			boy_button.text = "Boy (Owned)"
			boy_button.modulate = Color.GREEN
		else:
			boy_button.disabled = false
			boy_button.text = "Boy (" + str(CHARACTER_COST) + " coins)"
			boy_button.modulate = Color.WHITE

func setup_character_selection_mode():
	if not game_manager:
		return
		
	# Both characters unlocked - now they work as selection buttons
	var current_character = game_manager.get_current_character()
	
	boy_button.disabled = false
	girl_button.disabled = false
	
	if current_character == "Sanjay":
		boy_button.text = "Boy (Active)"
		boy_button.modulate = Color.GREEN
		girl_button.text = "Girl (Select)"
		girl_button.modulate = Color.WHITE
	else:
		girl_button.text = "Girl (Active)"
		girl_button.modulate = Color.GREEN
		boy_button.text = "Boy (Select)"
		boy_button.modulate = Color.WHITE

func _on_boy_button_pressed():
	if not game_manager:
		return
		
	if game_manager.is_character_unlocked("boy") and game_manager.is_character_unlocked("girl"):
		# Selection mode - switch to boy character
		game_manager.set_active_character("boy")
		show_notification("Switched to Boy character!", Color.GREEN)
		update_display()
	else:
		# Purchase mode - try to buy boy character
		purchase_character("boy")

func _on_girl_button_pressed():
	if not game_manager:
		return
		
	if game_manager.is_character_unlocked("boy") and game_manager.is_character_unlocked("girl"):
		# Selection mode - switch to girl character
		game_manager.set_active_character("girl")
		show_notification("Switched to Girl character!", Color.GREEN)
		update_display()
	else:
		# Purchase mode - try to buy girl character
		purchase_character("girl")

func purchase_character(character_type: String):
	if not game_manager:
		return
		
	var result = game_manager.purchase_character(character_type)
	
	if result.success:
		show_notification(result.message, Color.GREEN)
		update_display()
		
		# Add some celebration effect
		animate_purchase_success()
	else:
		show_notification(result.message, Color.RED)

func show_notification(message: String, color: Color):
	if notify_tween:
		notify_tween.kill()
		notify_tween = null
	
	notify_label.text = message
	notify_label.modulate = color
	
	# Simple fade out without tween
	await get_tree().create_timer(3.0).timeout
	notify_label.text = ""

func animate_purchase_success():
	# Simple visual feedback without complex tween
	notify_label.modulate = Color.GOLD  # Use a special color for success
	await get_tree().create_timer(1.0).timeout
	notify_label.modulate = Color.GREEN  # Return to normal green

func _on_exit_button_pressed():
	if notify_tween:
		notify_tween.kill()
	
	if main_scene and main_scene.has_node("Lobby"):
		var lobby = main_scene.get_node("Lobby")
		SceneUtils.safe_show_scene(game_manager, lobby)
	else:
		print("WARNING: Could not find Lobby scene")

func _on_data_updated():
	update_display()

func _on_coins_changed(new_amount: int):
	coins_label.text = "Coins: " + str(new_amount)

# Add touch event handling
func _input(event):
	if is_android and event is InputEventScreenTouch:
		handle_touch_event(event)

func handle_touch_event(event: InputEventScreenTouch):
	if event.pressed:
		var touch_pos = event.position
		
		# Check if touch is on any button
		if boy_button.get_global_rect().has_point(touch_pos):
			_on_boy_button_pressed()
		elif girl_button.get_global_rect().has_point(touch_pos):
			_on_girl_button_pressed()
		elif exit_button.get_global_rect().has_point(touch_pos):
			_on_exit_button_pressed()

# Handle keyboard shortcuts
func _unhandled_input(event):
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_ESCAPE:
				_on_exit_button_pressed()
			KEY_1:
				_on_boy_button_pressed()
			KEY_2:
				_on_girl_button_pressed()
			KEY_C:
				# Debug: add coins for testing
				if game_manager:
					game_manager.add_coins(1000)
					show_notification("Added 1000 coins (debug)", Color.BLUE)
