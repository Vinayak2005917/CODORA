import json
import os
import random
import re
from io import BytesIO

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from openai import OpenAI

from .models import User
from .project_store import get_project_store

try:
    from markdown_pdf import MarkdownPdf, Section
except Exception:
    MarkdownPdf = None
    Section = None


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-nano-9b-v2:free")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "https://codora.app")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "CODORA")
DEFAULT_AVATAR_COLORS = ["#5eb3f6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"]


def health_check(request):
    return JsonResponse({"status": "ok"}, status=200)


def _parse_json_body(request):
    try:
        return json.loads(request.body or "{}"), None
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "Invalid JSON"}, status=400)


def _user_payload(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatarColor": user.avatar_color,
    }


def _create_user(username, password, email):
    user = User.objects.create_user(username=username, password=password, email=email)
    user.avatar_color = random.choice(DEFAULT_AVATAR_COLORS)
    user.save(update_fields=["avatar_color"])
    return user


def _openrouter_client():
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return None
    return OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)


def _ask_ai(system_prompt, user_prompt):
    client = _openrouter_client()
    if client is None:
        raise ValueError("OPENROUTER_API_KEY is missing")

    completion = client.chat.completions.create(
        extra_headers={
            "HTTP-Referer": OPENROUTER_SITE_URL,
            "X-Title": OPENROUTER_APP_NAME,
        },
        model=OPENROUTER_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return completion.choices[0].message.content


def _store():
    return get_project_store()


@csrf_exempt
@require_http_methods(["POST"])
def signup_view(request):
    data, error = _parse_json_body(request)
    if error:
        return error

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    email = data.get("email", "").strip() or f"{username}@codora.local"

    if len(username) < 3:
        return JsonResponse({"error": "Username must be at least 3 characters"}, status=400)
    if len(password) < 6:
        return JsonResponse({"error": "Password must be at least 6 characters"}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username already exists"}, status=400)

    try:
        user = _create_user(username=username, password=password, email=email)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)

    login(request, user)
    return JsonResponse({"ok": True, "user": _user_payload(user)})


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    data, error = _parse_json_body(request)
    if error:
        return error

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if len(username) < 3 or len(password) < 6:
        return JsonResponse({"error": "Username and password are required"}, status=400)

    created = False
    user = authenticate(request, username=username, password=password)

    # Migration-safe behavior: convert old unusable-password accounts to local auth.
    if user is None:
        existing = User.objects.filter(username=username).first()
        if existing and not existing.has_usable_password():
            existing.set_password(password)
            existing.save(update_fields=["password"])
            user = authenticate(request, username=username, password=password)

    # Keep previous UX: auto-register on first login.
    if user is None:
        existing = User.objects.filter(username=username).first()
        if existing:
            return JsonResponse({"error": "Invalid username or password"}, status=401)

        email = f"{username}@codora.local"
        try:
            user = _create_user(username=username, password=password, email=email)
            created = True
        except Exception as exc:
            return JsonResponse({"error": str(exc)}, status=500)

    login(request, user)
    request.session.save()

    return JsonResponse(
        {
            "ok": True,
            "created": created,
            "user": _user_payload(user),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def me_view(request):
    if request.user.is_authenticated:
        return JsonResponse(
            {
                "ok": True,
                "authenticated": True,
                "user": _user_payload(request.user),
            }
        )

    return JsonResponse({"ok": False, "authenticated": False})


@csrf_exempt
@require_http_methods(["POST"])
def guest_login_view(request):
    guest_num = random.randint(1000, 9999)
    guest_username = f"Guest{guest_num}"
    request.session["is_guest"] = True
    request.session["guest_username"] = guest_username
    request.session["guest_avatar_color"] = "#6b7280"

    return JsonResponse(
        {
            "ok": True,
            "guest": True,
            "user": {
                "id": f"guest_{guest_num}",
                "username": guest_username,
                "email": f"{guest_username}@guest.local",
                "avatarColor": "#6b7280",
            },
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def process_prompt(request):
    data, error = _parse_json_body(request)
    if error:
        return error

    prompt = data.get("prompt", "").strip()
    if not prompt:
        return JsonResponse({"error": "Prompt is required"}, status=400)

    system_prompt = (
        "You are CODORA AI. For document requests, respond in clean Markdown. "
        "For code requests, return only code and useful comments."
    )

    try:
        ai_response = _ask_ai(system_prompt, prompt)
    except Exception as exc:
        return JsonResponse({"error": f"AI Error: {str(exc)}"}, status=500)

    test_file_path = settings.BASE_DIR / "test.txt"
    with open(test_file_path, "w", encoding="utf-8") as file_obj:
        file_obj.write(ai_response)

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "editor",
        {
            "type": "editor.message",
            "content": ai_response,
            "clientId": "AI_DASHBOARD",
        },
    )

    return JsonResponse(
        {
            "success": True,
            "response": ai_response,
            "message": "AI response saved and broadcast to doc_editor",
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def create_project(request):
    data, error = _parse_json_body(request)
    if error:
        return error

    project_type = data.get("type", "").strip()
    prompt = data.get("prompt", "").strip()

    if project_type not in {"doc", "code", "lesson"}:
        return JsonResponse({"error": "Valid type (doc/code/lesson) is required"}, status=400)
    if not prompt:
        return JsonResponse({"error": "Prompt is required"}, status=400)

    if project_type == "code":
        system_prompt = "You generate clean code only, with concise comments where useful."
    else:
        system_prompt = "You generate clean markdown documents with readable structure."

    try:
        ai_response = _ask_ai(system_prompt, prompt)
    except Exception as exc:
        return JsonResponse({"error": f"AI Error: {str(exc)}"}, status=500)

    project = _store().create_project(project_type=project_type, prompt=prompt, content=ai_response)

    editor_map = {
        "doc": "/frontend/doc_editor/doc_editor.html",
        "code": "/frontend/code_editor/code_editor.html",
        "lesson": "/frontend/lesson_planner/lesson_planner.html",
    }
    redirect_url = f"{editor_map[project_type]}?room={project['room']}"

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"editor_{project['room']}",
        {
            "type": "editor.message",
            "content": ai_response,
            "clientId": "AI_SYSTEM",
        },
    )

    return JsonResponse(
        {
            "ok": True,
            "success": True,
            "room": project["room"],
            "type": project_type,
            "title": project["title"],
            "redirect": redirect_url,
            "response": ai_response,
        }
    )


def _extract_code_blocks(text):
    code_blocks = re.findall(r"```(?:\w+)?\n?(.*?)\n?```", text or "", re.DOTALL)
    if code_blocks:
        return "\n\n".join(code_blocks)
    return text or ""


@csrf_exempt
@require_http_methods(["POST"])
def ai_prompt_commit(request, room):
    data, error = _parse_json_body(request)
    if error:
        return error

    prompt = data.get("prompt", "").strip()
    current_content = data.get("content", "")
    if not prompt:
        return JsonResponse({"error": "Prompt is required"}, status=400)

    project = _store().get_project(room)
    if not project:
        return JsonResponse({"error": f"Project {room} not found"}, status=404)

    if project["type"] == "code":
        system_prompt = "You improve code and return only the updated code."
    else:
        system_prompt = "You improve documents and return polished markdown."

    code_only = _extract_code_blocks(current_content)
    user_message = f"Current file content:\n```\n{code_only}\n```\n\nUser request:\n{prompt}"

    try:
        ai_response = _ask_ai(system_prompt, user_message)
    except Exception as exc:
        return JsonResponse({"error": f"AI Error: {str(exc)}"}, status=500)

    version = _store().save_version(room, ai_response, message=f"AI: {prompt[:60]}", author="AI")

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"editor_{room}",
        {
            "type": "editor.message",
            "content": ai_response,
            "clientId": "AI_PROMPT",
        },
    )

    versions = _store().list_versions(room) or []
    async_to_sync(channel_layer.group_send)(
        f"editor_{room}",
        {
            "type": "versions.list",
            "versions": versions,
        },
    )

    return JsonResponse({"ok": True, "response": ai_response, "version": version})


@require_http_methods(["GET"])
def list_projects(request):
    projects = _store().list_projects()
    response_projects = [
        {
            "room": project["room"],
            "type": project["type"],
            "title": project["title"],
            "createdAt": project["created_at"],
            "updatedAt": project["updated_at"],
            "preview": project["preview"],
        }
        for project in projects
    ]
    return JsonResponse(response_projects, safe=False)


@require_http_methods(["GET"])
def get_project(request, room):
    project = _store().get_project(room)
    if not project:
        return JsonResponse({"error": "Project not found"}, status=404)

    return JsonResponse(
        {
            "ok": True,
            "room": project["room"],
            "type": project["type"],
            "title": project["title"],
            "createdAt": project["created_at"],
            "updatedAt": project["updated_at"],
            "preview": project["preview"],
            "content": project["content"],
        }
    )


@require_http_methods(["DELETE"])
def delete_project(request, room):
    if not _store().delete_project(room):
        return JsonResponse({"error": "Project not found or could not be deleted"}, status=404)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def download_project_pdf(request, room):
    project = _store().get_project(room)
    if not project:
        return JsonResponse({"error": "Project not found"}, status=404)

    content = project.get("content", "")
    if not content:
        return JsonResponse({"error": "Project has no content to export"}, status=400)
    if MarkdownPdf is None:
        return JsonResponse({"error": "Server missing markdown_pdf dependency"}, status=500)

    markdown_pdf = MarkdownPdf()
    markdown_pdf.add_section(Section(content))
    buffer = BytesIO()
    markdown_pdf.save(buffer)
    buffer.seek(0)

    filename = f"project_{room}.pdf"
    response = HttpResponse(buffer.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@csrf_exempt
@require_http_methods(["POST"])
def commit_version(request, room):
    project = _store().get_project(room)
    if not project:
        return JsonResponse({"error": "Project not found"}, status=404)

    data, error = _parse_json_body(request)
    if error:
        return error

    message = data.get("message", "").strip() or "Snapshot"
    author = data.get("author", "User")
    version = _store().save_version(room, project.get("content", ""), message, author)
    if not version:
        return JsonResponse({"error": "Failed to save version"}, status=500)
    return JsonResponse({"ok": True, "version": version})


@require_http_methods(["GET"])
def list_versions_view(request, room):
    project = _store().get_project(room)
    if not project:
        return JsonResponse({"error": "Project not found"}, status=404)

    versions = _store().list_versions(room) or []
    meta = [
        {
            "id": version["id"],
            "message": version.get("message", ""),
            "author": version.get("author", ""),
            "timestamp": version.get("timestamp", ""),
        }
        for version in versions
    ]
    return JsonResponse(meta, safe=False)


@require_http_methods(["GET"])
def get_version_view(request, room, version_id):
    version = _store().get_version(room, version_id)
    if not version:
        return JsonResponse({"error": "Version not found"}, status=404)
    return JsonResponse(version)
