# gamemode.gd
extends Control

@onready var solo_button: Button = $Solo
@onready var mp_button: Button = $MP

func _ready():
	solo_button.pressed.connect(_on_solo_pressed)
	mp_button.pressed.connect(_on_mp_pressed)

func _on_solo_pressed():
	GameManager.set_game_mode(GameManager.GameMode.SOLO)
	get_tree().change_scene_to_file("res://level/scenes/level.tscn")

func _on_mp_pressed():
	GameManager.set_game_mode(GameManager.GameMode.MULTIPLAYER)
	get_tree().change_scene_to_file("res://level/scenes/level.tscn")
	
func _on_pv_p_pressed() -> void:
	GameManager.set_game_mode(GameManager.GameMode.MULTIPLAYER)
	get_tree().change_scene_to_file("res://level/scenes/lobby.tscn")
