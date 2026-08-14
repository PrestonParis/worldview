import type { StateCreator } from "zustand";

export interface ProjectSlice {
  // null = an unsaved graphic — nothing to autosave against yet.
  projectId: string | null;
  projectName: string;
  setProject: (id: string | null, name: string) => void;
  renameProject: (name: string) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
  projectId: null,
  projectName: "Untitled graphic",
  setProject: (id, name) => set({ projectId: id, projectName: name }),
  renameProject: (name) => set({ projectName: name }),
});
