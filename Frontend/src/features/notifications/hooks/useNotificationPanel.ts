import { useState } from "react";

export function useNotificationPanel() {
    const [notificationOpen, setNotificationOpen] = useState(false);

    return {
        notificationOpen,
        closeNotifications: () => setNotificationOpen(false),
        setNotificationOpen,
        toggleNotifications: () =>
            setNotificationOpen((current) => !current),
    };
}
