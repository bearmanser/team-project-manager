from django.db import migrations, models
from django.db.models import Count


def keep_one_repository_per_project(apps, schema_editor):
    ProjectRepository = apps.get_model("projects", "ProjectRepository")

    duplicate_project_ids = (
        ProjectRepository.objects.values("project_id")
        .annotate(repository_count=Count("id"))
        .filter(repository_count__gt=1)
    )

    for entry in duplicate_project_ids.iterator():
        repositories = list(
            ProjectRepository.objects.filter(project_id=entry["project_id"]).order_by("created_at", "id")
        )
        for repository in repositories[1:]:
            repository.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0005_bugcommentreaction_taskcommentreaction"),
    ]

    operations = [
        migrations.RunPython(keep_one_repository_per_project, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name="projectrepository",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="projectrepository",
            constraint=models.UniqueConstraint(
                fields=("project",),
                name="projects_single_repository_per_project",
            ),
        ),
    ]

