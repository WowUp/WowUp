import { Select } from 'antd'
import { DefaultOptionType } from 'antd/es/select'
import React from 'react'
import useWarcraftClientStore from '../stores/warcraft-client.store'
import { WowClientMessage } from '../../../shared/warcraft'

function WowClientSelector(): JSX.Element {
  const { clients, selectedClient, setSelectedClient } = useWarcraftClientStore()

  const selectOptions: DefaultOptionType[] = React.useMemo(
    () =>
      clients.map((x) => ({
        value: x.id,
        label: x.name
      })),
    [clients]
  )

  const onSelectChange = (value: string): void => {
    setSelectedClient(value)
    window.electron.ipcRenderer.send(WowClientMessage.SetSelectedWowClient, value)
  }

  return (
    <Select
      options={selectOptions}
      style={{ width: '100%' }}
      onChange={onSelectChange}
      value={selectedClient}
    />
  )
}

export default WowClientSelector
