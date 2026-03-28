from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.auth import jwt_required

from ..models import Notification, OrganizationMembership
from ..serializers import serialize_notification
from ..services import activate_organization_invite, close_related_notifications_for_user
from ..utils import json_error, parse_json_body


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def notification_accept_view(request, notification_id: int):
    notification = (
        Notification.objects.filter(id=notification_id, recipient=request.user)
        .select_related("organization")
        .first()
    )
    if notification is None:
        return json_error("Notification not found.", 404)
    if notification.kind != Notification.KIND_INVITE or notification.organization_id is None:
        return json_error("This notification cannot be accepted.", 409)

    membership_id = notification.metadata.get("organizationMembershipId")
    invite = OrganizationMembership.objects.filter(
        id=membership_id,
        organization_id=notification.organization_id,
        user=request.user,
        status=OrganizationMembership.STATUS_INVITED,
    ).first()
    if invite is None:
        return json_error("This invite is no longer available.", 404)

    activate_organization_invite(invite, notification)
    return JsonResponse({"notification": serialize_notification(notification)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def notification_read_view(request, notification_id: int):
    notification = Notification.objects.filter(id=notification_id, recipient=request.user).first()
    if notification is None:
        return json_error("Notification not found.", 404)

    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return JsonResponse({"notification": serialize_notification(notification)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def notification_close_related_view(request):
    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    task_id = payload.get("taskId")
    bug_report_id = payload.get("bugReportId")
    if task_id is None and bug_report_id is None:
        return json_error("Choose a related task or bug notification target.")

    try:
        resolved_task_id = int(task_id) if task_id is not None else None
        resolved_bug_report_id = int(bug_report_id) if bug_report_id is not None else None
    except (TypeError, ValueError):
        return json_error("Choose a valid related task or bug notification target.")

    closed_notification_ids = close_related_notifications_for_user(
        request.user,
        task_id=resolved_task_id,
        bug_report_id=resolved_bug_report_id,
    )
    return JsonResponse({"closedNotificationIds": closed_notification_ids})
