from django.urls import re_path
from . import consumer

websocket_urlpatterns = [
    # Accept any room string (non-empty, no slashes). Previously this required exactly 6 digits
    # which caused connections to fail for other room ids. Keep the bare /ws/editor/ route
    # for backward compatibility.
    re_path(r'ws/editor/(?P<room>[^/]+)/$', consumer.EditorConsumer.as_asgi()),
    re_path(r'ws/editor/$', consumer.EditorConsumer.as_asgi()),  # Backward compatibility
]
