extends Control

# UI Elements
@onready var email_input: LineEdit = $VBoxContainer/EmailInput
@onready var password_input: LineEdit = $VBoxContainer/PasswordInput
@onready var login_button: Button = $VBoxContainer/VBoxContainer/LoginButton
@onready var register_button: Button = $VBoxContainer/VBoxContainer/RegisterButton
@onready var forgot_button: Button = $VBoxContainer/VBoxContainer/ForgotButton
@onready var message_label: Label = $VBoxContainer/MessageLabel
@onready var auth_tabs: TabContainer = $VBoxContainer/TabContainer
@onready var back_button: Button = $BackButton
@onready var register_popup: Control = $RegisterPopup

var is_login_only: bool = false

func _ready():
	# Check if user came from login button
	is_login_only = GameManager.get_came_from_login()
	
	print("AuthScene: Ready - is_login_only: ", is_login_only)
	
	# Connect button signals
	login_button.pressed.connect(_on_LoginButton_pressed)
	register_button.pressed.connect(_on_RegisterButton_pressed)
	forgot_button.pressed.connect(_on_ForgotButton_pressed)
	back_button.pressed.connect(_on_BackButton_pressed)
	
	# Connect to Supabase response signal
	if not SupabaseClient.supabase_response.is_connected(_on_supabase_response):
		SupabaseClient.supabase_response.connect(_on_supabase_response)
	
	# Connect tab changed signal
	auth_tabs.tab_changed.connect(_on_tab_changed)
	
	# Show appropriate UI based on navigation source
	if is_login_only:
		# Show only login tab, hide register option
		auth_tabs.current_tab = 0
		register_button.visible = false
		forgot_button.visible = true
		back_button.visible = true
	else:
		# Show full auth interface
		_on_tab_changed(0)
	
	print("AuthScene: All signals connected")

func _on_tab_changed(tab: int):
	if is_login_only:
		# Force login tab if coming from login button
		auth_tabs.current_tab = 0
		return
	
	print("AuthScene: Tab changed to ", tab)
	
	# Show appropriate buttons
	login_button.visible = (tab == 0)
	register_button.visible = (tab == 1)
	forgot_button.visible = (tab == 0)
	back_button.visible = false
	
	# Clear inputs when switching tabs
	email_input.text = ""
	password_input.text = ""
	message_label.text = ""

func _on_BackButton_pressed():
	print("AuthScene: Back button pressed")
	# Go back to character selection
	GameManager.set_came_from_login(false)
	get_tree().change_scene_to_file("res://scenes/CharacterSelection.tscn")

func _on_LoginButton_pressed():
	print("AuthScene: Login button pressed")
	var email = email_input.text.strip_edges()
	var password = password_input.text
	
	if email.is_empty() or password.is_empty():
		show_message("Please fill all fields", Color.RED)
		return
	
	if not is_valid_email(email):
		show_message("Please enter a valid email address", Color.RED)
		return
	
	show_message("Logging in...", Color.YELLOW)
	
	var result = SupabaseClient.sign_in_with_email(email, password)
	print("AuthScene: Login request result: ", result)

func _on_RegisterButton_pressed():
	print("AuthScene: Register button pressed")
	# Check if user has character data
	if GameManager.temp_character_data.is_empty():
		show_register_popup()
		return
	
	var email = email_input.text.strip_edges()
	var password = password_input.text
	
	if email.is_empty() or password.is_empty():
		show_message("Please fill all fields", Color.RED)
		return
	
	if password.length() < 6:
		show_message("Password must be at least 6 characters", Color.RED)
		return
	
	if not is_valid_email(email):
		show_message("Please enter a valid email address", Color.RED)
		return
	
	show_message("Creating account...", Color.YELLOW)
	var result = SupabaseClient.sign_up_no_confirm(email, password)
	print("AuthScene: Register request result: ", result)

func _on_ForgotButton_pressed():
	print("AuthScene: Forgot password button pressed")
	# Go to password reset scene
	get_tree().change_scene_to_file("res://scenes/PasswordResetScene.tscn")

func show_register_popup():
	print("AuthScene: Showing register popup")
	register_popup.visible = true

