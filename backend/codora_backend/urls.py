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
from django.urls import include, path
from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication endpoints
    path('api/auth/signup/', views.signup_view, name='signup'),
    path('api/auth/login/', views.login_view, name='login'),
    path('api/auth/logout/', views.logout_view, name='logout'),
    path('api/auth/me/', views.me_view, name='me'),
    path('api/auth/guest/', views.guest_login_view, name='guest_login'),
    path("health/", views.health_check, name="health_check"),
    
    # Project endpoints
    path('api/process-prompt/', views.process_prompt, name='process_prompt'),
    path('api/projects/', views.create_project, name='create_project'),  # POST
    path('api/projects/list/', views.list_projects, name='list_projects'),  # GET
    path('api/projects/<str:room>/', views.get_project, name='get_project'),  # GET
    path('api/projects/<str:room>/delete/', views.delete_project, name='delete_project'),  # DELETE
    path('api/projects/<str:room>/download_pdf/', views.download_project_pdf, name='download_project_pdf'),
    path('api/projects/<str:room>/commit/', views.commit_version, name='commit_version'),
    path('api/projects/<str:room>/versions/', views.list_versions_view, name='list_versions'),
    path('api/projects/<str:room>/versions/<str:version_id>/', views.get_version_view, name='get_version'),
    path('api/projects/<str:room>/ai_prompt_commit/', views.ai_prompt_commit, name='ai_prompt_commit'),
]
