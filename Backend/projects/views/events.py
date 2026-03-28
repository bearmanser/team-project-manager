import asyncio
import json

from django.http import StreamingHttpResponse
from django.views.decorators.http import require_GET

from accounts.auth import jwt_required

from ..models import Project
from ..services import load_project
from ..utils import get_project_events_poll_interval_seconds, get_project_events_retry_ms


@require_GET
@jwt_required
def project_events_view(request, project_id: int):
    project, _, error = load_project(project_id, request.user)
    if error:
        return error

    retry_ms = get_project_events_retry_ms()
    poll_interval_seconds = get_project_events_poll_interval_seconds()

    async def event_stream():
        last_seen = project.updated_at.isoformat()
        yield f"retry: {retry_ms}\n\n"
        yield f"event: stream.open\ndata: {json.dumps({'updatedAt': last_seen})}\n\n"
        while True:
            await asyncio.sleep(poll_interval_seconds)
            current_project = await Project.objects.filter(id=project.id).only("updated_at").afirst()
            if current_project is None:
                yield "event: project.deleted\ndata: {}\n\n"
                break
            current_stamp = current_project.updated_at.isoformat()
            if current_stamp != last_seen:
                last_seen = current_stamp
                yield f"event: project.updated\ndata: {json.dumps({'updatedAt': current_stamp})}\n\n"
            else:
                yield ": keepalive\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
