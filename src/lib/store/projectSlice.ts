import type { StateCreator } from "zustand";

export interface ProjectSlice {
  // null = an unsaved graphic — nothing to autosave against yet.
  projectId: string | null;
  projectName: string;
  liveValues: Record<string, string>;
  setProject: (id: string | null, name: string) => void;
  renameProject: (name: string) => void;
  setLiveValues: (values: Record<string, string>) => void;
  setLiveValue: (key: string, value: string) => void;
  removeLiveValue: (key: string) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice> = (set) => ({
  projectId: null,
  projectName: "Untitled graphic",
  liveValues: {},
  setProject: (id, name) => set({ projectId: id, projectName: name }),
  renameProject: (name) => set({ projectName: name }),
  setLiveValues: (liveValues) => set({ liveValues }),
  setLiveValue: (key, value) => set((state) => ({ liveValues: { ...state.liveValues, [key]: value } })),
  removeLiveValue: (key) => set((state) => {
    const liveValues = { ...state.liveValues };
    delete liveValues[key];
    return { liveValues };
  }),
});
