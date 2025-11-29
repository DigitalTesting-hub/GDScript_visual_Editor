extends Control

@onready var about_button = $Control/About
@onready var play_button = $Control/Play
@onready var exit_button = $Control/Exit
@onready var label = $Label
@onready var character_node = $BoySw

var is_label_visible = false
var is_dragging = false
var last_mouse_position = Vector2.ZERO
var rotation_sensitivity = 20.0

# Double-tap detection variables
var tap_count = 0
var last_tap_time = 0.0
var double_tap_threshold = 0.3  # Time window for double tap (in seconds)
var tap_distance_threshold = 50.0  # Maximum distance between taps (in pixels)
var first_tap_position = Vector2.ZERO

func _ready():
	# Connect button signals
	about_button.pressed.connect(_on_about_pressed)
	play_button.pressed.connect(_on_play_pressed)
	exit_button.pressed.connect(_on_exit_pressed)
	
	# Hide label initially
	label.visible = false
	is_label_visible = false
	
	# Play fire animation
	_play_fire_animation()

func _on_about_pressed():
	is_label_visible = !is_label_visible
	label.visible = is_label_visible

func _on_play_pressed():
	var main_scene_path = "res://Scenes/main.tscn"
	
	if ResourceLoader.exists(main_scene_path):
		get_tree().change_scene_to_file(main_scene_path)
	else:
		print("Error: Could not find main scene at ", main_scene_path)
		label.text = "Error: Main scene not found!"
		label.visible = true

func _on_exit_pressed():
	get_tree().quit()

func _input(event):
	# Handle double-tap detection for Android
	if event is InputEventScreenTouch and event.pressed:
		_handle_tap_detection(event.position)
	
	# Handle mouse double-click for testing (simulates double-tap)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		_handle_tap_detection(event.position)
	
	# Handle mouse/touch input for character rotation
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				is_dragging = true
				last_mouse_position = event.position
			else:
				is_dragging = false
	
	elif event is InputEventMouseMotion and is_dragging:
		_rotate_character_with_mouse(event)
	
	elif event is InputEventScreenTouch:
		if event.pressed:
			is_dragging = true
			last_mouse_position = event.position
		else:
			is_dragging = false
	
	elif event is InputEventScreenDrag and is_dragging:
		_rotate_character_with_touch(event)
	
	elif event is InputEventKey and event.pressed:
		if event.keycode == KEY_F:
			_play_attack_animation()
	
	# Hide label when clicking outside UI
	if event is InputEventMouseButton and event.pressed:
		if is_label_visible and not _is_mouse_over_ui(event.position):
			is_label_visible = false
			label.visible = false

func _handle_tap_detection(tap_position: Vector2):
	var current_timestamp = Time.get_ticks_msec() / 1000.0  # Convert milliseconds to seconds
	
	if tap_count == 0:
		# First tap
		tap_count = 1
		last_tap_time = current_timestamp
		first_tap_position = tap_position
		print("First tap detected")
	else:
		# Check if this is a valid second tap
		var time_diff = current_timestamp - last_tap_time
		var distance = tap_position.distance_to(first_tap_position)
		
		if time_diff <= double_tap_threshold and distance <= tap_distance_threshold:
			# Valid double tap detected
			print("Double tap detected - playing attack animation")
			_play_attack_animation()
			tap_count = 0  # Reset
		else:
			# Reset and start new tap sequence
			tap_count = 1
			last_tap_time = current_timestamp
			first_tap_position = tap_position
			print("Tap sequence reset")

func _is_mouse_over_ui(mouse_pos: Vector2) -> bool:
	var ui_rect = Rect2(Vector2.ZERO, size)
	return ui_rect.has_point(mouse_pos)

func _rotate_character_with_mouse(event: InputEventMouseMotion):
	if character_node == null:
		return
	
	var mouse_delta = event.position - last_mouse_position
	var rotation_amount = mouse_delta.x * rotation_sensitivity * get_process_delta_time()
	
	character_node.rotation.y -= deg_to_rad(rotation_amount)
	last_mouse_position = event.position

func _rotate_character_with_touch(event: InputEventScreenDrag):
	if character_node == null:
		return
	
	var touch_delta = event.position - last_mouse_position
	var rotation_amount = touch_delta.x * rotation_sensitivity * get_process_delta_time()
	
	character_node.rotation.y -= deg_to_rad(rotation_amount)
	last_mouse_position = event.position

func _play_attack_animation():
	if character_node == null:
		return
	
	var animation_player = character_node.get_node_or_null("AnimationPlayer")
	if animation_player == null:
		animation_player = character_node.find_child("AnimationPlayer", true, false)
	
	if animation_player != null:
		if animation_player.has_animation("SwAttack"):
			animation_player.play("SwAttack")
		else:
			print("SwAttack animation not found in AnimationPlayer")
	else:
		print("AnimationPlayer not found in character node")
		
func _play_fire_animation():
	var sketchfab_scene = $Sketchfab_Scene
	
	if sketchfab_scene == null:
		print("Sketchfab_Scene not found")
		return
	
	var animation_player = sketchfab_scene.get_node_or_null("AnimationPlayer")
	if animation_player == null:
		animation_player = sketchfab_scene.find_child("AnimationPlayer", true, false)
	
	if animation_player != null:
		if animation_player.has_animation("Fire"):
			animation_player.play("Fire")
		else:
			print("Animation 'Fire' not found")
	else:
		print("AnimationPlayer not found in Sketchfab_Scene")
