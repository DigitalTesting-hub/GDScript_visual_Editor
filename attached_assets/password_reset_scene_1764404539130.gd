extends Control

@onready var email_input: LineEdit = $VBoxContainer/EmailInput
@onready var reset_token_input: LineEdit = $VBoxContainer/TokenContainer/ResetTokenInput
@onready var new_password_input: LineEdit = $VBoxContainer/TokenContainer/NewPasswordInput
@onready var confirm_password_input: LineEdit = $VBoxContainer/TokenContainer/ConfirmPasswordInput
@onready var request_reset_button: Button = $VBoxContainer/RequestResetButton
@onready var reset_button: Button = $VBoxContainer/TokenContainer/ResetButton
@onready var back_button: Button = $VBoxContainer/BackButton
@onready var message_label: Label = $VBoxContainer/MessageLabel
@onready var token_container: VBoxContainer = $VBoxContainer/TokenContainer
@onready var instructions_label: Label = $VBoxContainer/InstructionsLabel

var extracted_access_token: String = ""

func _ready():
	# Connect button signals
	if request_reset_button:
		request_reset_button.pressed.connect(_on_RequestResetButton_pressed)
	else:
		push_error("RequestResetButton not found!")
	
	if reset_button:
		reset_button.pressed.connect(_on_ResetButton_pressed)
	else:
		push_error("ResetButton not found!")
	
	if back_button:
		back_button.pressed.connect(_on_BackButton_pressed)
	else:
		push_error("BackButton not found!")
	
	# Connect text changed signal to auto-detect URLs
	if reset_token_input:
		reset_token_input.text_changed.connect(_on_reset_token_changed)
	
	# Connect to Supabase signals
	if not SupabaseClient.supabase_response.is_connected(_on_supabase_response):
		SupabaseClient.supabase_response.connect(_on_supabase_response)
	
	# Initially hide token input section and clear instructions
	if token_container:
		token_container.visible = false
	else:
		push_error("TokenContainer not found!")
	
	if instructions_label:
		instructions_label.text = "Enter your email and click 'Send Reset Email' to receive a reset link."
		instructions_label.visible = true
	else:
		push_error("InstructionsLabel not found!")
	
	print("PasswordResetScene: Ready - All buttons connected")

func _on_RequestResetButton_pressed():
	print("PasswordResetScene: Request reset button pressed")
	var email = email_input.text.strip_edges()
	
	if email.is_empty():
		show_message("Please enter your email address", Color.RED)
		return
	
	if not is_valid_email(email):
		show_message("Please enter a valid email address", Color.RED)
		return
	
	show_message("Sending password reset email...", Color.YELLOW)
	
	# Check if the function exists before calling it
	if SupabaseClient.has_method("reset_password"):
		var result = SupabaseClient.reset_password(email)
		print("PasswordResetScene: Reset password request result: ", result)
	else:
		show_message("Error: Reset password function not available", Color.RED)
		push_error("reset_password function not found in SupabaseClient!")

func _on_ResetButton_pressed():
	print("PasswordResetScene: Reset button pressed")
	var email = email_input.text.strip_edges()
	var new_password = new_password_input.text
	var confirm_password = confirm_password_input.text
	
	if email.is_empty() or new_password.is_empty() or confirm_password.is_empty():
		show_message("Please fill all fields", Color.RED)
		return
	
	if not is_valid_email(email):
		show_message("Please enter a valid email address", Color.RED)
		return
	
	if new_password.length() < 6:
		show_message("Password must be at least 6 characters", Color.RED)
		return
	
	if new_password != confirm_password:
		show_message("Passwords do not match", Color.RED)
		return
	
	# Use the extracted access token if we have one, otherwise use what's in the input field
	var token_to_use = extracted_access_token
	if token_to_use.is_empty():
		token_to_use = reset_token_input.text.strip_edges()
	
	if token_to_use.is_empty():
		show_message("Please paste the reset URL or token", Color.RED)
		return
	
	show_message("Updating password with access token...", Color.YELLOW)
	
	# Use the access token method
	if SupabaseClient.has_method("update_password_with_access_token"):
		var result = SupabaseClient.update_password_with_access_token(token_to_use, new_password)
		print("PasswordResetScene: Update password result: ", result)
	else:
		show_message("Error: Password update function not available", Color.RED)
		push_error("update_password_with_access_token function not found in SupabaseClient!")

