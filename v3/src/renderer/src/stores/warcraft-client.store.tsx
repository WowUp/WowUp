import { WarcraftClient } from '../../../shared/warcraft'
import { create } from 'zustand'

interface WarcraftClientState {
  clients: WarcraftClient[]
  setClients: (clients: WarcraftClient[]) => void
  selectedClient: string | null
  setSelectedClient(clientId: string): void
}

const useWarcraftClientStore = create<WarcraftClientState>((set) => ({
  clients: [],
  setClients: (clients: WarcraftClient[]): void => set((state) => ({ ...state, clients })),
  selectedClient: null,
  setSelectedClient: (clientId: string | null): void =>
    set((state) => ({ ...state, selectedClient: clientId }))
}))

export default useWarcraftClientStore
