import useAppStore from '@renderer/stores/app.store'
import { Footer } from 'antd/es/layout/layout'

const appFooterStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: 12
}

const appFooterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'center'
}

function AppFooter(): JSX.Element {
  const appStore = useAppStore()

  return (
    <Footer style={appFooterStyle}>
      <div style={appFooterGridStyle}>
        <div>Footer</div>
        <div>{appStore.buildFlavor}</div>
      </div>
    </Footer>
  )
}

export default AppFooter
