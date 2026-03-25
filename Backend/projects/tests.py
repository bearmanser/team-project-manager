import json
from datetime import timedelta

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.auth import create_access_token

from .models import (
    LEGACY_PERSONAL_ORGANIZATION_DESCRIPTION,
    Notification,
    Organization,
    OrganizationMembership,
    Project,
    ProjectMembership,
    Task,
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


class OrganizationMembershipInviteTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            username="owner-user",
            email="owner@example.com",
            password="test-password-123",
        )
        self.admin = user_model.objects.create_user(
            username="admin-user",
            email="admin@example.com",
            password="test-password-123",
        )
        self.second_admin = user_model.objects.create_user(
            username="admin-two",
            email="admin-two@example.com",
            password="test-password-123",
        )
        self.member = user_model.objects.create_user(
            username="member-user",
            email="member@example.com",
            password="test-password-123",
        )
        self.viewer = user_model.objects.create_user(
            username="viewer-user",
            email="viewer@example.com",
            password="test-password-123",
        )
        self.invited = user_model.objects.create_user(
            username="invited-user",
            email="invited@example.com",
            password="test-password-123",
        )
        self.organization = Organization.objects.create(
            name="Shared Org",
            description="",
            owner=self.owner,
        )
        self.project = Project.objects.create(
            name="Shared Project",
            description="",
            organization=self.organization,
            owner=self.owner,
        )

        for user, role in [
            (self.owner, OrganizationMembership.ROLE_OWNER),
            (self.admin, OrganizationMembership.ROLE_ADMIN),
            (self.second_admin, OrganizationMembership.ROLE_ADMIN),
            (self.member, OrganizationMembership.ROLE_MEMBER),
            (self.viewer, OrganizationMembership.ROLE_VIEWER),
        ]:
            OrganizationMembership.objects.create(
                organization=self.organization,
                user=user,
                role=role,
                status=OrganizationMembership.STATUS_ACTIVE,
                invited_by=self.owner,
            )

        for user, role in [
            (self.owner, ProjectMembership.ROLE_OWNER),
            (self.admin, ProjectMembership.ROLE_ADMIN),
            (self.second_admin, ProjectMembership.ROLE_ADMIN),
            (self.member, ProjectMembership.ROLE_MEMBER),
            (self.viewer, ProjectMembership.ROLE_VIEWER),
        ]:
            ProjectMembership.objects.create(
                project=self.project,
                user=user,
                role=role,
                status=ProjectMembership.STATUS_ACTIVE,
                added_by=self.owner,
            )

        self.owner_token = create_access_token(self.owner.id)
        self.admin_token = create_access_token(self.admin.id)
        self.member_token = create_access_token(self.member.id)
        self.viewer_token = create_access_token(self.viewer.id)
        self.invited_token = create_access_token(self.invited.id)

    def test_invited_user_stays_pending_until_acceptance(self):
        invite_response = self.client.post(
            f"/api/organizations/{self.organization.id}/members/",
            data=json.dumps({"identifier": self.invited.username, "role": "member"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.owner_token}",
        )

        self.assertEqual(invite_response.status_code, 201)
        organization_membership = OrganizationMembership.objects.get(
            organization=self.organization,
            user=self.invited,
        )
        project_membership = ProjectMembership.objects.get(
            project=self.project,
            user=self.invited,
        )
        notification = Notification.objects.get(
            recipient=self.invited,
            organization=self.organization,
            kind=Notification.KIND_INVITE,
        )

        self.assertEqual(organization_membership.status, OrganizationMembership.STATUS_INVITED)
        self.assertEqual(project_membership.status, ProjectMembership.STATUS_INVITED)
        self.assertEqual(
            notification.metadata["organizationMembershipId"],
            organization_membership.id,
        )

        pending_workspace = self.client.get(
            "/api/workspace/",
            HTTP_AUTHORIZATION=f"Bearer {self.invited_token}",
        )
        pending_payload = pending_workspace.json()
        self.assertNotIn(
            self.organization.id,
            [item["id"] for item in pending_payload["organizations"]],
        )
        self.assertNotIn(
            self.project.id,
            [item["id"] for item in pending_payload["projects"]],
        )

        accept_response = self.client.post(
            f"/api/notifications/{notification.id}/accept/",
            HTTP_AUTHORIZATION=f"Bearer {self.invited_token}",
        )

        self.assertEqual(accept_response.status_code, 200)
        organization_membership.refresh_from_db()
        project_membership.refresh_from_db()
        notification.refresh_from_db()
        self.assertEqual(organization_membership.status, OrganizationMembership.STATUS_ACTIVE)
        self.assertEqual(project_membership.status, ProjectMembership.STATUS_ACTIVE)
        self.assertTrue(notification.is_read)

        accepted_workspace = self.client.get(
            "/api/workspace/",
            HTTP_AUTHORIZATION=f"Bearer {self.invited_token}",
        )
        accepted_payload = accepted_workspace.json()
        self.assertIn(
            self.organization.id,
            [item["id"] for item in accepted_payload["organizations"]],
        )
        self.assertIn(
            self.project.id,
            [item["id"] for item in accepted_payload["projects"]],
        )

    def test_viewer_can_open_users_list(self):
        response = self.client.get(
            f"/api/organizations/{self.organization.id}/members/",
            HTTP_AUTHORIZATION=f"Bearer {self.viewer_token}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            {item["user"]["username"] for item in payload["members"]},
            {
                self.owner.username,
                self.admin.username,
                self.second_admin.username,
                self.member.username,
                self.viewer.username,
            },
        )

    def test_admin_cannot_change_or_remove_owner_or_other_admin(self):
        role_response = self.client.post(
            f"/api/organizations/{self.organization.id}/members/{OrganizationMembership.objects.get(organization=self.organization, user=self.second_admin).id}/role/",
            data=json.dumps({"role": "member"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )
        remove_response = self.client.post(
            f"/api/organizations/{self.organization.id}/members/{OrganizationMembership.objects.get(organization=self.organization, user=self.owner).id}/remove/",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )

        self.assertEqual(role_response.status_code, 403)
        self.assertEqual(remove_response.status_code, 403)

    def test_admin_can_edit_org_details_and_member_can_leave(self):
        rename_response = self.client.post(
            f"/api/organizations/{self.organization.id}/settings/",
            data=json.dumps({"name": "Renamed Org"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )

        self.assertEqual(rename_response.status_code, 200)
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.name, "Renamed Org")

        leave_response = self.client.post(
            f"/api/organizations/{self.organization.id}/leave/",
            HTTP_AUTHORIZATION=f"Bearer {self.member_token}",
        )

        self.assertEqual(leave_response.status_code, 200)
        self.assertFalse(
            OrganizationMembership.objects.filter(
                organization=self.organization,
                user=self.member,
            ).exists()
        )
        self.assertFalse(
            ProjectMembership.objects.filter(
                project=self.project,
                user=self.member,
            ).exists()
        )

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


class TaskNotificationTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            username="task-owner",
            email="task-owner@example.com",
            password="test-password-123",
        )
        self.assignee = user_model.objects.create_user(
            username="task-assignee",
            email="task-assignee@example.com",
            password="test-password-123",
        )
        self.commenter = user_model.objects.create_user(
            username="task-commenter",
            email="task-commenter@example.com",
            password="test-password-123",
        )
        self.organization = Organization.objects.create(
            name="Delivery Org",
            description="",
            owner=self.owner,
        )
        self.project = Project.objects.create(
            name="Delivery Project",
            description="",
            organization=self.organization,
            owner=self.owner,
        )
        for user, role in [
            (self.owner, ProjectMembership.ROLE_OWNER),
            (self.assignee, ProjectMembership.ROLE_MEMBER),
            (self.commenter, ProjectMembership.ROLE_MEMBER),
        ]:
            ProjectMembership.objects.create(
                project=self.project,
                user=user,
                role=role,
                status=ProjectMembership.STATUS_ACTIVE,
                added_by=self.owner,
            )

        self.owner_token = create_access_token(self.owner.id)
        self.commenter_token = create_access_token(self.commenter.id)
        self.task = Task.objects.create(
            project=self.project,
            title="Ship assignee updates",
            description="",
            status=Task.STATUS_TODO,
            priority=Task.PRIORITY_MEDIUM,
            creator=self.owner,
        )

    def test_assigning_a_task_notifies_the_new_assignee(self):
        response = self.client.post(
            f"/api/tasks/{self.task.id}/update/",
            data=json.dumps({"assigneeIds": [self.assignee.id]}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.owner_token}",
        )

        self.assertEqual(response.status_code, 200)
        notification = Notification.objects.get(
            recipient=self.assignee,
            task=self.task,
            kind=Notification.KIND_ASSIGNMENT,
        )
        self.assertEqual(notification.actor, self.owner)
        self.assertEqual(
            notification.message,
            f'{self.owner.username} assigned you to task "{self.task.title}".',
        )

    def test_commenting_on_assigned_task_notifies_the_assignee(self):
        self.task.assignees.set([self.assignee])

        response = self.client.post(
            f"/api/tasks/{self.task.id}/comments/",
            data=json.dumps({"body": "Please review the latest update."}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.commenter_token}",
        )

        self.assertEqual(response.status_code, 200)
        notification = Notification.objects.get(
            recipient=self.assignee,
            task=self.task,
            kind=Notification.KIND_SYSTEM,
        )
        self.assertEqual(notification.actor, self.commenter)
        self.assertEqual(
            notification.message,
            f'{self.commenter.username} commented on task "{self.task.title}" that you are assigned to.',
        )



