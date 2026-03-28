import type {
    DeleteOrganizationResponse,
    OrganizationMembersResponse,
    OrganizationResponse,
    SuccessResponse,
} from "../../types";
import { request } from "../../api/client";

export function createOrganization(
    token: string,
    payload: { name: string; description: string },
): Promise<OrganizationResponse> {
    return request<OrganizationResponse>(
        "/api/organizations/",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function updateOrganizationSettings(
    token: string,
    organizationId: number,
    payload: { name: string },
): Promise<OrganizationResponse> {
    return request<OrganizationResponse>(
        `/api/organizations/${organizationId}/settings/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function deleteOrganization(
    token: string,
    organizationId: number,
): Promise<DeleteOrganizationResponse> {
    return request<DeleteOrganizationResponse>(
        `/api/organizations/${organizationId}/delete/`,
        {
            method: "POST",
        },
        token,
    );
}

export function getOrganizationMembers(
    token: string,
    organizationId: number,
): Promise<OrganizationMembersResponse> {
    return request<OrganizationMembersResponse>(
        `/api/organizations/${organizationId}/members/`,
        {},
        token,
    );
}

export function inviteOrganizationMember(
    token: string,
    organizationId: number,
    payload: { identifier: string; role: string },
): Promise<OrganizationMembersResponse> {
    return request<OrganizationMembersResponse>(
        `/api/organizations/${organizationId}/members/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function updateOrganizationMemberRole(
    token: string,
    organizationId: number,
    membershipId: number,
    payload: { role: string },
): Promise<OrganizationMembersResponse> {
    return request<OrganizationMembersResponse>(
        `/api/organizations/${organizationId}/members/${membershipId}/role/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function removeOrganizationMember(
    token: string,
    organizationId: number,
    membershipId: number,
): Promise<SuccessResponse> {
    return request<SuccessResponse>(
        `/api/organizations/${organizationId}/members/${membershipId}/remove/`,
        {
            method: "POST",
        },
        token,
    );
}

export function cancelOrganizationInvite(
    token: string,
    organizationId: number,
    membershipId: number,
): Promise<SuccessResponse> {
    return request<SuccessResponse>(
        `/api/organizations/${organizationId}/members/${membershipId}/cancel/`,
        {
            method: "POST",
        },
        token,
    );
}

export function leaveOrganization(
    token: string,
    organizationId: number,
): Promise<SuccessResponse> {
    return request<SuccessResponse>(
        `/api/organizations/${organizationId}/leave/`,
        {
            method: "POST",
        },
        token,
    );
}
