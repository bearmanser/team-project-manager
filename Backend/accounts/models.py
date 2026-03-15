from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    github_user_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    github_username = models.CharField(max_length=255, blank=True)
    github_avatar_url = models.URLField(blank=True)
    github_access_token = models.TextField(blank=True)
    github_connected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Profile<{self.user.username}>"
