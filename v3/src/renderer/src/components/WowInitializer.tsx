import log from 'electron-log/renderer'
import useWarcraftClientStore from '@renderer/stores/warcraft-client.store'
import React from 'react'
import { WowClientMessage } from '../../../shared/warcraft'

function WowInitializer(): JSX.Element {
  const { setClients, setSelectedClient } = useWarcraftClientStore()

  React.useEffect(() => {
    const fetchClients = async (): Promise<void> => {
      try {
        const clients = await window.electron.ipcRenderer.invoke(WowClientMessage.GetWowClients)
        setClients(clients)
      } catch (err) {
        log.error(err)
      }
    }

    const fetchSelectedClient = async (): Promise<void> => {
      try {
        const selectedClient = await window.electron.ipcRenderer.invoke(
          WowClientMessage.GetSelectedWowClient
        )
        setSelectedClient(selectedClient)
      } catch (err) {
        log.error(err)
      }
    }

    fetchClients()
    fetchSelectedClient()
  }, [])

  return <></>
}

export default WowInitializer
