import type {
    CloseRelatedNotificationsResponse,
    NotificationResponse,
} from "../../types";
import { request } from "../../api/client";

export function markNotificationRead(
    token: string,
    notificationId: number,
): Promise<NotificationResponse> {
    return request<NotificationResponse>(
        `/api/notifications/${notificationId}/read/`,
        {
            method: "POST",
        },
        token,
    );
}

export function closeRelatedNotifications(
    token: string,
    payload: { taskId?: number; bugReportId?: number },
): Promise<CloseRelatedNotificationsResponse> {
    return request<CloseRelatedNotificationsResponse>(
        "/api/notifications/close-related/",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function acceptNotification(
    token: string,
    notificationId: number,
): Promise<NotificationResponse> {
    return request<NotificationResponse>(
        `/api/notifications/${notificationId}/accept/`,
        {
            method: "POST",
        },
        token,
    );
}
