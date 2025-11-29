extends Control

@onready var name_input: LineEdit = $NameInput
@onready var next_button: Button = $NextButton
@onready var error_label: Label = $ErrorLabel
@onready var login_button: Button = $LoginButton

# Character buttons
@onready var redtop_button: Button = $CharacterGrid/RedTop
@onready var blackoutfit_button: Button = $CharacterGrid/BlackOutfit
@onready var redtshirt_button: Button = $CharacterGrid/RedTShirt
@onready var blutshirt_button: Button = $CharacterGrid/BlueTShirt

var selected_character: String = ""
var character_buttons: Array = []

func _ready():
	# Connect main buttons
	next_button.pressed.connect(_on_next_pressed)
	login_button.pressed.connect(_on_login_pressed)
	name_input.text_changed.connect(_on_name_changed)
	
	# Setup character buttons array
	character_buttons = [redtop_button, blackoutfit_button, redtshirt_button, blutshirt_button]
	
	# Connect character selection buttons
	redtop_button.pressed.connect(_on_character_selected.bind("RedTop"))
	blackoutfit_button.pressed.connect(_on_character_selected.bind("BlackOutfit"))
	redtshirt_button.pressed.connect(_on_character_selected.bind("RedTShirt"))
	blutshirt_button.pressed.connect(_on_character_selected.bind("ScarfShades"))
	
	# Initial validation
	validate_input()

func _on_character_selected(character: String):
	selected_character = character
	print("Selected character: ", character)
	
	# Visual feedback - highlight selected button
	for btn in character_buttons:
		if btn:
			# Reset all buttons
			btn.modulate = Color.WHITE
	
	# Highlight selected button
	match character:
		"RedTop":
			redtop_button.modulate = Color(0.5, 1.0, 0.5)
		"BlackOutfit":
			blackoutfit_button.modulate = Color(0.5, 1.0, 0.5)
		"RedTShirt":
			redtshirt_button.modulate = Color(0.5, 1.0, 0.5)
		"ScarfShades":
			blutshirt_button.modulate = Color(0.5, 1.0, 0.5)
	
	validate_input()

func _on_name_changed(new_text: String):
	validate_input()

func validate_input():
	var username = name_input.text.strip_edges()
	var has_username = username.length() >= 3 && username.length() <= 20
	var has_character = not selected_character.is_empty()
	
	next_button.disabled = not (has_username and has_character)
	
	if username.length() > 0 && username.length() < 3:
		error_label.text = "Username must be at least 3 characters"
	elif username.length() > 20:
		error_label.text = "Username must be less than 20 characters"
	elif has_username and not has_character:
		error_label.text = "Please select a character"
	else:
		error_label.text = ""

func _on_next_pressed():
	var username = name_input.text.strip_edges()
	
	if selected_character.is_empty():
		error_label.text = "Please select a character"
		return
	
	# Save character selection and username temporarily
	GameManager.set_temp_character_data(username, selected_character)
	
	# Go to auth scene for registration
	GameManager.set_came_from_login(false)
	get_tree().change_scene_to_file("res://scenes/AuthScene.tscn")

func _on_login_pressed():
	# Set flag to indicate coming from login button
	GameManager.set_came_from_login(true)
	# Go directly to auth scene for login
	get_tree().change_scene_to_file("res://scenes/AuthScene.tscn")

func _on_google_login_pressed():
	# Set flag for Google login
	GameManager.set_came_from_login(true)
	# Open Google OAuth in browser
	var oauth_url = SupabaseClient.get_google_oauth_url()
	OS.shell_open(oauth_url)
	
	print("Google OAuth URL opened. Implement callback handler.")
