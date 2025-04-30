import { SIDER_WIDTH } from '@renderer/constants'
import { Button, Layout } from 'antd'
import { Content, Header } from 'antd/es/layout/layout'
import WowClientList from './options/WowClientList'
import { OsMessage } from '@shared/messages'

function OptionsPage(): JSX.Element {
  const onShowAppData = async (): Promise<void> => {
    try {
      await window.electron.ipcRenderer.invoke(OsMessage.ShowAppDataFolder)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Layout style={{ marginInlineStart: SIDER_WIDTH }}>
      <Header></Header>
      <Content>
        <div>Options</div>
        <Button onClick={onShowAppData}>Show App Data</Button>
        <WowClientList />
      </Content>
    </Layout>
  )
}

export default OptionsPage
