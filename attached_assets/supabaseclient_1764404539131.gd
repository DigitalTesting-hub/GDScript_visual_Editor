extends Node

const SUPABASE_URL = "https://crkuifhjovcfvmtkextl.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNya3VpZmhqb3ZjZnZtdGtleHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODYyODgsImV4cCI6MjA3NTk2MjI4OH0.4cHSa8lsQ9GPTRlZdUOyrFaELVVzdu-4S2fiQ7WlsD8"

var http_request: HTTPRequest
var current_user: Dictionary = {}
var pending_requests: Dictionary = {}  # Track requests by purpose

# Signals
signal supabase_response(purpose: String, result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray)

func _ready():
	# Initialize HTTPRequest
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_request_completed)
	print("SupabaseClient: HTTPRequest initialized")

func _on_request_completed(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray):
	var response_body = body.get_string_from_utf8()
	print("SupabaseClient Response - Code: ", response_code, " Body: ", response_body)
	
	# Find which request this response belongs to
	var request_purpose = ""
	for purpose in pending_requests.keys():
		request_purpose = purpose
		pending_requests.erase(purpose)
		break
	
	# Emit signal with purpose
	emit_signal("supabase_response", request_purpose, result, response_code, headers, body)

func _make_request(purpose: String, url: String, headers: Array, method: int, body: String = "") -> int:
	# Ensure HTTPRequest is initialized
	if http_request == null:
		push_error("HTTPRequest is null! Reinitializing...")
		http_request = HTTPRequest.new()
		add_child(http_request)
		http_request.request_completed.connect(_on_request_completed)
	
	pending_requests[purpose] = true
	var error = http_request.request(url, headers, method, body)
	if error != OK:
		push_error("HTTP request failed for purpose: " + purpose + " Error: " + str(error))
		pending_requests.erase(purpose)
	return error

# Sign up without email confirmation
func sign_up_no_confirm(email: String, password: String) -> int:
	var headers = [
		"Content-Type: application/json", 
		"apikey: " + SUPABASE_KEY
	]
	
	var body = {
		"email": email,
		"password": password,
		"email_confirm": true  # Auto-confirm
	}
	
	var url = SUPABASE_URL + "/auth/v1/signup"
	return _make_request("signup", url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))

# Sign in with email
func sign_in_with_email(email: String, password: String) -> int:
	var headers = [
		"Content-Type: application/json",
		"apikey: " + SUPABASE_KEY
	]
	
	var body = {
		"email": email,
		"password": password
	}
	
	var url = SUPABASE_URL + "/auth/v1/token?grant_type=password"
	return _make_request("login", url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))

# Google OAuth - Get URL for browser
func get_google_oauth_url() -> String:
	var redirect_url = "your-app-scheme://auth-callback"  # You'll need to set this up
	return SUPABASE_URL + "/auth/v1/authorize?provider=google&redirect_to=" + redirect_url

# Sign in with Google (after getting code from OAuth)
func sign_in_with_google(id_token: String) -> int:
	var headers = [
		"Content-Type: application/json",
		"apikey: " + SUPABASE_KEY
	]
	
	var body = {
		"provider": "google",
		"id_token": id_token
	}
	
	var url = SUPABASE_URL + "/auth/v1/token?grant_type=id_token"
	return _make_request("login_google", url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))

# Reset password
func reset_password(email: String) -> int:
	var headers = [
		"Content-Type: application/json",
		"apikey: " + SUPABASE_KEY
	]
	
	var body = {
		"email": email
	}
	
	var url = SUPABASE_URL + "/auth/v1/recover"
	return _make_request("reset_password", url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))

# Update password
func update_password(new_password: String) -> int:
	var access_token = current_user.get("access_token", "")
	if access_token.is_empty():
		return ERR_UNAUTHORIZED
	
	var headers = [
		"Content-Type: application/json", 
		"apikey: " + SUPABASE_KEY,
		"Authorization: Bearer " + access_token
	]
	
	var body = {
		"password": new_password
	}
	
	var url = SUPABASE_URL + "/auth/v1/user"
	return _make_request("update_password", url, headers, HTTPClient.METHOD_PUT, JSON.stringify(body))

# Create user profile
func create_user_profile(user_id: String, username: String, character: String) -> int:
	var access_token = ""
	if current_user and current_user.has("access_token"):
		access_token = current_user["access_token"]
	else:
		print("No access token available for profile creation")
		return ERR_UNAUTHORIZED
	
	var headers = [
		"Content-Type: application/json", 
		"apikey: " + SUPABASE_KEY,
		"Authorization: Bearer " + access_token,
		"Prefer: return=representation"
	]
	
	var body = {
		"id": user_id,
		"username": username,
		"display_name": username,
		"selected_character": character
	}
	
	var url = SUPABASE_URL + "/rest/v1/profiles"
	return _make_request("create_profile", url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))

# Get user profile - SIMPLIFIED (no token expiry check)
func get_user_profile(user_id: String) -> int:
	var access_token = current_user.get("access_token", SUPABASE_KEY)
	
	var headers = [
		"Content-Type: application/json", 
		"apikey: " + SUPABASE_KEY,
		"Authorization: Bearer " + access_token
	]
	
	var url = SUPABASE_URL + "/rest/v1/profiles?id=eq." + user_id + "&select=*"
	return _make_request("get_profile", url, headers, HTTPClient.METHOD_GET)

# Check if email already exists
func check_email_exists(email: String) -> int:
	var headers = [
		"Content-Type: application/json", 
		"apikey: " + SUPABASE_KEY,
		"Authorization: Bearer " + SUPABASE_KEY
	]
	
	var url = SUPABASE_URL + "/rest/v1/profiles?email=eq." + email + "&select=id"
	return _make_request("check_email", url, headers, HTTPClient.METHOD_GET)

# Check if username already exists
func check_username_exists(username: String) -> int:
	var headers = [
		"Content-Type: application/json", 
		"apikey: " + SUPABASE_KEY,
		"Authorization: Bearer " + SUPABASE_KEY
	]
	
	var url = SUPABASE_URL + "/rest/v1/profiles?username=eq." + username + "&select=id"
	return _make_request("check_username", url, headers, HTTPClient.METHOD_GET)

# Sign out
func sign_out() -> int:
	var access_token = current_user.get("access_token", "")
	if access_token.is_empty():
		current_user = {}
		return OK
	
	var headers = [
		"Content-Type: application/json",
		"apikey: " + SUPABASE_KEY,
		"Authorization: Bearer " + access_token
	]
	
	var url = SUPABASE_URL + "/auth/v1/logout"
	var result = _make_request("logout", url, headers, HTTPClient.METHOD_POST)
	
	# Clear local session regardless
	current_user = {}
	return result

# Update password with access token (for password reset)
func update_password_with_access_token(access_token: String, new_password: String) -> int:
	var headers = [
		"Content-Type: application/json", 
		"apikey: " + SUPABASE_KEY,
		"Authorization: Bearer " + access_token
	]
	
	var body = {
		"password": new_password
	}
	
	var url = SUPABASE_URL + "/auth/v1/user"
	return _make_request("update_password_token", url, headers, HTTPClient.METHOD_PUT, JSON.stringify(body))
