import { Button, Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectSummary } from "../types";
import { formatShortDate } from "../utils";
import type { OrganizationSummary } from "../view-models";

type OrganizationOverviewPageProps = {
    organization: OrganizationSummary;
    projects: ProjectSummary[];
    onEnterOrganization: () => void;
};

export function OrganizationOverviewPage({
    organization,
    projects,
    onEnterOrganization,
}: OrganizationOverviewPageProps) {
    return (
        <Stack gap="6">
            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Grid templateColumns={{ base: "1fr", xl: "1.1fr 0.9fr" }} gap="8">
                    <Stack gap="4">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="#90a0b7">
                            Organization overview
                        </Text>
                        <Heading size="3xl" color="#f5f7fb">
                            {organization.name}
                        </Heading>
                        <Text color="#b0bccf" fontSize="lg" maxW="2xl">
                            {organization.description}
                        </Text>
                        <Button
                            alignSelf="flex-start"
                            borderRadius="0"
                            bg="#2d6cdf"
                            color="#f8fbff"
                            onClick={onEnterOrganization}
                        >
                            Open organization
                        </Button>
                    </Stack>

                    <Grid templateColumns="repeat(2, 1fr)" gap="4">
                        {[
                            { label: "Projects", value: organization.projectCount },
                            { label: "Repositories", value: organization.repoCount },
                            { label: "Open bugs", value: organization.openBugCount },
                            { label: "Known users", value: organization.memberCount },
                        ].map((stat) => (
                            <SurfaceCard key={stat.label} p="5" bg="#0f141b">
                                <Stack gap="2">
                                    <Text color="#90a0b7" textTransform="uppercase" fontSize="xs" letterSpacing="0.14em">
                                        {stat.label}
                                    </Text>
                                    <Text color="#f5f7fb" fontSize="3xl" fontWeight="700">
                                        {stat.value}
                                    </Text>
                                </Stack>
                            </SurfaceCard>
                        ))}
                    </Grid>
                </Grid>
            </SurfaceCard>

            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Stack gap="4">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Active projects
                    </Text>
                    <Grid templateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }} gap="4">
                        {projects.length ? (
                            projects.slice(0, 6).map((project) => (
                                <SurfaceCard key={project.id} p="5" bg="#0f141b">
                                    <Stack gap="2">
                                        <Heading size="md" color="#f5f7fb">
                                            {project.name}
                                        </Heading>
                                        <Text color="#90a0b7">{project.description || "No description yet."}</Text>
                                        <Text color="#d8e1ee" fontSize="sm">
                                            {project.repoCount} repo · {project.memberCount} members · updated{' '}
                                            {formatShortDate(project.updatedAt)}
                                        </Text>
                                    </Stack>
                                </SurfaceCard>
                            ))
                        ) : (
                            <Text color="#90a0b7">No projects yet. Open the organization to create the first one.</Text>
                        )}
                    </Grid>
                </Stack>
            </SurfaceCard>
        </Stack>
    );
}
