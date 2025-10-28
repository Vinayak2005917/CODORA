"""Example views demonstrating Supabase storage usage.

Endpoints:
- POST /api/supabase/upload/  (multipart/form-data with 'file' and optional 'folder')
- GET  /api/supabase/list/?folder=...

These views rely on a Bearer token sent in the Authorization header. They use
`codora_backend.supabase_auth.supabase_authenticated` to verify tokens.
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from codora_backend.supabase_auth import supabase_authenticated, get_user_from_token
from codora_backend.supabase_client import supabase


@csrf_exempt
@supabase_authenticated
def upload_file(request):
    """Upload a file into Supabase Storage under the authenticated user's folder.

    Expects multipart/form-data with field 'file' and optional 'folder'.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    file_obj = request.FILES.get('file')
    folder = request.POST.get('folder', '').strip()
    user = getattr(request, 'supabase_user', None)

    if not file_obj:
        return JsonResponse({'error': 'No file provided'}, status=400)

    user_id = None
    if isinstance(user, dict):
        user_id = user.get('id')
    else:
        user_id = getattr(user, 'id', None)

    if not user_id:
        return JsonResponse({'error': 'Could not determine user id'}, status=400)

    # Build storage path: <user_id>/<folder>/<filename>
    prefix = f"{user_id}".strip('/')
    if folder:
        prefix = f"{prefix}/{folder.strip('/') }"
    path = f"{prefix}/{file_obj.name}"

    try:
        data = file_obj.read()
        # Upload bytes to Supabase storage
        # Note: some supabase client versions accept file-like objects directly.
        result = supabase.storage.from_('user_files').upload(path, data)
        return JsonResponse({'ok': True, 'path': path, 'result': result})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def list_files(request):
    """List files in a user's folder.

    Requires Authorization: Bearer <token> header. Query param `folder` optional.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    folder = request.GET.get('folder', '').strip().strip('/')
    auth = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
    token = auth.replace('Bearer ', '') if auth else ''

    try:
        user = get_user_from_token(token)
        user_id = user.get('id') if isinstance(user, dict) else getattr(user, 'id', None)
        if not user_id:
            return JsonResponse({'error': 'Could not determine user id'}, status=400)

        path = f"{user_id}"
        if folder:
            path = f"{path}/{folder}"

        files = supabase.storage.from_('user_files').list(path)
        return JsonResponse({'ok': True, 'files': files})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=401)


def get_user_info(request):
    """Verify Authorization header Bearer <token> and return Supabase user info."""
    auth = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
    token = auth.replace('Bearer ', '') if auth else ''
    if not token:
        return JsonResponse({'error': 'Missing token'}, status=401)

    try:
        user = get_user_from_token(token)
        return JsonResponse({'ok': True, 'user': user})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=401)
