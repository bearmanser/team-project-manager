import { useCallback, useRef, useState } from "react";

import type { ProjectDetail } from "../../types";
import { getProjectSettingsForm, type ProjectSettingsForm } from "../forms";

const emptyProjectSettingsForm: ProjectSettingsForm = {
  name: "",
  description: "",
  useSprints: false,
};

export function useProjectSettingsDraft() {
  const [projectSettingsForm, setProjectSettingsForm] =
    useState<ProjectSettingsForm>(emptyProjectSettingsForm);
  const projectSettingsDirtyFieldsRef = useRef<Set<keyof ProjectSettingsForm>>(
    new Set(),
  );
  const projectSettingsProjectIdRef = useRef<number | null>(null);

  const clearProjectSettingsDraft = useCallback(
    (projectId: number | null = null): void => {
      projectSettingsDirtyFieldsRef.current.clear();
      projectSettingsProjectIdRef.current = projectId;
      if (projectId === null) {
        setProjectSettingsForm(emptyProjectSettingsForm);
      }
    },
    [],
  );

  const applyProjectSettingsFromProject = useCallback(
    (
      project: ProjectDetail,
      options: { resetDirty?: boolean } = {},
    ): void => {
      const nextForm = getProjectSettingsForm(project);
      const shouldResetDirty =
        options.resetDirty === true ||
        projectSettingsProjectIdRef.current !== project.id;

      if (shouldResetDirty) {
        projectSettingsDirtyFieldsRef.current.clear();
      }

      projectSettingsProjectIdRef.current = project.id;

      setProjectSettingsForm((current) => {
        if (shouldResetDirty) {
          return nextForm;
        }

        const dirtyFields = projectSettingsDirtyFieldsRef.current;
        return {
          name: dirtyFields.has("name") ? current.name : nextForm.name,
          description: dirtyFields.has("description")
            ? current.description
            : nextForm.description,
          useSprints: dirtyFields.has("useSprints")
            ? current.useSprints
            : nextForm.useSprints,
        };
      });
    },
    [],
  );

  const updateProjectSettingsField = useCallback(
    <TField extends keyof ProjectSettingsForm>(
      field: TField,
      value: ProjectSettingsForm[TField],
    ): void => {
      projectSettingsDirtyFieldsRef.current.add(field);
      setProjectSettingsForm((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );

  return {
    applyProjectSettingsFromProject,
    clearProjectSettingsDraft,
    projectSettingsForm,
    updateProjectSettingsField,
  };
}