func _on_popup_confirm_pressed():
	print("AuthScene: Popup confirm pressed")
	register_popup.visible = false
	get_tree().change_scene_to_file("res://scenes/CharacterSelection.tscn")

func show_message(text: String, color: Color = Color.WHITE):
	print("AuthScene: Message: ", text)
	message_label.text = text
	message_label.modulate = color

func is_valid_email(email: String) -> bool:
	var email_regex = RegEx.new()
	email_regex.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
	return email_regex.search(email) != null

func _on_supabase_response(purpose: String, result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray):
	print("AuthScene: Supabase response - Purpose: ", purpose, " Result: ", result, " Code: ", response_code)
	
	var response_body = body.get_string_from_utf8()
	
	match purpose:
		"login":
			handle_login_response(response_code, response_body)
		"signup":
			handle_signup_response(response_code, response_body)
		"get_profile":
			handle_profile_check(response_code, response_body)
		"create_profile":
			handle_profile_creation(response_code, response_body)

func handle_login_response(response_code: int, response_body: String):
	print("AuthScene: Handling login response - Code: ", response_code)
	
	if response_code == 200:
		var json = JSON.new()
		if json.parse(response_body) == OK:
			var response = json.get_data()
			
			if response.has("access_token"):
				show_message("Success! Logged in.", Color.GREEN)
				
				# Save auth data
				SupabaseClient.current_user = response
				
				# Get user info
				var user_id = response["user"]["id"] if response.has("user") else ""
				var email = response["user"]["email"] if response.has("user") else ""
				
				if user_id.is_empty():
					show_message("Login failed: Invalid user data", Color.RED)
					return
				
				# ✅ Save credentials ONLY AFTER successful login
				var password = password_input.text
				if not email.is_empty() and not password.is_empty():
					GameManager.save_login_credentials(email, password)
				
				# Fetch profile
				show_message("Loading profile...", Color.YELLOW)
				call_deferred("fetch_user_profile", user_id)
				return
			else:
				show_message("Login failed: No access token", Color.RED)
		else:
			show_message("Login failed: Invalid response", Color.RED)
	else:
		handle_error_response(response_body, response_code)

func fetch_user_profile(user_id: String):
	print("AuthScene: Fetching user profile for: ", user_id)
	var profile_result = await SupabaseClient.get_user_profile(user_id)
	print("AuthScene: Profile fetch completed: ", profile_result)

func handle_signup_response(response_code: int, response_body: String):
	print("AuthScene: Handling signup response - Code: ", response_code)
	
	if response_code == 200:
		var json = JSON.new()
		if json.parse(response_body) == OK:
			var response = json.get_data()
			
			if response.has("id") or (response.has("user") and response["user"].has("id")):
				show_message("Success! Account created.", Color.GREEN)
				
				# Save auth data
				SupabaseClient.current_user = response
				
				# Get user info
				var user_id = response["user"]["id"] if response.has("user") else response["id"]
				var email = response["user"]["email"] if response.has("user") else response.get("email", "")
				
				# ✅ Save credentials ONLY AFTER successful registration
				var password = password_input.text
				if not email.is_empty() and not password.is_empty():
					GameManager.save_login_credentials(email, password)
				
				# Create profile
				call_deferred("create_profile_after_signup", user_id, email)
				return
			else:
				show_message("Registration failed: No user ID", Color.RED)
		else:
			show_message("Registration failed: Invalid response", Color.RED)
	else:
		handle_error_response(response_body, response_code)

func handle_profile_check(response_code: int, response_body: String):
	print("AuthScene: Handling profile check - Code: ", response_code)
	
	if response_code == 200:
		var json = JSON.new()
		if json.parse(response_body) == OK:
			var data = json.get_data()
			
			if data is Array and data.size() > 0:
				var profile = data[0]
				
				var user_id = SupabaseClient.current_user.get("user", {}).get("id", "")
				var email = SupabaseClient.current_user.get("user", {}).get("email", "")
				
				var player_data = {
					"user_id": user_id,
					"email": email,
					"username": profile.get("username", profile.get("display_name", "Player")),
					"character": profile.get("selected_character", "RedTop"),
					"supabase_session": SupabaseClient.current_user
				}
				
				GameManager.save_player_data(player_data)
				
				show_message("Welcome back!", Color.GREEN)
				call_deferred("change_scene_to_lobby")
				return
			else:
				show_message("Please complete character selection", Color.YELLOW)
				call_deferred("go_to_character_selection_after_delay")
				return
	elif response_code == 401 or response_code == 403:
		show_message("Session expired. Please login again.", Color.RED)
		call_deferred("go_to_character_selection_after_delay")
	else:
		show_message("Failed to load profile", Color.RED)

