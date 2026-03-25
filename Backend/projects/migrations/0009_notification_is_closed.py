from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0008_organization_memberships_and_invites"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="is_closed",
            field=models.BooleanField(default=False),
        ),
    ]
