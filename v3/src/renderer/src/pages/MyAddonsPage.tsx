import WowClientSelector from '@renderer/components/WowClientSelector'
import { Button, Dropdown, Input, Layout, Space, theme } from 'antd'
import { Content, Header } from 'antd/es/layout/layout'
import { AgGridReact } from 'ag-grid-react'
import { ColDef } from 'ag-grid-community'
import React, { useEffect, useState } from 'react'
import { darkGridTheme } from '@renderer/components/GridStyle'
import { ItemType } from 'antd/es/menu/interface'
import { SIDER_WIDTH } from '@renderer/constants'
import { AddonMessage } from '../../../shared/messages'
import useWarcraftClientStore from '@renderer/stores/warcraft-client.store'
import { Addon } from '@shared/addons'
import { IpcRenderer } from 'electron'

const sectionHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto auto auto',
  gap: '1rem'
}

interface AddonViewModel {
  addonId: string
  name: string
}

const toAddonViewModel = (addon: Addon): AddonViewModel => {
  return {
    addonId: addon.id,
    name: addon.name
  }
}

function MyAddonsPage(): JSX.Element {
  const {
    token: { colorBgContainer }
  } = theme.useToken()

  const { selectedClient } = useWarcraftClientStore()

  // Row Data: The data to be displayed.
  const [rowData, setRowData] = useState<AddonViewModel[]>([])
  const [loadingAddons, setLoadingAddons] = useState<boolean>(false)

  // Column Definitions: Defines the columns to be displayed.
  const [colDefs] = useState<ColDef[]>([
    { field: 'name', headerName: 'Addon' },
    { field: 'sortOrder', headerName: 'Status' },
    { field: 'installedAt', headerName: 'Updated At' },
    { field: 'latestVersion', headerName: 'Latest Version' },
    { field: 'reeasedAt', headerName: 'Released At' },
    { field: 'gameVersion', headerName: 'Game Version' },
    { field: 'providerName', headerName: 'Provider' },
    { field: 'externalChannel', headerName: 'Provider Channel' },
    { field: 'author', headerName: 'Author' }
  ])

  useEffect(() => {
    setLoadingAddons(true)

    window.electron.ipcRenderer
      .invoke(AddonMessage.GetAddonList, selectedClient)
      .then((addons) => {
        console.debug('res', addons)
        setRowData(addons.map(toAddonViewModel))

        // If there are no addons, re-scan the folders
        if (addons.length === 0) {
          onClickReScanFolders()
        } else {
          setLoadingAddons(false)
        }
      })
      .catch((err) => {
        console.error('failed to get addon list', err)
        setLoadingAddons(false)
      })
  }, [selectedClient, setLoadingAddons])

  useEffect(() => {
    const onScanningAddonProvider = (_, providerName: string): void => {
      console.log('ScanningAddonProvider', providerName)
    }
    window.electron.ipcRenderer.on(AddonMessage.ScanningAddonProvider, onScanningAddonProvider)

    return (): void => {
      window.electron.ipcRenderer.removeListener(
        AddonMessage.ScanningAddonProvider,
        onScanningAddonProvider
      )
    }
  }, [])

  const onClickReScanFolders = async (): Promise<void> => {
    setLoadingAddons(true)

    try {
      const addons: Addon[] = await window.electron.ipcRenderer.invoke(
        AddonMessage.ScanAddonFolder,
        selectedClient
      )

      console.debug('ADDONS', addons)

      setRowData(addons.map(toAddonViewModel))
    } catch (err) {
      console.error('failed to scan addon folders', err)
    } finally {
      setLoadingAddons(false)
    }
  }

  const dropdownItems: ItemType[] = [
    {
      key: '0',
      label: 'Re-Scan Folders',
      onClick: onClickReScanFolders
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
          <AgGridReact<AddonViewModel>
            theme={darkGridTheme}
            rowData={rowData}
            columnDefs={colDefs}
            loading={loadingAddons}
          />
        </div>
      </Content>
    </Layout>
  )
}

export default MyAddonsPage
