import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectTasksPage } from "./ProjectTasksPage";
import { buildProjectDetail, buildSprint, buildTask } from "../../../test/fixtures";
import { renderWithProviders } from "../../../test/renderWithProviders";

function renderProjectTasksPage() {
  const sprint = buildSprint({ id: 77, name: "Release sprint" });
  const sprintTask = buildTask({
    id: 201,
    title: "Finish release notes",
    sprintId: sprint.id,
    sprintName: sprint.name,
    status: "in_progress",
    priority: "medium",
  });
  const productTask = buildTask({
    id: 202,
    title: "Refine onboarding flow",
    sprintId: null,
    sprintName: "",
    status: "todo",
    priority: "high",
  });

  const onOpenCreateTask = vi.fn();
  const onOpenTask = vi.fn();
  const onUpdateTaskPriority = vi.fn();
  const onUpdateTaskStatus = vi.fn();

  const project = buildProjectDetail({
    activeSprint: sprint,
    tasks: [sprintTask, productTask],
  });

  renderWithProviders(
    <ProjectTasksPage
      createTaskForm={{
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        placement: "product",
        bugReportId: null,
        bugReportTitle: "",
        markAsResolution: false,
      }}
      hiddenProductBacklogTaskIds={[]}
      isCreateOpen={false}
      project={project}
      onCleanupProductBacklogDoneTasks={vi.fn()}
      onCreateTask={vi.fn()}
      onCreateTaskFormChange={vi.fn()}
      onMarkTaskAsResolutionChange={vi.fn()}
      onToggleCreateForm={vi.fn()}
      onOpenCreateTask={onOpenCreateTask}
      onOpenTask={onOpenTask}
      onUpdateTaskPriority={onUpdateTaskPriority}
      onUpdateTaskStatus={onUpdateTaskStatus}
      onMoveTaskPlacement={vi.fn()}
      onRenameSprint={vi.fn()}
      onCreateTaskBranch={vi.fn()}
    />,
  );

  return {
    onOpenCreateTask,
    onOpenTask,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
  };
}

describe("ProjectTasksPage", () => {
  it("opens task creation in the correct backlog section", async () => {
    const user = userEvent.setup();
    const { onOpenCreateTask } = renderProjectTasksPage();

    const addTaskButtons = screen.getAllByRole("button", { name: "Add task" });
    await user.click(addTaskButtons[0]);
    await user.click(addTaskButtons[1]);

    expect(onOpenCreateTask).toHaveBeenNthCalledWith(1, "todo", "sprint");
    expect(onOpenCreateTask).toHaveBeenNthCalledWith(2, "todo", "product");
  });

  it("lets users open a task and update its inline controls", async () => {
    const user = userEvent.setup();
    const { onOpenTask, onUpdateTaskPriority, onUpdateTaskStatus } =
      renderProjectTasksPage();

    const taskRow = screen
      .getByText("Finish release notes")
      .closest("[draggable='true']");

    if (!(taskRow instanceof HTMLElement)) {
      throw new Error("Could not find the sprint task row");
    }

    await user.click(screen.getByText("Finish release notes"));

    const [prioritySelect, statusSelect] = within(taskRow).getAllByRole(
      "combobox",
    );
    await user.selectOptions(prioritySelect, "critical");
    await user.selectOptions(statusSelect, "done");

    expect(onOpenTask).toHaveBeenCalledWith(201);
    expect(onUpdateTaskPriority).toHaveBeenCalledWith(201, "critical");
    expect(onUpdateTaskStatus).toHaveBeenCalledWith(201, "done");
  });
});
