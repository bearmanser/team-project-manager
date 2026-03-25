from django.db import migrations, models
import django.db.models.deletion


ROLE_ORDER = {
    "viewer": 0,
    "member": 1,
    "admin": 2,
    "owner": 3,
}


def backfill_organization_memberships(apps, schema_editor):
    Organization = apps.get_model("projects", "Organization")
    OrganizationMembership = apps.get_model("projects", "OrganizationMembership")
    ProjectMembership = apps.get_model("projects", "ProjectMembership")

    for organization in Organization.objects.all().iterator():
        OrganizationMembership.objects.update_or_create(
            organization_id=organization.id,
            user_id=organization.owner_id,
            defaults={
                "role": "owner",
                "status": "active",
                "invited_by_id": organization.owner_id,
            },
        )

        memberships = ProjectMembership.objects.filter(project__organization_id=organization.id).order_by("id")
        for membership in memberships.iterator():
            existing = OrganizationMembership.objects.filter(
                organization_id=organization.id,
                user_id=membership.user_id,
            ).first()
            next_role = "owner" if membership.user_id == organization.owner_id else membership.role
            defaults = {
                "role": next_role,
                "status": "active",
                "invited_by_id": membership.added_by_id or organization.owner_id,
            }
            if existing is None:
                OrganizationMembership.objects.create(
                    organization_id=organization.id,
                    user_id=membership.user_id,
                    **defaults,
                )
                continue

            update_fields = []
            if ROLE_ORDER.get(next_role, -1) > ROLE_ORDER.get(existing.role, -1):
                existing.role = next_role
                update_fields.append("role")
            if existing.status != "active":
                existing.status = "active"
                update_fields.append("status")
            if existing.invited_by_id is None and defaults["invited_by_id"] is not None:
                existing.invited_by_id = defaults["invited_by_id"]
                update_fields.append("invited_by_id")
            if update_fields:
                existing.save(update_fields=[*update_fields, "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0007_personal_organization"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrganizationMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("owner", "Owner"), ("admin", "Admin"), ("member", "Member"), ("viewer", "Viewer")], default="member", max_length=16)),
                ("status", models.CharField(choices=[("invited", "Invited"), ("active", "Active")], default="active", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="projects.organization")),
                ("invited_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_organization_memberships", to="auth.user")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="organization_memberships", to="auth.user")),
            ],
            options={
                "ordering": ["user__username", "id"],
                "unique_together": {("organization", "user")},
            },
        ),
        migrations.AddField(
            model_name="projectmembership",
            name="status",
            field=models.CharField(choices=[("invited", "Invited"), ("active", "Active")], default="active", max_length=16),
        ),
        migrations.AddField(
            model_name="notification",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="notification",
            name="organization",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="projects.organization"),
        ),
        migrations.RunPython(backfill_organization_memberships, migrations.RunPython.noop),
    ]