func handle_profile_creation(response_code: int, response_body: String):
	print("AuthScene: Handling profile creation - Code: ", response_code)
	
	if response_code == 201 or response_code == 200:
		show_message("Profile created! Entering lobby...", Color.GREEN)
		call_deferred("change_scene_to_lobby_after_delay")
	elif response_code == 409:
		print("Profile already exists, continuing to lobby...")
		show_message("Loading lobby...", Color.GREEN)
		call_deferred("change_scene_to_lobby_after_delay_short")
	else:
		var json = JSON.new()
		if json.parse(response_body) == OK:
			var response = json.get_data()
			var error_msg = response.get("message", "Failed to create profile")
			show_message("Error: " + error_msg, Color.RED)
		else:
			show_message("Failed to create profile", Color.RED)
		
		call_deferred("go_to_character_selection_after_delay")

func create_profile_after_signup(user_id: String, email: String):
	print("AuthScene: Creating profile after signup")
	
	if GameManager.temp_character_data and not GameManager.temp_character_data.is_empty():
		var char_data = GameManager.get_temp_character_data()
		
		var player_data = {
			"user_id": user_id,
			"email": email,
			"username": char_data["username"],
			"character": char_data["character"],
			"supabase_session": SupabaseClient.current_user
		}
		GameManager.save_player_data(player_data)
		
		show_message("Creating your profile...", Color.YELLOW)
		var profile_result = SupabaseClient.create_user_profile(user_id, char_data["username"], char_data["character"])
		print("AuthScene: Create profile result: ", profile_result)
		
		GameManager.clear_temp_character_data()
	else:
		show_message("Please complete character selection first", Color.RED)
		call_deferred("go_to_character_selection_after_delay")

func handle_error_response(response_body: String, response_code: int):
	print("AuthScene: Handling error response - Code: ", response_code)
	
	if response_body.is_empty():
		show_message("Authentication failed", Color.RED)
		return
	
	var json = JSON.new()
	var parse_result = json.parse(response_body)
	
	if parse_result != OK:
		show_message("Error parsing response", Color.RED)
		return
	
	var response = json.get_data()
	
	var error_msg = "Authentication failed"
	if response != null and response.has("error_description"):
		error_msg = response["error_description"]
	elif response != null and response.has("msg"):
		error_msg = response["msg"]
	elif response != null and response.has("message"):
		error_msg = response["message"]
	elif response != null and response.has("error"):
		error_msg = response["error"]
	
	if "Invalid login credentials" in error_msg or "invalid_grant" in error_msg:
		show_message("Invalid email or password", Color.RED)
	elif "Email not confirmed" in error_msg:
		show_message("Please confirm your email first", Color.RED)
	elif "User already registered" in error_msg or "already exists" in error_msg:
		show_message("Account already exists. Please login instead.", Color.RED)
	elif "User not found" in error_msg or "does not exist" in error_msg:
		show_message("No account found with this email", Color.RED)
	else:
		show_message("Error: " + error_msg, Color.RED)

func change_scene_to_lobby():
	get_tree().change_scene_to_file("res://scenes/LobbyScene.tscn")

func change_scene_to_lobby_after_delay():
	await get_tree().create_timer(1.5).timeout
	get_tree().change_scene_to_file("res://scenes/LobbyScene.tscn")

func change_scene_to_lobby_after_delay_short():
	await get_tree().create_timer(1.0).timeout
	get_tree().change_scene_to_file("res://scenes/LobbyScene.tscn")

func go_to_character_selection_after_delay():
	await get_tree().create_timer(2.0).timeout
	GameManager.set_came_from_login(false)
	get_tree().change_scene_to_file("res://scenes/CharacterSelection.tscn")
