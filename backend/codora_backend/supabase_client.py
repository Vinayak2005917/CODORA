import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    # Do not raise at import time in some environments, but warn so devs can notice.
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_supabase_client():
    """Return the initialized Supabase client.

    Use `from codora_backend.supabase_client import supabase` or call this helper.
    """
    return supabase
