extends Control

@onready var subviewport = $SubViewportContainer/SubViewport
@onready var restart_button = $Restart
@onready var exit_button = $Exit

func _ready():
	restart_button.pressed.connect(_on_restart_pressed)
	exit_button.pressed.connect(_on_exit_pressed)
	
	# Sync subviewport
	call_deferred("sync_subviewport")

func sync_subviewport():
	if subviewport:
		# Set subviewport to base size using Vector2i
		subviewport.size = Vector2i(1280, 720)
		subviewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

func _process(_delta):
	# Only sync if needed to avoid performance issues
	# Compare Vector2i with Vector2i
	if subviewport and subviewport.size != Vector2i(1280, 720):
		sync_subviewport()

func _on_restart_pressed():
	print("Restarting game...")
	get_tree().change_scene_to_file("res://Scenes/main.tscn")

func _on_exit_pressed():
	print("Returning to main menu...")
	get_tree().change_scene_to_file("res://Scenes/main_menu.tscn")
