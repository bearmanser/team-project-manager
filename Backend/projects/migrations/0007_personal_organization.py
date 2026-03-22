from django.db import migrations, models
from django.db.models import Q


LEGACY_PERSONAL_ORGANIZATION_DESCRIPTION = "Default workspace created for existing projects."
PERSONAL_ORGANIZATION_DESCRIPTION = "Your personal workspace."


def build_personal_organization_name(user) -> str:
    return f"{user.username} workspace"


def create_personal_organizations(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Organization = apps.get_model("projects", "Organization")

    for user in User.objects.all().iterator():
        personal = (
            Organization.objects.filter(owner_id=user.id, is_personal=True)
            .order_by("id")
            .first()
        )
        if personal is not None:
            continue

        legacy_organization = (
            Organization.objects.filter(
                owner_id=user.id,
                name=f"{user.username} organization",
                description=LEGACY_PERSONAL_ORGANIZATION_DESCRIPTION,
            )
            .order_by("id")
            .first()
        )
        if legacy_organization is not None:
            legacy_organization.name = build_personal_organization_name(user)
            legacy_organization.description = PERSONAL_ORGANIZATION_DESCRIPTION
            legacy_organization.is_personal = True
            legacy_organization.save(update_fields=["name", "description", "is_personal", "updated_at"])
            continue

        Organization.objects.create(
            owner_id=user.id,
            name=build_personal_organization_name(user),
            description=PERSONAL_ORGANIZATION_DESCRIPTION,
            is_personal=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0006_single_repository_per_project"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="is_personal",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(create_personal_organizations, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="organization",
            constraint=models.UniqueConstraint(
                fields=("owner",),
                condition=Q(is_personal=True),
                name="projects_single_personal_organization_per_owner",
            ),
        ),
    ]

