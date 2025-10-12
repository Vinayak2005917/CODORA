from django.urls import path
from .views import text_view

urlpatterns = [
    path("text/", text_view),
]