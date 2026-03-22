import json
from datetime import timedelta

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.auth import create_access_token

from .models import (
    LEGACY_PERSONAL_ORGANIZATION_DESCRIPTION,
    Organization,
    Project,
    ProjectMembership,
)


class PersonalOrganizationTests(TestCase):
    def test_signup_creates_personal_organization(self):
        response = self.client.post(
            "/api/auth/signup/",
            data=json.dumps(
                {
                    "username": "account-owner",
                    "email": "account-owner@example.com",
                    "password": "test-password-123",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        user_model = get_user_model()
        user = user_model.objects.get(username="account-owner")
        organizations = Organization.objects.filter(owner=user)

        self.assertEqual(organizations.count(), 1)
        self.assertTrue(organizations.get().is_personal)

    def test_workspace_promotes_legacy_default_workspace_to_personal(self):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username="legacy-owner",
            email="legacy-owner@example.com",
            password="test-password-123",
        )
        legacy_organization = Organization.objects.create(
            name=f"{user.username} organization",
            description=LEGACY_PERSONAL_ORGANIZATION_DESCRIPTION,
            owner=user,
        )
        token = create_access_token(user.id)

        response = self.client.get(
            "/api/workspace/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        self.assertEqual(response.status_code, 200)
        legacy_organization.refresh_from_db()
        self.assertTrue(legacy_organization.is_personal)
        self.assertEqual(legacy_organization.name, f"{user.username} workspace")

        payload = response.json()
        self.assertEqual(len(payload["organizations"]), 1)
        self.assertTrue(payload["organizations"][0]["isPersonal"])
        self.assertEqual(payload["organizations"][0]["displayName"], user.username)
    def test_personal_workspace_project_rejects_member_invites(self):
        user_model = get_user_model()
        owner = user_model.objects.create_user(
            username="solo-owner",
            email="solo-owner@example.com",
            password="test-password-123",
        )
        invited_user = user_model.objects.create_user(
            username="teammate",
            email="teammate@example.com",
            password="test-password-123",
        )
        personal_organization = Organization.objects.create(
            name=f"{owner.username} workspace",
            description="Your personal workspace.",
            owner=owner,
            is_personal=True,
        )
        project = Project.objects.create(
            name="Solo Project",
            description="",
            organization=personal_organization,
            owner=owner,
        )
        ProjectMembership.objects.create(
            project=project,
            user=owner,
            role=ProjectMembership.ROLE_OWNER,
            added_by=owner,
        )

        response = self.client.post(
            f"/api/projects/{project.id}/members/",
            data=json.dumps({"identifier": invited_user.username, "role": "member"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {create_access_token(owner.id)}",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["error"],
            "Personal workspaces do not support sharing projects.",
        )

class OrganizationSettingsTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            username="org-owner",
            email="org-owner@example.com",
            password="test-password-123",
        )
        self.shared_organization = Organization.objects.create(
            name="Client Work",
            description="",
            owner=self.owner,
        )
        self.personal_organization = Organization.objects.create(
            name=f"{self.owner.username} workspace",
            description="Your personal workspace.",
            owner=self.owner,
            is_personal=True,
        )
        self.token = create_access_token(self.owner.id)

    def test_owner_can_rename_organization(self):
        response = self.client.post(
            f"/api/organizations/{self.shared_organization.id}/settings/",
            data=json.dumps({"name": "Agency Team"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )

        self.assertEqual(response.status_code, 200)
        self.shared_organization.refresh_from_db()
        self.assertEqual(self.shared_organization.name, "Agency Team")
        self.assertEqual(response.json()["organization"]["name"], "Agency Team")

    def test_owner_can_delete_shared_organization(self):
        response = self.client.post(
            f"/api/organizations/{self.shared_organization.id}/delete/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"success": True, "organizationId": self.shared_organization.id},
        )
        self.assertFalse(Organization.objects.filter(id=self.shared_organization.id).exists())

    def test_personal_organization_cannot_be_deleted(self):
        response = self.client.post(
            f"/api/organizations/{self.personal_organization.id}/delete/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "Personal workspaces cannot be deleted.")
        self.assertTrue(Organization.objects.filter(id=self.personal_organization.id).exists())

@override_settings(
    PROJECT_EVENTS_POLL_INTERVAL_SECONDS=0.01,
)
class ProjectEventsViewTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="stream-owner",
            email="stream-owner@example.com",
            password="test-password-123",
        )
        self.organization = Organization.objects.create(
            name="Streaming Org",
            description="",
            owner=self.user,
        )
        self.project = Project.objects.create(
            name="Streaming Project",
            description="",
            organization=self.organization,
            owner=self.user,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.user,
            role=ProjectMembership.ROLE_OWNER,
            added_by=self.user,
        )
        self.token = create_access_token(self.user.id)

    def _open_stream(self):
        return self.client.get(f"/api/projects/{self.project.id}/events/?token={self.token}")

    @staticmethod
    async def _collect_chunks(stream, count: int) -> str:
        chunks: list[str] = []
        async for chunk in stream:
            chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
            if len(chunks) >= count:
                break
        return "".join(chunks)

    def test_stream_opens_without_emitting_project_updated_when_unchanged(self):
        response = self._open_stream()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")

        stream = response.streaming_content
        payload = async_to_sync(self._collect_chunks)(stream, 3)

        self.assertIn("retry: 2000", payload)
        self.assertIn("event: stream.open", payload)
        self.assertNotIn("event: project.updated", payload)

    def test_stream_emits_project_updated_after_project_timestamp_changes(self):
        response = self._open_stream()
        stream = response.streaming_content

        Project.objects.filter(id=self.project.id).update(updated_at=timezone.now() + timedelta(seconds=1))

        payload = async_to_sync(self._collect_chunks)(stream, 6)
        self.assertIn("event: project.updated", payload)



