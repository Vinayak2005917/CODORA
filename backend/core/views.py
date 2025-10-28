from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
import json
from openai import OpenAI
from django.conf import settings
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import os
from .project_store import project_store
from .models import User
from django.http import HttpResponse, FileResponse
from io import BytesIO
from dotenv import load_dotenv
from django.db import IntegrityError
import os
load_dotenv()
from codora_backend.supabase_client import supabase

try:
    # optional dependency: markdown_pdf
    from markdown_pdf import MarkdownPdf, Section
except Exception:
    MarkdownPdf = None
    Section = None

# Create your views here.

# Uptime robo ping view
def health_check(request):
    return JsonResponse({"status": "ok"}, status=200)

# ===== USER AUTHENTICATION VIEWS =====

@csrf_exempt
@require_http_methods(["POST"])
def signup_view(request):
    """
    Create a new user account.
    
    Request: { "username": "...", "email": "...", "password": "..." }
    Response: { "ok": true, "user": { "id": 1, "username": "...", "email": "..." } }
    """
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        # Keep backward-compatible support for email field, otherwise derive one
        email = data.get('email', '').strip() or f"{username}@codora.local"
        password = data.get('password', '').strip()

        # Validation
        if not username or len(username) < 3:
            return JsonResponse({'error': 'Username must be at least 3 characters'}, status=400)

        if not email:
            return JsonResponse({'error': 'Email is required'}, status=400)

        if not password or len(password) < 6:
            return JsonResponse({'error': 'Password must be at least 6 characters'}, status=400)

        # Use Supabase to create the auth user
        try:
            # supabase.auth.sign_up returns a dict-like object depending on client version
            resp = supabase.auth.sign_up({ 'email': email, 'password': password })
            # Check for error in response
            # Many supabase-py versions either return {'data': {...}, 'error': ...} or an object with .error
            error = None
            try:
                error = resp.get('error') if isinstance(resp, dict) else getattr(resp, 'error', None)
            except Exception:
                error = None

            if error:
                return JsonResponse({'error': str(error)}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'Supabase signup failed: {str(e)}'}, status=500)

        # Create or get a corresponding local Django user
        try:
            user, created = User.objects.get_or_create(username=username, defaults={ 'email': email })
            if created:
                # If using custom create_user behavior, ensure password not stored locally (we rely on Supabase),
                # but Django's create_user hashes a password; to avoid storing an alternate password, set unusable.
                user.set_unusable_password()
                # Assign a default avatar color
                import random
                colors = ['#5eb3f6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
                user.avatar_color = random.choice(colors)
                user.save()

            # Log the user in via Django session
            login(request, user)

            return JsonResponse({
                'ok': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'avatarColor': getattr(user, 'avatar_color', None)
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"Signup error: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    """
    Log in an existing user OR auto-register if doesn't exist.
    
    Request: { "username": "...", "password": "..." }
    Response: { "ok": true, "user": { "id": 1, "username": "...", "email": "..." }, "created": boolean }
    """
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()

        if not username or not password:
            return JsonResponse({'error': 'Username and password are required'}, status=400)

        if len(username) < 3:
            return JsonResponse({'error': 'Username must be at least 3 characters'}, status=400)

        if len(password) < 6:
            return JsonResponse({'error': 'Password must be at least 6 characters'}, status=400)

        # Convert username to email (keeps existing frontend UX)
        email = f"{username}@codora.local"

        # Authenticate via Supabase
        try:
            resp = supabase.auth.sign_in_with_password({'email': email, 'password': password})
            # Check for error
            error = None
            try:
                error = resp.get('error') if isinstance(resp, dict) else getattr(resp, 'error', None)
            except Exception:
                error = None

            if error:
                return JsonResponse({'error': str(error)}, status=401)
        except Exception as e:
            return JsonResponse({'error': f'Supabase login failed: {str(e)}'}, status=500)

        # At this point Supabase accepted the credentials. Ensure a local Django user exists and log them in.
        try:
            user, created = User.objects.get_or_create(username=username, defaults={'email': email})
            if created:
                user.set_unusable_password()
                import random
                colors = ['#5eb3f6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
                user.avatar_color = random.choice(colors)
                user.save()

            login(request, user)

            return JsonResponse({
                'ok': True,
                'created': created,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'avatarColor': getattr(user, 'avatar_color', None)
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print(f"Login error: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    """
    Log out the current user.
    
    Response: { "ok": true }
    """
    logout(request)
    return JsonResponse({'ok': True})


@require_http_methods(["GET"])
def me_view(request):
    """
    Get the currently logged-in user.
    
    Response: { "ok": true, "user": { "id": 1, "username": "...", ... } } or { "ok": false }
    """
    if request.user.is_authenticated:
        return JsonResponse({
            'ok': True,
            'authenticated': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'avatarColor': request.user.avatar_color
            }
        })
    else:
        return JsonResponse({
            'ok': False,
            'authenticated': False
        })


@csrf_exempt
@require_http_methods(["POST"])
def guest_login_view(request):
    """
    Create a temporary guest user session.
    
    Response: { "ok": true, "user": { "username": "Guest1234", ... } }
    """
    import random
    
    # Generate guest username
    guest_num = random.randint(1000, 9999)
    guest_username = f"Guest{guest_num}"
    
    # Store guest info in session (not in database)
    request.session['is_guest'] = True
    request.session['guest_username'] = guest_username
    request.session['guest_avatar_color'] = '#6b7280'
    
    return JsonResponse({
        'ok': True,
        'guest': True,
        'user': {
            'id': f'guest_{guest_num}',
            'username': guest_username,
            'email': f'{guest_username}@guest.local',
            'avatarColor': '#6b7280'
        }
    })


# ===== AI AND PROJECT VIEWS =====

@csrf_exempt
@require_http_methods(["POST"])
def process_prompt(request):
    """
    Receives a prompt from the dashboard, sends it to the AI API,
    saves the response to test.txt, and broadcasts it to all doc_editor users.
    """
    try:
        data = json.loads(request.body)
        prompt = data.get('prompt', '').strip()
        
        if not prompt:
            return JsonResponse({'error': 'Prompt is required'}, status=400)
        
        # Initialize OpenAI client with OpenRouter
        api_key = os.getenv("OPENROUTER_API_KEY")
        print(f"DEBUG: Using API key: {api_key[:20]}... (length: {len(api_key)})")
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        
        # Get AI response with Markdown formatting instruction
        try:
            completion = client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "https://codora.app",
                    "X-Title": "CODORA",
                },
                extra_body={},
                model="nvidia/nemotron-nano-9b-v2:free",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful AI assistant named CODORA AI, which is used to make documents and code files.When asked for Document or any sort of text response you Format your responses using Markdown for better readability. Use headers (# ## ###), bold (**text**), italics (*text*), code blocks (```), lists, and other Markdown features as appropriate. But when asked for Code you directly give code with any other useless text, do include comments. never user ``` NEVER!"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            ai_response = completion.choices[0].message.content
        except Exception as api_error:
            print(f"DEBUG: API Error: {str(api_error)}")
            return JsonResponse({'error': f'API Error: {str(api_error)}'}, status=500)
        
        # Save to test.txt
        test_file_path = settings.BASE_DIR / "test.txt"
        with open(test_file_path, 'w', encoding='utf-8') as f:
            f.write(ai_response)
        
        # Broadcast to all connected doc_editor users via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "editor",
            {
                "type": "editor.message",
                "content": ai_response,
                "clientId": "AI_DASHBOARD"
            }
        )
        
        return JsonResponse({
            'success': True,
            'response': ai_response,
            'message': 'AI response saved and broadcast to doc_editor'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def create_project(request):
    """
    Create a new project with AI-generated content.
    
    Request: { "type": "doc"|"code"|"lesson", "prompt": "..." }
    Response: { "ok": true, "room": "123456", "type": "doc", "redirect": "/frontend/doc_editor/doc_editor.html?room=123456" }
    """
    try:
        data = json.loads(request.body)
        project_type = data.get('type', '').strip()
        prompt = data.get('prompt', '').strip()
        
        if not project_type or project_type not in ['doc', 'code', 'lesson']:
            return JsonResponse({'error': 'Valid type (doc/code/lesson) is required'}, status=400)
        
        if not prompt:
            return JsonResponse({'error': 'Prompt is required'}, status=400)
        
        # Initialize OpenAI client with OpenRouter
        api_key = os.getenv("OPENROUTER_API_KEY")
        print(f"DEBUG: Using API key: {api_key[:20]}... (length: {len(api_key)})")
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        
        # Generate AI content
        if project_type == 'code':
            system_content = "You are a helpful AI assistant named CODORA AI, used to generate code. Provide clean, well-commented code without any Markdown formatting or code blocks. Include comments for clarity."
        else:
            system_content = "You are a helpful AI assistant named CODORA AI, used to create documents. Format your responses using Markdown for better readability. Use headers, bold, italics, lists, and other Markdown features as appropriate."
        
        try:
            completion = client.chat.completions.create(
                extra_headers={
                    "HTTP-Referer": "https://codora.app",
                    "X-Title": "CODORA",
                },
                extra_body={},
                model="nvidia/nemotron-nano-9b-v2:free",
                messages=[
                    {
                        "role": "system",
                        "content": system_content
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            ai_response = completion.choices[0].message.content
        except Exception as api_error:
            print(f"DEBUG: API Error: {str(api_error)}")
            return JsonResponse({'error': f'API Error: {str(api_error)}'}, status=500)
        
        # Create project
        print(f"DEBUG: About to create project with type={project_type}")
        project = project_store.create_project(
            project_type=project_type,
            prompt=prompt,
            content=ai_response
        )
        print(f"DEBUG: Project created: {project}")
        
        # Determine redirect URL based on type
        editor_map = {
            'doc': '/frontend/doc_editor/doc_editor.html',
            'code': '/frontend/code_editor/code_editor.html',
            'lesson': '/frontend/lesson_planner/lesson_planner.html'
        }
        
        redirect_url = f"{editor_map[project_type]}?room={project['room']}"
        
        # Broadcast to the new room (for any already-connected clients)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"editor_{project['room']}",
            {
                "type": "editor.message",
                "content": ai_response,
                "clientId": "AI_SYSTEM"
            }
        )
        
        return JsonResponse({
            'ok': True,
            'success': True,  # For backward compatibility
            'room': project['room'],
            'type': project_type,
            'title': project['title'],
            'redirect': redirect_url,
            'response': ai_response  # For backward compatibility
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def ai_prompt_commit(request, room):
    """
    Accepts a prompt and the current file content from the frontend for a given room.
    Sends a composed prompt (system instruction + current file + user request) to the AI,
    saves the AI response as a new version (so users can access previous content),
    and broadcasts the new content and updated versions list to the room.
    """
    def extract_code_blocks(text):
        """
        Extract content between ``` and ``` markers, ignoring language specifiers.
        Returns concatenated code blocks or original text if no blocks found.
        """
        import re
        # Find all code blocks: ```optional_lang\ncode\n```
        code_blocks = re.findall(r'```(?:\w+)?\n?(.*?)\n?```', text, re.DOTALL)
        if code_blocks:
            return '\n\n'.join(code_blocks)
        return text

    try:
        data = json.loads(request.body)
        prompt = data.get('prompt', '').strip()
        current_content = data.get('content', '')

        if not prompt:
            return JsonResponse({'error': 'Prompt is required'}, status=400)

        # Verify project exists
        proj = project_store.get_project(room)
        if not proj:
            return JsonResponse({'error': f'Project {room} not found'}, status=404)

        # Extract only code blocks from current content
        code_only = extract_code_blocks(current_content)

        # Compose system + content + user prompt
        if proj['type'] == 'code':
            system_msg = "You are a helpful AI assistant named CODORA AI, used to edit and improve code. Provide clean CODE and nothing else, just code. no extra text"
        else:
            system_msg = "You are a helpful AI assistant named CODORA AI, used to edit and improve documents. Format your responses using Markdown for better readability. Use headers, bold, italics, lists, and other Markdown features as appropriate."

        user_message = f"Current file content:\n```\n{code_only}\n```\n\nUser request:\n{prompt}"

        # Call AI
        api_key = os.getenv("OPENROUTER_API_KEY")
        client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)

        try:
            completion = client.chat.completions.create(
                extra_headers={"HTTP-Referer": "https://codora.app", "X-Title": "CODORA"},
                extra_body={},
                model="nvidia/nemotron-nano-9b-v2:free",
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_message},
                ],
            )
            ai_response = completion.choices[0].message.content
        except Exception as api_error:
            print('AI API error:', api_error)
            return JsonResponse({'error': f'AI API error: {str(api_error)}'}, status=500)

        # Save AI response as a version (author = 'AI')
        try:
            version = project_store.save_version(room, ai_response, message=f"AI: {prompt[:60]}", author='AI')
        except Exception as e:
            print('Save version error:', e)
            version = None

        # Broadcast new content and versions list to room
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"editor_{room}",
            {
                "type": "editor.message",
                "content": ai_response,
                "clientId": "AI_PROMPT"
            }
        )

        # Broadcast versions list
        try:
            versions = project_store.list_versions(room)
            async_to_sync(channel_layer.group_send)(
                f"editor_{room}",
                {
                    'type': 'versions.list',
                    'versions': versions or []
                }
            )
        except Exception as e:
            print('Broadcast versions error:', e)

        return JsonResponse({'ok': True, 'response': ai_response, 'version': version})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        print('ai_prompt_commit error:', e)
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def list_projects(request):
    """
    List all projects.
    
    Response: [{ "room": "123456", "type": "doc", "title": "...", "updatedAt": "...", "preview": "..." }]
    """
    try:
        projects = project_store.list_projects()
        
        # Convert to camelCase for frontend
        response_projects = []
        for project in projects:
            response_projects.append({
                'room': project['room'],
                'type': project['type'],
                'title': project['title'],
                'createdAt': project['created_at'],
                'updatedAt': project['updated_at'],
                'preview': project['preview']
            })
        
        return JsonResponse(response_projects, safe=False)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def get_project(request, room):
    """
    Get a specific project by room number.
    
    Response: { "ok": true, "room": "123456", "type": "doc", "title": "...", "content": "...", ... }
    """
    try:
        project = project_store.get_project(room)
        
        if not project:
            return JsonResponse({'error': 'Project not found'}, status=404)
        
        # Convert to camelCase for frontend
        return JsonResponse({
            'ok': True,
            'room': project['room'],
            'type': project['type'],
            'title': project['title'],
            'createdAt': project['created_at'],
            'updatedAt': project['updated_at'],
            'preview': project['preview'],
            'content': project['content']
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["DELETE"])
def delete_project(request, room):
    """
    Delete a project by room number.
    
    Response: { "ok": true } or { "error": "..." }
    """
    try:
        success = project_store.delete_project(room)
        
        if not success:
            return JsonResponse({'error': 'Project not found or could not be deleted'}, status=404)
        
        return JsonResponse({'ok': True})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def download_project_pdf(request, room):
    """
    Generate a PDF from the project's content (assumed Markdown) and return it as a downloadable file.
    """
    try:
        project = project_store.get_project(room)
        if not project:
            return JsonResponse({'error': 'Project not found'}, status=404)

        content = project.get('content', '')

        if not content:
            return JsonResponse({'error': 'Project has no content to export'}, status=400)

        if MarkdownPdf is None:
            return JsonResponse({'error': 'Server missing markdown_pdf dependency'}, status=500)

        # Create PDF in-memory
        mp = MarkdownPdf()
        mp.add_section(Section(content))
        buf = BytesIO()
        mp.save(buf)
        buf.seek(0)

        filename = f"project_{room}.pdf"
        response = HttpResponse(buf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    except Exception as e:
        print('PDF generation error:', str(e))
        return JsonResponse({'error': str(e)}, status=500)


# ---------------- Versioning API ----------------
@csrf_exempt
@require_http_methods(["POST"])
def commit_version(request, room):
    """Save a new version (commit) for the given project room.

    Request JSON: { "message": "Commit message", "author": "User" }
    """
    try:
        project = project_store.get_project(room)
        if not project:
            return JsonResponse({'error': 'Project not found'}, status=404)

        data = json.loads(request.body)
        message = data.get('message', '').strip() or 'Snapshot'
        author = data.get('author', 'User')

        version = project_store.save_version(room, project.get('content', ''), message, author)
        if not version:
            return JsonResponse({'error': 'Failed to save version'}, status=500)

        return JsonResponse({'ok': True, 'version': version})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def list_versions_view(request, room):
    try:
        project = project_store.get_project(room)
        if not project:
            return JsonResponse({'error': 'Project not found'}, status=404)

        versions = project_store.list_versions(room) or []
        # Return lightweight metadata (id, message, author, timestamp)
        meta = [
            { 'id': v['id'], 'message': v.get('message',''), 'author': v.get('author',''), 'timestamp': v.get('timestamp','') }
            for v in versions
        ]
        return JsonResponse(meta, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_http_methods(["GET"])
def get_version_view(request, room, version_id):
    try:
        v = project_store.get_version(room, version_id)
        if not v:
            return JsonResponse({'error': 'Version not found'}, status=404)
        return JsonResponse(v)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
