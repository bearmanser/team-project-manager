from django.db import migrations, models
import django.db.models.deletion


def seed_organizations(apps, schema_editor):
    Organization = apps.get_model("projects", "Organization")
    Project = apps.get_model("projects", "Project")

    organizations_by_owner = {}
    for project in Project.objects.select_related("owner").all().order_by("owner_id", "id"):
        organization_id = organizations_by_owner.get(project.owner_id)
        if organization_id is None:
            organization, _ = Organization.objects.get_or_create(
                owner_id=project.owner_id,
                name=f"{project.owner.username} organization",
                defaults={
                    "description": "Default workspace created for existing projects.",
                },
            )
            organization_id = organization.id
            organizations_by_owner[project.owner_id] = organization_id

        project.organization_id = organization_id
        project.save(update_fields=["organization"])


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="owned_organizations",
                        to="auth.user",
                    ),
                ),
            ],
            options={"ordering": ["name", "id"]},
        ),
        migrations.AddField(
            model_name="project",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="projects",
                to="projects.organization",
            ),
        ),
        migrations.RunPython(seed_organizations, migrations.RunPython.noop),
    ]
