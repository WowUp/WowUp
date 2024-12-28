import log from 'electron-log/renderer'
import { Link } from 'react-router-dom'
import aiLogo from '../assets/ai-logo.png'
import { Menu, theme } from 'antd'
import { MenuItemType } from 'antd/es/menu/interface'
import Sider from 'antd/es/layout/Sider'
import useAppStore from '@renderer/stores/app.store'
import React from 'react'
import { SIDER_WIDTH } from '@renderer/constants'
import { v4 as uuidv4 } from 'uuid'

function AppSidebar(): JSX.Element {
  const { adSpace, buildFlavor } = useAppStore()

  const [adContainer, setAdContainer] = React.useState<HTMLDivElement | null>(null)

  const {
    token: { colorBgContainer }
  } = theme.useToken()

  const siderStyle: React.CSSProperties = {
    overflow: 'hidden',
    position: 'absolute',
    height: '100%',
    top: 0,
    left: 0,
    background: colorBgContainer
  }

  const menuItems: MenuItemType[] = [
    { key: 'my-addons', label: <Link to="/my-addons">My Addons</Link> },
    { key: 'get-addons', label: <Link to="/get-addons">Get Addons</Link> },
    { key: 'options', label: <Link to="/options">Options</Link> }
  ]

  const adMenu: MenuItemType[] = [{ key: 'ad-explainer', label: 'Ad Explainer' }]

  const onRefChange = React.useCallback((node: HTMLDivElement | null): void => {
    setAdContainer(node)
  }, [])

  React.useEffect(() => {
    if (buildFlavor !== 'wago' || adContainer === null) {
      return
    }

    let placeholder: HTMLDivElement | null = null

    placeholder = document.createElement('div')
    placeholder.style.width = '100%'
    placeholder.style.height = '100%'

    const webview: Electron.WebviewTag = document.createElement('webview')
    webview.id = uuidv4()
    webview.src = 'https://addons.wago.io/wowup_ad'
    webview.setAttribute('style', 'width: 100%; height: 100%;')
    webview.nodeintegration = false
    webview.nodeintegrationinsubframes = false
    webview.plugins = false
    webview.allowpopups = true
    webview.partition = 'memcache'

    webview.addEventListener('error', (evt) => {
      log.error('ERROR', evt)
    })

    webview.addEventListener('did-fail-load', (evt) => {
      log.error('did-fail-load', evt)
    })

    webview.addEventListener('dom-ready', () => {
      webview.openDevTools()
    })

    placeholder.appendChild(webview)
    adContainer?.appendChild(placeholder)

    return (): void => {
      webview.closeDevTools()
      placeholder?.remove()
    }
  }, [adContainer])

  React.useEffect(() => {
    if (buildFlavor !== 'ow' || adContainer === null) {
      return
    }

    const webview = document.createElement('owadview')

    webview.addEventListener('error', (evt) => {
      log.error('ERROR', evt)
    })

    webview.addEventListener('did-fail-load', (evt) => {
      log.error('did-fail-load', evt)
    })

    webview.addEventListener('dom-ready', (evt) => {
      log.log('dom-ready', evt)
    })

    adContainer?.appendChild(webview)

    return (): void => {
      webview.remove()
    }
  }, [adContainer])

  return (
    <Sider style={siderStyle} width={SIDER_WIDTH}>
      <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', padding: '1rem' }}
        >
          <img alt="logo" className="logo" src={aiLogo} style={{ width: 40 }} />
          <h3 style={{ textAlign: 'center', width: '100%' }}>WowUp</h3>
        </div>
        <Menu items={menuItems} mode="vertical" style={{ borderRight: 0, padding: '1rem' }} />
        {adSpace && (
          <div>
            <div>
              <Menu
                items={adMenu}
                mode="vertical"
                style={{ borderRight: 0, padding: '1rem 1rem 0 1rem' }}
              />
            </div>
            {buildFlavor === 'wago' && (
              <div style={{ width: 300, height: 250 }} ref={onRefChange}></div>
            )}
            {buildFlavor === 'ow' && (
              <div style={{ width: 400, height: 300 }} ref={onRefChange}></div>
            )}
          </div>
        )}
      </div>
    </Sider>
  )
}

export default AppSidebar
