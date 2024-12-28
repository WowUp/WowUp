import WowClientSelector from '@renderer/components/WowClientSelector'
import { SIDER_WIDTH } from '@renderer/constants'
import { Layout, theme } from 'antd'
import { Content, Header } from 'antd/es/layout/layout'

const sectionHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '1rem'
}

function GetAddonsPage(): JSX.Element {
  const {
    token: { colorBgContainer }
  } = theme.useToken()

  return (
    <Layout style={{ marginInlineStart: SIDER_WIDTH }}>
      <Header style={{ background: colorBgContainer }}>
        <div style={sectionHeaderStyle}>
          <div>
            <WowClientSelector />
          </div>
          <div className="creator">Powered by electron-vitez </div>
        </div>
      </Header>
      <Content>
        <div>Get addons</div>
      </Content>
    </Layout>
  )
}

export default GetAddonsPage
