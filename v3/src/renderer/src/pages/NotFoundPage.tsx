import { SIDER_WIDTH } from '@renderer/constants'
import { Layout } from 'antd'
import { Content } from 'antd/es/layout/layout'
import React from 'react'

const layoutStyle: React.CSSProperties = {
  height: '100%',
  position: 'absolute',
  width: 'calc( 100% - 200px )',
  left: SIDER_WIDTH
}

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  width: '100%',
  top: 0,
  left: 0
}

function NotFoundPage(): JSX.Element {
  return (
    <Layout style={layoutStyle}>
      <Content>
        <div style={centeredStyle}>
          <h3>Not Found</h3>
        </div>
      </Content>
    </Layout>
  )
}

export default NotFoundPage
