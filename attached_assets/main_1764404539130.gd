extends Node

var checking_login: bool = false

func _ready():
	print("=== MAIN SCENE STARTED ===")
	
	# Start the login check process
	await check_and_handle_login()

func check_and_handle_login():
	checking_login = true
	print("Main: Starting login check...")
	
	# Step 1: Check for saved credentials
	var credentials = GameManager.get_saved_credentials()
	
	if credentials.is_empty():
		print("Main: No saved credentials found")
		checking_login = false
		load_character_selection()
		return
	
	var email = credentials.get("email", "")
	var password = credentials.get("password", "")
	
	if email.is_empty() or password.is_empty():
		print("Main: Invalid credentials, clearing...")
		GameManager.clear_login_credentials()
		checking_login = false
		load_character_selection()
		return
	
	# Step 2: Attempt login
	print("Main: Found credentials, attempting login for: ", email)
	
	# Connect to Supabase signal
	if not SupabaseClient.supabase_response.is_connected(_on_supabase_response):
		SupabaseClient.supabase_response.connect(_on_supabase_response)
	
	# Send login request
	var result = SupabaseClient.sign_in_with_email(email, password)
	
	if result != OK:
		print("Main: Login request failed")
		GameManager.clear_login_credentials()
		checking_login = false
		load_character_selection()
		return
	
	# Step 3: Wait for login response (max 5 seconds)
	print("Main: Waiting for login response...")
	await get_tree().create_timer(5.0).timeout
	
	# Step 4: Check if login succeeded
	if not checking_login:
		# Response was handled
		return
	else:
		# Timeout - no response
		print("Main: Login timeout")
		GameManager.clear_login_credentials()
		checking_login = false
		load_character_selection()

func _on_supabase_response(purpose: String, result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray):
	if not checking_login:
		return  # Not our concern
	
	var response_body = body.get_string_from_utf8()
	print("Main: Supabase response - Purpose: ", purpose, " Code: ", response_code)
	
	if purpose == "login":
		handle_login_response(response_code, response_body)
	elif purpose == "get_profile":
		handle_profile_response(response_code, response_body)

func handle_login_response(response_code: int, response_body: String):
	print("Main: Handling login response - Code: ", response_code)
	
	if response_code != 200:
		print("Main: Login failed with code: ", response_code)
		GameManager.clear_login_credentials()
		checking_login = false
		load_character_selection()
		return
	
	# Parse response
	var json = JSON.new()
	if json.parse(response_body) != OK:
		print("Main: Failed to parse login response")
		GameManager.clear_login_credentials()
		checking_login = false
		load_character_selection()
		return
	
	var response = json.get_data()
	
	if not response.has("access_token"):
		print("Main: No access token in response")
		GameManager.clear_login_credentials()
		checking_login = false
		load_character_selection()
		return
	
	print("Main: ✅ Login successful!")
	
	# Save auth data to SupabaseClient
	SupabaseClient.current_user = response
	
	# Get user info
	var user_id = response.get("user", {}).get("id", "")
	var email = response.get("user", {}).get("email", "")
	
	if user_id.is_empty():
		print("Main: No user_id in response")
		GameManager.clear_login_credentials()
		checking_login = false
		load_character_selection()
		return
	
	# Check if we have saved player data locally
	var saved_data = GameManager.read_from_file(GameManager.SAVE_FILE_PATH)
	
	if saved_data and saved_data is Dictionary and saved_data.has("username") and saved_data.has("character"):
		# We have complete local data
		print("Main: Found complete local player data")
		
		GameManager.current_player_data = {
			"user_id": user_id,
			"email": email,
			"username": saved_data["username"],
			"character": saved_data["character"],
			"supabase_session": SupabaseClient.current_user
		}
		GameManager.is_logged_in = true
		GameManager.save_player_data(GameManager.current_player_data)
		
		checking_login = false
		load_lobby()
		return
	
	# Need to fetch profile from Supabase
	print("Main: Fetching user profile from Supabase...")
	var profile_result = SupabaseClient.get_user_profile(user_id)
	
	if profile_result != OK:
		print("Main: Failed to request profile")
		checking_login = false
		load_character_selection()
		return
	
	# Wait for profile response
	await get_tree().create_timer(3.0).timeout
	
	# If still checking, it timed out
	if checking_login:
		print("Main: Profile fetch timeout")
		checking_login = false
		load_character_selection()

func handle_profile_response(response_code: int, response_body: String):
	print("Main: Handling profile response - Code: ", response_code)
	
	if response_code != 200:
		print("Main: Profile fetch failed with code: ", response_code)
		checking_login = false
		load_character_selection()
		return
	
	# Parse response
	var json = JSON.new()
	if json.parse(response_body) != OK:
		print("Main: Failed to parse profile response")
		checking_login = false
		load_character_selection()
		return
	
	var data = json.get_data()
	
	if not (data is Array) or data.size() == 0:
		print("Main: No profile found in database")
		checking_login = false
		load_character_selection()
		return
	
	var profile = data[0]
	print("Main: ✅ Profile fetched successfully")
	
	# Save complete player data
	var user_id = SupabaseClient.current_user.get("user", {}).get("id", "")
	var email = SupabaseClient.current_user.get("user", {}).get("email", "")
	
	GameManager.current_player_data = {
		"user_id": user_id,
		"email": email,
		"username": profile.get("username", profile.get("display_name", "Player")),
		"character": profile.get("selected_character", "RedTop"),
		"supabase_session": SupabaseClient.current_user
	}
	GameManager.is_logged_in = true
	GameManager.save_player_data(GameManager.current_player_data)
	
	checking_login = false
	load_lobby()

func load_character_selection():
	print("Main: Loading Character Selection scene")
	get_tree().change_scene_to_file("res://scenes/CharacterSelection.tscn")

func load_lobby():
	print("Main: Loading Lobby scene")
	get_tree().change_scene_to_file("res://scenes/LobbyScene.tscn")
