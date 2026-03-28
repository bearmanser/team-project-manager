from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.auth import jwt_required

from ..models import Notification, Organization, OrganizationMembership
from ..serializers import serialize_organization_member, serialize_organization_summary
from ..services import (
    can_manage_target_organization_membership,
    invite_user_to_organization,
    load_manageable_organization,
    load_organization,
    load_owned_organization,
    remove_organization_membership_from_projects,
    sync_organization_membership_to_projects,
)
from ..utils import json_error, parse_json_body


User = get_user_model()


def _organization_members_response(organization: Organization, status: int = 200) -> JsonResponse:
    members = OrganizationMembership.objects.filter(organization=organization).select_related("user")
    return JsonResponse(
        {"members": [serialize_organization_member(item) for item in members]},
        status=status,
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def organizations_view(request):
    if request.method == "GET":
        from ..services import accessible_organizations

        return JsonResponse(
            {
                "organizations": [
                    serialize_organization_summary(organization, request.user)
                    for organization in accessible_organizations(request.user)
                ]
            }
        )

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    name = (payload.get("name") or "").strip()
    description = (payload.get("description") or "").strip()
    if not name:
        return json_error("Organization name is required.")

    organization = Organization.objects.create(
        name=name,
        description=description,
        owner=request.user,
    )
    OrganizationMembership.objects.update_or_create(
        organization=organization,
        user=request.user,
        defaults={
            "role": OrganizationMembership.ROLE_OWNER,
            "status": OrganizationMembership.STATUS_ACTIVE,
            "invited_by": request.user,
        },
    )
    return JsonResponse(
        {"organization": serialize_organization_summary(organization, request.user)},
        status=201,
    )


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_settings_view(request, organization_id: int):
    organization, membership, error = load_organization(organization_id, request.user)
    if error:
        return error
    if organization.is_personal:
        return json_error("Personal workspaces cannot be edited here.", 403)
    if membership.role not in {OrganizationMembership.ROLE_OWNER, OrganizationMembership.ROLE_ADMIN}:
        return json_error("Only admins and owners can edit organization details.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    name = (payload.get("name") or "").strip()
    if not name:
        return json_error("Organization name is required.")

    if name != organization.name:
        organization.name = name
        organization.save(update_fields=["name", "updated_at"])

    return JsonResponse({"organization": serialize_organization_summary(organization, request.user)})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_delete_view(request, organization_id: int):
    organization, error = load_owned_organization(organization_id, request.user)
    if error:
        return error
    if organization.is_personal:
        return json_error("Personal workspaces cannot be deleted.", 403)

    deleted_organization_id = organization.id
    organization.delete()
    return JsonResponse({"success": True, "organizationId": deleted_organization_id})


@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def organization_members_view(request, organization_id: int):
    if request.method == "GET":
        organization, _, error = load_organization(organization_id, request.user)
        if error:
            return error
        return _organization_members_response(organization)

    organization, membership, error = load_manageable_organization(organization_id, request.user)
    if error:
        return error

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    identifier = (payload.get("identifier") or "").strip()
    role = (payload.get("role") or OrganizationMembership.ROLE_MEMBER).strip()
    if not identifier:
        return json_error("Provide a username or email address.")
    if role not in {
        OrganizationMembership.ROLE_ADMIN,
        OrganizationMembership.ROLE_MEMBER,
        OrganizationMembership.ROLE_VIEWER,
    }:
        return json_error("Choose a valid organization role.")
    if membership.role == OrganizationMembership.ROLE_ADMIN and role == OrganizationMembership.ROLE_ADMIN:
        return json_error("Only the organization owner can invite another admin.", 403)

    if "@" in identifier:
        user = User.objects.filter(email__iexact=identifier).first()
    else:
        user = User.objects.filter(username__iexact=identifier).first()
    if user is None:
        return json_error("That user does not exist yet.", 404)

    existing_membership = OrganizationMembership.objects.filter(organization=organization, user=user).first()
    if existing_membership is not None:
        if existing_membership.status == OrganizationMembership.STATUS_INVITED:
            return json_error("That user already has a pending invite.", 409)
        return json_error("That user is already part of this organization.", 409)

    invite_user_to_organization(organization, request.user, user, role)
    return _organization_members_response(organization, status=201)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_member_role_view(request, organization_id: int, membership_id: int):
    organization, actor_membership, error = load_manageable_organization(organization_id, request.user)
    if error:
        return error

    target_membership = (
        OrganizationMembership.objects.filter(organization=organization, id=membership_id)
        .select_related("user", "invited_by")
        .first()
    )
    if target_membership is None:
        return json_error("Organization member not found.", 404)
    if target_membership.role == OrganizationMembership.ROLE_OWNER:
        return json_error("The organization owner role cannot be reassigned here.", 403)
    if not can_manage_target_organization_membership(actor_membership, target_membership):
        return json_error("You do not have permission to change that role.", 403)

    try:
        payload = parse_json_body(request)
    except ValueError as exc:
        return json_error(str(exc))

    next_role = (payload.get("role") or "").strip()
    if next_role not in {
        OrganizationMembership.ROLE_ADMIN,
        OrganizationMembership.ROLE_MEMBER,
        OrganizationMembership.ROLE_VIEWER,
    }:
        return json_error("Choose a valid organization role.")
    if actor_membership.role == OrganizationMembership.ROLE_ADMIN and next_role == OrganizationMembership.ROLE_ADMIN:
        return json_error("Only the organization owner can assign the admin role.", 403)

    target_membership.role = next_role
    target_membership.save(update_fields=["role", "updated_at"])
    sync_organization_membership_to_projects(target_membership)

    return _organization_members_response(organization)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_member_remove_view(request, organization_id: int, membership_id: int):
    organization, actor_membership, error = load_manageable_organization(organization_id, request.user)
    if error:
        return error

    target_membership = OrganizationMembership.objects.filter(organization=organization, id=membership_id).first()
    if target_membership is None:
        return json_error("Organization member not found.", 404)
    if target_membership.role == OrganizationMembership.ROLE_OWNER:
        return json_error("The organization owner cannot be removed.", 403)
    if target_membership.user_id == request.user.id:
        return json_error("Use leave organization instead of removing yourself.", 400)
    if not can_manage_target_organization_membership(actor_membership, target_membership):
        return json_error("You do not have permission to remove that user.", 403)

    remove_organization_membership_from_projects(organization, target_membership.user_id)
    target_membership.delete()
    return JsonResponse({"success": True})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_member_cancel_view(request, organization_id: int, membership_id: int):
    organization, actor_membership, error = load_manageable_organization(organization_id, request.user)
    if error:
        return error

    target_membership = OrganizationMembership.objects.filter(organization=organization, id=membership_id).first()
    if target_membership is None:
        return json_error("Organization member not found.", 404)
    if target_membership.status != OrganizationMembership.STATUS_INVITED:
        return json_error("That invite has already been accepted.", 409)
    if not can_manage_target_organization_membership(actor_membership, target_membership):
        return json_error("You do not have permission to cancel that invite.", 403)

    Notification.objects.filter(
        recipient=target_membership.user,
        organization=organization,
        kind=Notification.KIND_INVITE,
        metadata__organizationMembershipId=target_membership.id,
    ).update(is_read=True)
    remove_organization_membership_from_projects(organization, target_membership.user_id)
    target_membership.delete()
    return JsonResponse({"success": True})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def organization_leave_view(request, organization_id: int):
    organization, membership, error = load_organization(organization_id, request.user)
    if error:
        return error
    if membership.role == OrganizationMembership.ROLE_OWNER:
        return json_error("The organization owner cannot leave the organization.", 403)

    remove_organization_membership_from_projects(organization, request.user.id)
    membership.delete()
    return JsonResponse({"success": True, "organizationId": organization.id})
