import json
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.test import TestCase, override_settings

from accounts.auth import create_access_token, create_refresh_token
from accounts.github import GitHubAPIError

from .models import UserProfile


class AuthenticationCookieTests(TestCase):
    def test_login_sets_http_only_access_and_refresh_cookies(self):
        user_model = get_user_model()
        user_model.objects.create_user(
            username="cookie-user",
            email="cookie-user@example.com",
            password="test-password-123",
        )

        response = self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "identifier": "cookie-user",
                    "password": "test-password-123",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotIn("accessToken", payload)
        self.assertEqual(payload["user"]["username"], "cookie-user")

        access_cookie = response.cookies[settings.AUTH_ACCESS_COOKIE_NAME]
        refresh_cookie = response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]
        self.assertTrue(access_cookie["httponly"])
        self.assertTrue(refresh_cookie["httponly"])
        self.assertEqual(
            int(access_cookie["max-age"]),
            settings.ACCESS_TOKEN_LIFETIME_SECONDS,
        )
        self.assertEqual(
            int(refresh_cookie["max-age"]),
            settings.REFRESH_TOKEN_LIFETIME_SECONDS,
        )

    def test_expired_access_cookie_is_refreshed_from_refresh_cookie(self):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username="refresh-user",
            email="refresh-user@example.com",
            password="test-password-123",
        )

        with override_settings(ACCESS_TOKEN_LIFETIME_SECONDS=-1):
            expired_access_token = create_access_token(user.id)

        self.client.cookies[settings.AUTH_ACCESS_COOKIE_NAME] = expired_access_token
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = create_refresh_token(
            user.id
        )

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "refresh-user")
        self.assertIn(settings.AUTH_ACCESS_COOKIE_NAME, response.cookies)
        self.assertNotEqual(
            response.cookies[settings.AUTH_ACCESS_COOKIE_NAME].value,
            expired_access_token,
        )

    def test_logout_clears_auth_cookies(self):
        user_model = get_user_model()
        user_model.objects.create_user(
            username="logout-user",
            email="logout-user@example.com",
            password="test-password-123",
        )

        self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "identifier": "logout-user",
                    "password": "test-password-123",
                }
            ),
            content_type="application/json",
        )

        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            int(response.cookies[settings.AUTH_ACCESS_COOKIE_NAME]["max-age"]),
            0,
        )
        self.assertEqual(
            int(response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]["max-age"]),
            0,
        )


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
