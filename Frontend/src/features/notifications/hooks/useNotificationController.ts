import { startTransition, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { getFriendlyError } from "../../../app/errors";
import type {
  BugReport,
  Notification,
  ProjectDetail,
  Task,
  WorkspaceResponse,
} from "../../../types";
import {
  acceptNotification,
  closeRelatedNotifications,
  markNotificationRead,
} from "../api";

type UseNotificationControllerParams = {
  token: string | null;
  workspace: WorkspaceResponse | null;
  setWorkspace: Dispatch<SetStateAction<WorkspaceResponse | null>>;
  selectedProject: ProjectDetail | null;
  selectedTask: Task | null;
  selectedBug: BugReport | null;
  setBusyLabel: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setNotificationOpen: Dispatch<SetStateAction<boolean>>;
  openTaskDetail: (taskId: number) => void;
  openBugDetail: (bugId: number) => void;
  navigateToProject: (projectId: number) => void;
  syncFromPath: (
    sessionToken: string,
    options?: { quiet?: boolean },
  ) => Promise<void>;
};

export function useNotificationController({
  token,
  workspace,
  setWorkspace,
  selectedProject,
  selectedTask,
  selectedBug,
  setBusyLabel,
  setError,
  setNotice,
  setNotificationOpen,
  openTaskDetail,
  openBugDetail,
  navigateToProject,
  syncFromPath,
}: UseNotificationControllerParams) {
  const [pendingNotificationTarget, setPendingNotificationTarget] = useState<{
    projectId: number;
    taskId: number | null;
    bugReportId: number | null;
  } | null>(null);
  const [lastAutoClosedWorkItemKey, setLastAutoClosedWorkItemKey] = useState<
    string | null
  >(null);

  const notifications = useMemo(
    () => (workspace?.notifications ?? []).filter((item) => !item.isClosed),
    [workspace?.notifications],
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.isRead),
    [notifications],
  );

  async function handleReadNotification(
    notification: Notification,
  ): Promise<void> {
    if (!token || notification.isRead) {
      return;
    }

    try {
      const response = await markNotificationRead(token, notification.id);
      startTransition(() => {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.map((item) =>
                  item.id === notification.id ? response.notification : item,
                ),
              }
            : current,
        );
      });
    } catch (reason) {
      setError(getFriendlyError(reason));
    }
  }

  async function handleCloseRelatedNotifications(payload: {
    taskId?: number;
    bugReportId?: number;
  }): Promise<boolean> {
    if (!token) {
      return false;
    }

    try {
      const response = await closeRelatedNotifications(token, payload);
      if (!response.closedNotificationIds.length) {
        return true;
      }

      const closedIds = new Set(response.closedNotificationIds);
      startTransition(() => {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.filter(
                  (item) => !closedIds.has(item.id),
                ),
              }
            : current,
        );
      });
      return true;
    } catch (reason) {
      setError(getFriendlyError(reason));
      return false;
    }
  }

  async function handleOpenNotification(
    notification: Notification,
  ): Promise<void> {
    if (
      !token ||
      notification.projectId === null ||
      (notification.taskId === null && notification.bugReportId === null)
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setNotificationOpen(false);

    if (selectedProject?.id === notification.projectId) {
      if (notification.taskId !== null) {
        openTaskDetail(notification.taskId);
      } else if (notification.bugReportId !== null) {
        openBugDetail(notification.bugReportId);
      }
      return;
    }

    setPendingNotificationTarget({
      projectId: notification.projectId,
      taskId: notification.taskId,
      bugReportId: notification.bugReportId,
    });
    setBusyLabel("Opening item");
    navigateToProject(notification.projectId);

    try {
      await syncFromPath(token, { quiet: true });
    } catch (reason) {
      setPendingNotificationTarget(null);
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleAcceptNotification(
    notification: Notification,
  ): Promise<void> {
    if (!token || !notification.action) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Accepting invite");

    try {
      const response = await acceptNotification(token, notification.id);
      startTransition(() => {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.map((item) =>
                  item.id === notification.id ? response.notification : item,
                ),
              }
            : current,
        );
      });
      await syncFromPath(token, { quiet: true });
      setNotice("Invite accepted.");
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
      setBusyLabel(null);
    }
  }

  useEffect(() => {
    if (!pendingNotificationTarget || !selectedProject) {
      return;
    }

    if (selectedProject.id !== pendingNotificationTarget.projectId) {
      return;
    }

    if (pendingNotificationTarget.taskId !== null) {
      const taskExists = selectedProject.tasks.some(
        (task) => task.id === pendingNotificationTarget.taskId,
      );
      if (taskExists) {
        openTaskDetail(pendingNotificationTarget.taskId);
      } else {
        setError("The task for this notification is no longer available.");
      }
    } else if (pendingNotificationTarget.bugReportId !== null) {
      const bugExists = selectedProject.bugReports.some(
        (bug) => bug.id === pendingNotificationTarget.bugReportId,
      );
      if (bugExists) {
        openBugDetail(pendingNotificationTarget.bugReportId);
      } else {
        setError("The bug for this notification is no longer available.");
      }
    }

    setPendingNotificationTarget(null);
  }, [
    openBugDetail,
    openTaskDetail,
    pendingNotificationTarget,
    selectedProject,
    setError,
  ]);

  useEffect(() => {
    const workItemKey = selectedTask
      ? `task:${selectedTask.id}`
      : selectedBug
        ? `bug:${selectedBug.id}`
        : null;

    if (!workItemKey) {
      setLastAutoClosedWorkItemKey(null);
      return;
    }

    if (lastAutoClosedWorkItemKey === workItemKey) {
      return;
    }

    setLastAutoClosedWorkItemKey(workItemKey);
    const payload = selectedTask
      ? { taskId: selectedTask.id }
      : { bugReportId: selectedBug!.id };

    void handleCloseRelatedNotifications(payload).then((didClose) => {
      if (!didClose) {
        setLastAutoClosedWorkItemKey((current) =>
          current === workItemKey ? null : current,
        );
      }
    });
  }, [lastAutoClosedWorkItemKey, selectedBug, selectedTask]);

  return {
    notifications,
    unreadNotifications,
    handleAcceptNotification,
    handleCloseRelatedNotifications,
    handleOpenNotification,
    handleReadNotification,
  };
}
