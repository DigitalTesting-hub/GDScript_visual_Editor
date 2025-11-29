# settings.gd - Updated without clear data functionality
extends Control
const SceneUtils = preload("res://Scripts/scene_utils.gd")
@onready var main_scene = get_parent()
@onready var game_manager = main_scene.get_node("GameManager")

# UI Node references
@onready var volume_slider: HSlider = $VBoxContainer/Volume
@onready var volume_label: Label = $Volume
@onready var sensitivity_slider: HSlider = $VBoxContainer2/Sensitivity
@onready var sensitivity_label: Label = $Sensitivity
@onready var exit_button: Button = $Exit

# Touch handling
var is_android: bool = false
var slider_touch_active: bool = false

func _ready():
	is_android = OS.get_name() == "Android"
	SceneUtils.hide_all_scenes_except(main_scene, self)
	setup_ui()
	connect_signals()
	load_settings()
	
	if is_android:
		setup_touch_handling()
	
	print("Settings scene loaded")

func setup_touch_handling():
	# Enable touch on buttons
	exit_button.focus_mode = Control.FOCUS_NONE
	
	# Make sliders more touch-friendly
	volume_slider.focus_mode = Control.FOCUS_NONE
	sensitivity_slider.focus_mode = Control.FOCUS_NONE
	
	print("Settings touch handling enabled for Android")

func setup_ui():
	# Setup volume slider
	volume_slider.min_value = 0
	volume_slider.max_value = 100
	volume_slider.step = 5
	
	# Setup sensitivity slider
	sensitivity_slider.min_value = 3.0
	sensitivity_slider.max_value = 5.0
	sensitivity_slider.step = 1
	
	# Setup buttons
	exit_button.text = "Exit"

func connect_signals():
	# Connect slider signals
	volume_slider.value_changed.connect(_on_volume_changed)
	sensitivity_slider.value_changed.connect(_on_sensitivity_changed)
	
	# Connect button signals
	exit_button.pressed.connect(_on_exit_button_pressed)
	
	# Connect GameManager signals
	if game_manager:
		game_manager.data_updated.connect(_on_data_updated)

func load_settings():
	if game_manager:
		# Load current settings from GameManager
		var current_volume = game_manager.get_volume()
		var current_sensitivity = game_manager.get_gyro_sensitivity()
		
		# Update sliders without triggering signals
		volume_slider.set_value_no_signal(current_volume)
		sensitivity_slider.set_value_no_signal(current_sensitivity)
		
		# Update labels
		update_volume_label(current_volume)
		update_sensitivity_label(current_sensitivity)
		
		print("Settings loaded - Volume: ", current_volume, ", Sensitivity: ", current_sensitivity)

func update_volume_label(value: int):
	volume_label.text = str(value)

func update_sensitivity_label(value: float):
	sensitivity_label.text = str(value)

func _on_volume_changed(value: float):
	var volume_int = int(value)
	game_manager.update_volume(volume_int)
	update_volume_label(volume_int)
	print("Volume changed to: ", volume_int)

func _on_sensitivity_changed(value: float):
	game_manager.update_gyro_sensitivity(value)
	update_sensitivity_label(value)
	print("Sensitivity changed to: ", value)

func _on_exit_button_pressed():
	var lobby = main_scene.get_node("Lobby")
	SceneUtils.safe_show_scene(game_manager, lobby)

func _on_data_updated():
	# Reload settings if data was updated
	load_settings()

# Add touch event handling for sliders
func _input(event):
	if is_android:
		if event is InputEventScreenTouch:
			handle_touch_event(event)
		elif event is InputEventScreenDrag and slider_touch_active:
			handle_slider_drag(event)

func handle_touch_event(event: InputEventScreenTouch):
	var touch_pos = event.position
	
	if event.pressed:
		# Check if touch is on sliders
		if volume_slider.get_global_rect().has_point(touch_pos):
			slider_touch_active = true
			update_slider_from_touch(volume_slider, touch_pos)
		elif sensitivity_slider.get_global_rect().has_point(touch_pos):
			slider_touch_active = true
			update_slider_from_touch(sensitivity_slider, touch_pos)
		elif exit_button.get_global_rect().has_point(touch_pos):
			_on_exit_button_pressed()
	else:
		slider_touch_active = false

func handle_slider_drag(event: InputEventScreenDrag):
	if slider_touch_active:
		var touch_pos = event.position
		if volume_slider.get_global_rect().has_point(touch_pos):
			update_slider_from_touch(volume_slider, touch_pos)
		elif sensitivity_slider.get_global_rect().has_point(touch_pos):
			update_slider_from_touch(sensitivity_slider, touch_pos)

func update_slider_from_touch(slider: HSlider, touch_pos: Vector2):
	var slider_rect = slider.get_global_rect()
	var relative_x = (touch_pos.x - slider_rect.position.x) / slider_rect.size.x
	var value = slider.min_value + relative_x * (slider.max_value - slider.min_value)
	
	slider.value = clamp(value, slider.min_value, slider.max_value)
	
	# Trigger the value changed signal manually
	if slider == volume_slider:
		_on_volume_changed(slider.value)
	elif slider == sensitivity_slider:
		_on_sensitivity_changed(slider.value)
