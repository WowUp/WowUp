import log from 'electron-log/renderer'
import { ConfigProvider, Layout, theme } from 'antd'
import { Content } from 'antd/es/layout/layout'
import React from 'react'
import WowInitializer from './components/WowInitializer'
import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import MyAddonsPage from './pages/MyAddonsPage'
import AppSidebar from './components/AppSidebar'
import NotFoundPage from './pages/NotFoundPage'
import GetAddonsPage from './pages/GetAddonsPage'
import OptionsPage from './pages/OptionsPage'
import useAppStore, { BuildFlavor } from './stores/app.store'
import AppFooter from './components/AppFooter'

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule])

function App(): JSX.Element {
  const { buildFlavor, setBuildFlavor } = useAppStore()

  React.useEffect(() => {
    const flavor = import.meta.env.RENDERER_VITE_BUILD_FLAVOR
    log.debug('flavor', flavor)
    setBuildFlavor(flavor as BuildFlavor)
    document.title = `WowUp ${flavor === 'ow' ? 'CF' : ''}`
  }, [setBuildFlavor])

  const buildFlavorClass = React.useMemo(
    () => (buildFlavor === 'ow' ? 'curseforge' : 'wago'),
    [buildFlavor]
  )

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            // siderBg: 'red',
          }
        },
        algorithm: theme.darkAlgorithm
      }}
    >
      <WowInitializer />
      <Router>
        <Layout style={{ minHeight: '100vh' }} className={`${buildFlavorClass}`}>
          <Content style={{ position: 'relative' }}>
            <Layout hasSider style={{ height: '100%' }}>
              <AppSidebar />
              <Routes>
                <Route path="/" element={<Navigate to="/my-addons" />} />
                <Route path="/my-addons" element={<MyAddonsPage />} />
                <Route path="/get-addons" element={<GetAddonsPage />} />
                <Route path="/options" element={<OptionsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          </Content>
          <AppFooter />
        </Layout>
      </Router>
    </ConfigProvider>
  )
}

export default App
