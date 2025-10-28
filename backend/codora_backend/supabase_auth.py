"""Supabase authentication helpers for Django.

Provides:
- get_user_from_token(token): returns user dict/object from Supabase
- supabase_authenticated: decorator for views that require Supabase JWT Bearer token
- SupabaseAuthMiddleware: optional middleware to attach `request.supabase_user`

Usage:
- Decorate views with @supabase_authenticated
- Or add 'codora_backend.supabase_auth.SupabaseAuthMiddleware' to MIDDLEWARE

"""
from __future__ import annotations

import functools
from django.http import JsonResponse
from codora_backend.supabase_client import supabase
from django.contrib.auth import get_user_model
User = get_user_model()

try:
    # some versions of supabase-py expose exceptions here
    from supabase.lib.auth import SupabaseAuthException
except Exception:
    class SupabaseAuthException(Exception):
        pass


def get_user_from_token(token: str):
    """Return the Supabase user for the provided access token.

    Raises SupabaseAuthException on failure.
    """
    if not token:
        raise SupabaseAuthException("Missing token")

    res = supabase.auth.get_user(token)

    # supabase.auth.get_user may return different shapes depending on client version.
    user = None
    try:
        if isinstance(res, dict):
            # e.g. { 'data': { 'user': { ... } }, 'error': None }
            user = res.get('data', {}).get('user') or res.get('user') or res.get('data')
        else:
            # object-like
            user = getattr(res, 'user', None) or getattr(res, 'data', None)
            if isinstance(user, dict) and 'user' in user:
                user = user['user']
    except Exception:
        user = None

    if not user:
        raise SupabaseAuthException('Invalid token or user not found')

    return user


def supabase_authenticated(view_func):
    """Decorator for Django views that verifies a Supabase Bearer token.

    Attaches the user object to `request.supabase_user` on success.
    Returns JSON 401 on failure.
    """

    @functools.wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        auth = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
        token = auth.replace('Bearer ', '') if auth else ''
        try:
            user = get_user_from_token(token)
            request.supabase_user = user
        except Exception as e:
            return JsonResponse({'error': 'Unauthorized', 'detail': str(e)}, status=401)
        return view_func(request, *args, **kwargs)

    return _wrapped


class SupabaseAuthMiddleware:
    """Django middleware that parses Authorization header and attaches `request.supabase_user`.

    Add to `settings.MIDDLEWARE` if you prefer middleware-based auth for some endpoints.
    It will not block requests; it only attaches `request.supabase_user` when a valid token is present.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
        token = auth.replace('Bearer ', '') if auth else ''
        try:
            user = get_user_from_token(token) if token else None
            request.supabase_user = user
            # If we have a supabase_user, try to map to a local Django user and set request.user
            if user and isinstance(user, dict):
                # Prefer using the email local-part as username if present
                email = user.get('email')
                if email:
                    username = email.split('@')[0]
                    try:
                        local_user = User.objects.filter(username=username).first()
                        if local_user:
                            request.user = local_user
                    except Exception:
                        # If mapping fails, leave request.user untouched
                        pass
        except Exception:
            request.supabase_user = None
        return self.get_response(request)
