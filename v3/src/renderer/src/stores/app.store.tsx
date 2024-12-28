import { create } from 'zustand'

export type BuildFlavor = 'wago' | 'ow'

interface AppStoreState {
  buildFlavor: BuildFlavor
  setBuildFlavor: (flavor: BuildFlavor) => void
  adSpace: boolean
  setAdSpace: (adSpace: boolean) => void
}

const useAppStore = create<AppStoreState>((set) => ({
  buildFlavor: 'wago',
  setBuildFlavor: (flavor: BuildFlavor): void =>
    set((state) => ({ ...state, buildFlavor: flavor })),
  adSpace: true,
  setAdSpace: (adSpace: boolean): void => set((state) => ({ ...state, adSpace: adSpace }))
}))

export default useAppStore
