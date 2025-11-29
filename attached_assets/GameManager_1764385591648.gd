extends Node

var current_player_data: Dictionary = {}
var is_logged_in: bool = false
var temp_character_data: Dictionary = {}
var came_from_login: bool = false
var temp_email: String = ""

const SAVE_FILE_PATH = "user://player_data.json"
const CREDENTIALS_FILE_PATH = "user://login_credentials.json"

func _ready():
	ensure_user_directory()
	print("GameManager: Ready")

func ensure_user_directory():
	"""Ensure the user:// directory is accessible"""
	var dir = DirAccess.open("user://")
	if not dir:
		print("Warning: Could not access user:// directory")
		DirAccess.make_dir_absolute("user://")
	else:
		print("User directory accessible at: ", OS.get_user_data_dir())

func save_player_data(player_data: Dictionary):
	"""Save player data locally"""
	current_player_data = player_data
	is_logged_in = true
	
	# Add timestamp
	player_data["last_saved"] = Time.get_unix_time_from_system()
	
	if write_to_file(SAVE_FILE_PATH, player_data):
		print("✅ Player data saved successfully")
	else:
		print("❌ Failed to save player data")

func save_login_credentials(email: String, password: String):
	"""Save login credentials for auto-login"""
	var credentials = {
		"email": email,
		"password": password,
		"saved_at": Time.get_unix_time_from_system()
	}
	
	if write_to_file(CREDENTIALS_FILE_PATH, credentials):
		print("✅ Login credentials saved for auto-login")
	else:
		print("❌ Failed to save login credentials")

func get_saved_credentials() -> Dictionary:
	"""Get saved login credentials"""
	var credentials = read_from_file(CREDENTIALS_FILE_PATH)
	if credentials and credentials is Dictionary:
		print("Found saved credentials for: ", credentials.get("email", "unknown"))
		return credentials
	print("No saved credentials found")
	return {}

func clear_login_credentials():
	"""Clear saved login credentials"""
	var dir = DirAccess.open("user://")
	if dir and dir.file_exists(CREDENTIALS_FILE_PATH):
		dir.remove(CREDENTIALS_FILE_PATH)
		print("Login credentials cleared")

func write_to_file(file_path: String, data: Dictionary) -> bool:
	"""Write data to file with error handling"""
	var file = FileAccess.open(file_path, FileAccess.WRITE)
	if file:
		var json_string = JSON.stringify(data, "\t")
		file.store_string(json_string)
		file.close()
		
		if FileAccess.file_exists(file_path):
			return true
	
	var error = FileAccess.get_open_error()
	print("Failed to write file: ", file_path, " Error: ", error)
	return false

func read_from_file(file_path: String) -> Variant:
	"""Read data from file with error handling"""
	if not FileAccess.file_exists(file_path):
		return null
	
	var file = FileAccess.open(file_path, FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		
		if json_string.is_empty():
			return null
		
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		
		if parse_result == OK:
			return json.get_data()
		else:
			print("JSON parse error: ", json.get_error_message())
	
	return null

func logout():
	"""Full logout - clear everything"""
	SupabaseClient.sign_out()
	
	current_player_data = {}
	is_logged_in = false
	SupabaseClient.current_user = {}
	
	# Clear all saved files
	var dir = DirAccess.open("user://")
	if dir:
		if dir.file_exists(SAVE_FILE_PATH):
			dir.remove(SAVE_FILE_PATH)
		if dir.file_exists(CREDENTIALS_FILE_PATH):
			dir.remove(CREDENTIALS_FILE_PATH)
	
	temp_character_data = {}
	came_from_login = false
	temp_email = ""
	print("User logged out completely")

# Temp character data functions
func set_temp_character_data(username: String, character: String):
	temp_character_data = {
		"username": username,
		"character": character
	}
	print("Temp character data set: ", temp_character_data)

func get_temp_character_data() -> Dictionary:
	return temp_character_data

func clear_temp_character_data():
	temp_character_data = {}

func set_came_from_login(value: bool):
	came_from_login = value

func get_came_from_login() -> bool:
	return came_from_login

func set_temp_email(email: String):
	temp_email = email

func get_temp_email() -> String:
	return temp_email

func clear_temp_email():
	temp_email = ""
