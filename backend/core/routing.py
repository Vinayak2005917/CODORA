from django.urls import re_path
from . import consumer

websocket_urlpatterns = [
    re_path(r'ws/editor/(?P<room>\d{6})/$', consumer.EditorConsumer.as_asgi()),
    re_path(r'ws/editor/$', consumer.EditorConsumer.as_asgi()),  # Backward compatibility
]
