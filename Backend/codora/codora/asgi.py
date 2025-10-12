"""
ASGI config for codora project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from api import consumer  # ensure api/consumers.py exists

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'codora.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path("ws/text/", consumer.TextConsumer.as_asgi()),
        ])
    ),
})