func _on_BackButton_pressed():
	print("PasswordResetScene: Back button pressed")
	get_tree().change_scene_to_file("res://Scenes/AuthScene.tscn")

func _on_reset_token_changed(new_text: String):
	# Auto-detect if user pasted a full URL and extract the access token
	if new_text.contains("http") and (new_text.contains("access_token=") or new_text.contains("token=")):
		var extracted_token = extract_access_token_from_url(new_text)
		if extracted_token:
			extracted_access_token = extracted_token
			reset_token_input.text = "✅ URL detected - Token extracted automatically!"
			show_message("✅ Access token automatically extracted from URL! Click 'Reset Password' to continue.", Color.GREEN)
			# Optional: Clear the field but keep the visual feedback
			await get_tree().create_timer(2.0).timeout
			reset_token_input.text = "Access token ready (extracted from URL)"

func extract_access_token_from_url(url: String) -> String:
	print("Attempting to extract access token from URL: ", url)
	
	# Method 1: Try to extract access_token parameter (most common)
	var access_token_start = url.find("access_token=")
	if access_token_start != -1:
		access_token_start += 13  # Length of "access_token="
		var access_token_end = url.find("&", access_token_start)
		if access_token_end == -1:
			access_token_end = url.length()
		
		var token = url.substr(access_token_start, access_token_end - access_token_start)
		print("Extracted access_token: ", token)
		return token
	
	# Method 2: Try to extract token parameter
	var token_start = url.find("token=")
	if token_start != -1:
		token_start += 6  # Length of "token="
		var token_end = url.find("&", token_start)
		if token_end == -1:
			token_end = url.length()
		
		var token = url.substr(token_start, token_end - token_start)
		print("Extracted token: ", token)
		return token
	
	print("No access token found in URL")
	return ""

func show_message(text: String, color: Color = Color.WHITE):
	print("PasswordResetScene: Message: ", text)
	message_label.text = text
	message_label.modulate = color

func is_valid_email(email: String) -> bool:
	var email_regex = RegEx.new()
	email_regex.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
	return email_regex.search(email) != null

func _on_supabase_response(purpose: String, result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray):
	var response_body = body.get_string_from_utf8()
	print("PasswordResetScene: Supabase response - Purpose: ", purpose, " Result: ", result, " Code: ", response_code)
	
	match purpose:
		"reset_password":
			handle_reset_response(response_code, response_body)
		"update_password_token":
			handle_password_update_response(response_code, response_body)

func handle_reset_response(response_code: int, response_body: String):
	print("PasswordResetScene: Handling reset response - Code: ", response_code)
	
	if response_code == 200:
		show_message("Reset email sent! Check your email for the reset link.", Color.GREEN)
		
		# Show instructions for getting the token in the label
		show_token_instructions()
		if token_container:
			token_container.visible = true
		
	else:
		var json = JSON.new()
		if json.parse(response_body) == OK:
			var response = json.get_data()
			var error_msg = response.get("error_description", response.get("msg", "Failed to send reset email"))
			show_message(error_msg, Color.RED)
		else:
			show_message("Failed to send reset email", Color.RED)

func handle_password_update_response(response_code: int, response_body: String):
	print("PasswordResetScene: Handling password update response - Code: ", response_code)
	
	if response_code == 200:
		show_message("Password reset successfully! You can now login with your new password.", Color.GREEN)
		
		# Wait and go back to auth scene
		await get_tree().create_timer(3.0).timeout
		get_tree().change_scene_to_file("res://Scenes/AuthScene.tscn")
		
	else:
		var json = JSON.new()
		if json.parse(response_body) == OK:
			var response = json.get_data()
			var error_msg = response.get("error_description", response.get("msg", "Failed to reset password"))
			show_message("Error: " + error_msg, Color.RED)
		else:
			show_message("Failed to reset password. Invalid or expired token.", Color.RED)

func show_token_instructions():
	var instructions = """📧 Check your email for the password reset message.

🔗 You can:
   • Paste the ENTIRE URL from the email
   • We'll automatically extract the access token
   • Then set your new password

✨ Just paste the whole link in the field above and we'll handle the rest!"""
	
	if instructions_label:
		instructions_label.text = instructions
		instructions_label.visible = true
