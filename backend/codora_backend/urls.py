"""
URL configuration for codora_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication endpoints
    path('api/auth/signup/', views.signup_view, name='signup'),
    path('api/auth/login/', views.login_view, name='login'),
    path('api/auth/logout/', views.logout_view, name='logout'),
    path('api/auth/me/', views.me_view, name='me'),
    path('api/auth/guest/', views.guest_login_view, name='guest_login'),
    
    # Project endpoints
    path('api/process-prompt/', views.process_prompt, name='process_prompt'),
    path('api/projects/', views.create_project, name='create_project'),  # POST
    path('api/projects/list/', views.list_projects, name='list_projects'),  # GET
    path('api/projects/<str:room>/', views.get_project, name='get_project'),  # GET
]
