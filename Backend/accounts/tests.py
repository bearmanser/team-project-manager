import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.test import TestCase

from accounts.auth import create_access_token
from accounts.github import GitHubAPIError

from .models import UserProfile


class GitHubDisconnectTests(TestCase):
    def test_disconnect_clears_github_profile_fields(self):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username="github-user",
            email="github-user@example.com",
            password="test-password-123",
        )
        profile = UserProfile.objects.create(
            user=user,
            github_user_id="12345",
            github_username="octocat",
            github_avatar_url="https://avatars.githubusercontent.com/u/583231?v=4",
            github_access_token="secret-token",
        )

        response = self.client.post(
            "/api/github/disconnect/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {create_access_token(user.id)}",
        )

        self.assertEqual(response.status_code, 200)

        profile.refresh_from_db()
        self.assertIsNone(profile.github_user_id)
        self.assertEqual(profile.github_username, "")
        self.assertEqual(profile.github_avatar_url, "")
        self.assertEqual(profile.github_access_token, "")
        self.assertIsNone(profile.github_connected_at)

        payload = response.json()
        self.assertFalse(payload["user"]["githubConnected"])
        self.assertEqual(payload["user"]["githubUsername"], "")
        self.assertEqual(payload["user"]["githubAvatarUrl"], "")


class GitHubOauthCompleteTests(TestCase):
    def test_complete_succeeds_even_when_repo_fetch_fails(self):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username="oauth-user",
            email="oauth-user@example.com",
            password="test-password-123",
        )
        state = signing.dumps(
            {
                "user_id": user.id,
                "nonce": "test-nonce",
            },
            salt="github-oauth-state",
        )

        with patch("accounts.views.exchange_code_for_access_token", return_value="oauth-token"), patch(
            "accounts.views.get_github_user",
            return_value={"id": 42, "login": "octocat", "avatar_url": "https://example.com/avatar.png"},
        ), patch(
            "accounts.views.get_github_repositories",
            side_effect=GitHubAPIError("Bad credentials", 401),
        ):
            response = self.client.post(
                "/api/github/oauth/complete/",
                data=json.dumps({"code": "oauth-code", "state": state}),
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {create_access_token(user.id)}",
            )

        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertTrue(payload["user"]["githubConnected"])
        self.assertEqual(payload["repos"], [])
        self.assertEqual(payload["githubRepoError"], "Bad credentials")

        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.github_access_token, "oauth-token")
        self.assertEqual(profile.github_username, "octocat")
