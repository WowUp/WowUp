import useWarcraftClientStore from '@renderer/stores/warcraft-client.store'
import { OsMessage } from '@shared/messages'
import { WarcraftClient } from '@shared/warcraft'
import { Button } from 'antd'

const clientListStyle: React.CSSProperties = {
  padding: '0',
  listStyle: 'none'
}

const clientListItemStyle: React.CSSProperties = {
  padding: '0.5rem'
}

function WowClientList(): JSX.Element {
  const { clients } = useWarcraftClientStore()

  const onClickShowClient = async (client: WarcraftClient): Promise<void> => {
    try {
      await window.electron.ipcRenderer.invoke(OsMessage.ShowFileInFolder, client.location)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <ul style={clientListStyle}>
        {clients.map((client) => (
          <li key={client.id} style={clientListItemStyle}>
            <div>{client.name}</div>
            <div>
              <Button onClick={() => onClickShowClient(client)}>Open Folder</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default WowClientList
