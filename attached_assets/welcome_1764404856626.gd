extends Control

@onready var progress_bar: ProgressBar = $ProgressBar

var timer: float = 0.0
var duration: float = 3.0

func _ready():
	progress_bar.value = 0

func _process(delta):
	timer += delta
	
	# Update progress bar (0 to 100 over 3 seconds)
	progress_bar.value = (timer / duration) * 100.0
	
	# When timer reaches 3 seconds, change scene
	if timer >= duration:
		get_tree().change_scene_to_file("res://level/scenes/game_mode.tscn")
