import { SIDER_WIDTH } from '@renderer/constants'
import { Layout } from 'antd'
import { Content, Header } from 'antd/es/layout/layout'

function OptionsPage(): JSX.Element {
  return (
    <Layout style={{ marginInlineStart: SIDER_WIDTH }}>
      <Header></Header>
      <Content>
        <div>Options</div>
      </Content>
    </Layout>
  )
}

export default OptionsPage
