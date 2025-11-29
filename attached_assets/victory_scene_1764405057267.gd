extends Control

@onready var sketchfab_animation = $Sketchfab_Scene/AnimationPlayer
@onready var boyswim_animation = $BoySw/AnimationPlayer
@onready var sketchfab_scene = $Sketchfab_Scene
@onready var boyswim_scene = $BoySw
@onready var replay_button = $Control/Replay
@onready var exit_button = $Control/Exit

var boyswim_animations = ["Taunt", "SwAttack"]
var current_animation_index = 0

func _ready():
	replay_button.pressed.connect(_on_replay_pressed)
	exit_button.pressed.connect(_on_exit_pressed)
	
	start_animations()

func start_animations():
	if sketchfab_animation and sketchfab_animation.has_animation("Fire"):
		sketchfab_animation.play("Fire", -1, 1.0, false)
		print("Playing Fire animation in loop")
	else:
		print("Fire animation not found in Sketchfab model")
	
	if boyswim_animation:
		play_next_boyswim_animation()
		boyswim_animation.animation_finished.connect(_on_boyswim_animation_finished)

func play_next_boyswim_animation():
	if boyswim_animation and current_animation_index < boyswim_animations.size():
		var anim_name = boyswim_animations[current_animation_index]
		if boyswim_animation.has_animation(anim_name):
			boyswim_animation.play(anim_name)
			print("Playing BoySw animation: ", anim_name)
		else:
			print("Animation not found: ", anim_name)
			current_animation_index += 1
			play_next_boyswim_animation()

func _on_boyswim_animation_finished(anim_name):
	print("Animation finished: ", anim_name)
	
	current_animation_index += 1
	
	if current_animation_index >= boyswim_animations.size():
		current_animation_index = 0
		print("Looping BoySw animations")
	
	play_next_boyswim_animation()

func _on_replay_pressed():
	print("Replaying game...")
	var main_scene_path = "res://Scenes/main.tscn"
	
	if ResourceLoader.exists(main_scene_path):
		get_tree().change_scene_to_file(main_scene_path)
	else:
		print("Error: Could not find main scene at ", main_scene_path)

func _on_exit_pressed():
	print("Returning to main menu...")
	var main_menu_path = "res://Scenes/main_menu.tscn"
	
	if ResourceLoader.exists(main_menu_path):
		get_tree().change_scene_to_file(main_menu_path)
	else:
		print("Error: Could not find main menu at ", main_menu_path)
