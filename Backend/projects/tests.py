from datetime import timedelta
from itertools import islice

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.auth import create_access_token

from .models import Organization, Project, ProjectMembership


@override_settings(
    PROJECT_EVENTS_POLL_INTERVAL_SECONDS=0.01,
    PROJECT_EVENTS_STREAM_MAX_SECONDS=0.03,
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
    def _collect_chunks(response, count: int) -> str:
        chunks: list[str] = []
        for chunk in islice(response.streaming_content, count):
            chunks.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
        return "".join(chunks)

    def test_stream_opens_without_emitting_project_updated_when_unchanged(self):
        response = self._open_stream()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")

        payload = self._collect_chunks(response, 3)

        self.assertIn("retry: 2000", payload)
        self.assertIn("event: stream.open", payload)
        self.assertNotIn("event: project.updated", payload)

    def test_stream_emits_project_updated_after_project_timestamp_changes(self):
        response = self._open_stream()
        iterator = iter(response.streaming_content)

        next(iterator)
        next(iterator)

        Project.objects.filter(id=self.project.id).update(updated_at=timezone.now() + timedelta(seconds=1))

        payload_parts: list[str] = []
        for chunk in islice(iterator, 5):
            payload_parts.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
            if "event: project.updated" in payload_parts[-1]:
                break

        payload = "".join(payload_parts)
        self.assertIn("event: project.updated", payload)
