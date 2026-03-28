import type { OrganizationSummary, ProjectDetail, WorkspaceResponse } from "../types";

type WorkspaceProjectSummary = WorkspaceResponse["projects"][number];

function buildProjectSummary(project: ProjectDetail): WorkspaceProjectSummary {
    return {
        id: project.id,
        organizationId: project.organizationId,
        name: project.name,
        description: project.description,
        role: project.role,
        memberCount: project.members.length,
        repoCount: project.repositories.length,
        openBugCount: project.bugReports.filter((bug) => bug.status !== "closed")
            .length,
        taskCounts: {
            todo: project.tasks.filter((task) => task.status === "todo").length,
            in_progress: project.tasks.filter((task) => task.status === "in_progress")
                .length,
            in_review: project.tasks.filter((task) => task.status === "in_review")
                .length,
            done: project.tasks.filter((task) => task.status === "done").length,
        },
        updatedAt: project.updatedAt,
    };
}

export function mergeProjectIntoWorkspace(
    current: WorkspaceResponse | null,
    project: ProjectDetail,
): WorkspaceResponse | null {
    if (!current) {
        return current;
    }

    const nextProjectSummary = buildProjectSummary(project);
    const nextProjects = current.projects.some((entry) => entry.id === project.id)
        ? current.projects.map((entry) =>
              entry.id === project.id ? nextProjectSummary : entry,
          )
        : [...current.projects, nextProjectSummary];
    const organizationProjects = nextProjects.filter(
        (entry) => entry.organizationId === project.organizationId,
    );
    const nextOrganizations = current.organizations.map((organization) => {
        if (organization.id !== project.organizationId) {
            return organization;
        }

        const repoCount = organizationProjects.reduce(
            (total, entry) => total + entry.repoCount,
            0,
        );
        const openBugCount = organizationProjects.reduce(
            (total, entry) => total + entry.openBugCount,
            0,
        );
        const updatedAt = organizationProjects.reduce(
            (latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest),
            organization.updatedAt,
        );

        return {
            ...organization,
            projectCount: organizationProjects.length,
            repoCount,
            openBugCount,
            updatedAt,
        };
    });

    return {
        ...current,
        projects: nextProjects,
        organizations: nextOrganizations,
    };
}

export function resolveOrganizationSelection(
    organizations: OrganizationSummary[],
    preferredOrganizationId: number | null,
): number | null {
    if (
        organizations.some(
            (organization) => organization.id === preferredOrganizationId,
        )
    ) {
        return preferredOrganizationId;
    }

    const personalOrganization = organizations.find(
        (organization) => organization.isPersonal,
    );
    return personalOrganization?.id ?? organizations[0]?.id ?? null;
}
