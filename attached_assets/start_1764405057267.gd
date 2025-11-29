extends Control

@onready var loading_bar = $LoadingBar
@onready var loading_percent = $LoadingPercent

var loading_duration = 4.0
var current_time = 0.0
var is_loading = true

func _ready():
	print("Loading screen started")
	if loading_bar:
		loading_bar.value = 0
	
	if loading_percent:
		loading_percent.text = "0%"
	
	start_loading()

func start_loading():
	is_loading = true
	current_time = 0.0

func _process(delta):
	if not is_loading:
		return
	
	current_time += delta
	var progress = min(current_time / loading_duration, 1.0)
	
	if loading_bar:
		loading_bar.value = progress * 100
	
	if loading_percent:
		var percentage = int(progress * 100)
		loading_percent.text = str(percentage) + "%"
	
	if progress >= 1.0:
		loading_complete()

func loading_complete():
	is_loading = false
	print("Loading complete! Transitioning to main menu...")
	
	await get_tree().create_timer(0.5).timeout
	
	var main_menu_scene = "res://Scenes/main_menu.tscn"
	
	if ResourceLoader.exists(main_menu_scene):
		get_tree().change_scene_to_file(main_menu_scene)
	else:
		print("ERROR: Main menu scene not found at: ", main_menu_scene)
