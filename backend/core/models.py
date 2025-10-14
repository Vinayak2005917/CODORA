from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.

class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    Adds additional fields for user profile and preferences.
    """
    bio = models.TextField(max_length=500, blank=True)
    avatar_color = models.CharField(max_length=7, default='#5eb3f6')  # Default purple
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.username
    
    class Meta:
        db_table = 'users'
