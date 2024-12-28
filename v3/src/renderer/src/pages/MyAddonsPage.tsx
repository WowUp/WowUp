import WowClientSelector from '@renderer/components/WowClientSelector'
import { Button, Dropdown, Input, Layout, Space, theme } from 'antd'
import { Content, Header } from 'antd/es/layout/layout'
import { AgGridReact } from 'ag-grid-react'
import { ColDef } from 'ag-grid-community'
import React, { useState } from 'react'
import { darkGridTheme } from '@renderer/components/GridStyle'
import { ItemType } from 'antd/es/menu/interface'
import { SIDER_WIDTH } from '@renderer/constants'
import { AddonMessage } from '../../../shared/messages'
import useWarcraftClientStore from '@renderer/stores/warcraft-client.store'

const sectionHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto auto auto',
  gap: '1rem'
}

function MyAddonsPage(): JSX.Element {
  const {
    token: { colorBgContainer }
  } = theme.useToken()

  const { selectedClient } = useWarcraftClientStore()

  // Row Data: The data to be displayed.
  const [rowData] = useState([
    { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
    { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
    { make: 'Toyota', model: 'Corolla', price: 29600, electric: false }
  ])

  // Column Definitions: Defines the columns to be displayed.
  const [colDefs] = useState<ColDef[]>([
    { field: 'hash', headerName: 'Addon' },
    { field: 'sortOrder', headerName: 'Status' },
    { field: 'installedAt', headerName: 'Updated At' },
    { field: 'latestVersion', headerName: 'Latest Version' },
    { field: 'reeasedAt', headerName: 'Released At' },
    { field: 'gameVersion', headerName: 'Game Version' },
    { field: 'providerName', headerName: 'Provider' },
    { field: 'externalChannel', headerName: 'Provider Channel' },
    { field: 'author', headerName: 'Author' }
  ])

  const onClicReScanFolders = async (): Promise<void> => {
    await window.electron.ipcRenderer.invoke(AddonMessage.ScanAddonFolder, selectedClient)
  }

  const dropdownItems: ItemType[] = [
    {
      key: '0',
      label: 'Re-Scan Folders',
      onClick: onClicReScanFolders
    },
    {
      key: '1',
      label: 'Import/Export Addons'
    },
    {
      key: '2',
      label: 'Interface Settings Backup'
    }
  ]

  return (
    <Layout style={{ marginInlineStart: SIDER_WIDTH, height: 'calc( 100vh - 24px )' }}>
      <Header style={{ background: colorBgContainer }}>
        <div style={sectionHeaderStyle}>
          <div>
            <WowClientSelector />
          </div>
          <div>
            <Input placeholder="Filter" />
          </div>
          <div>
            <Button>Update All</Button>
          </div>
          <div>
            <Button>Check Updates</Button>
          </div>
          <div>
            <Dropdown trigger={['click']} menu={{ items: dropdownItems }}>
              <Button onClick={(e) => e.preventDefault()}>
                <Space>DDD</Space>
              </Button>
            </Dropdown>
          </div>
        </div>
      </Header>
      <Content style={{ padding: '1rem', position: 'relative', height: '100%' }}>
        <div
          // define a height because the Data Grid will fill the size of the parent container
          style={{ width: '100%', height: '100%' }}
        >
          <AgGridReact theme={darkGridTheme} rowData={rowData} columnDefs={colDefs} />
        </div>
      </Content>
    </Layout>
  )
}

export default MyAddonsPage
