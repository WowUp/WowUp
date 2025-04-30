import { Container } from 'inversify'
import * as svc from './services'
import * as hndl from './handlers'
import * as providers from './providers'
import { IS_OW, IS_WAGO, TAGS, TYPES } from './constants'
import { AddonProvider } from './models'

export function createContainer(): Container {
  const container = new Container()

  // Handlers
  container
    .bind<hndl.IPCHandler>('Handler')
    .to(hndl.AddonHandler)
    .inSingletonScope()
    .whenTargetNamed('Addon')

  container
    .bind<hndl.IPCHandler>('Handler')
    .to(hndl.OsHandler)
    .inSingletonScope()
    .whenTargetNamed('OS')

  container
    .bind<hndl.IPCHandler>('Handler')
    .to(hndl.WarcraftClientHandler)
    .inSingletonScope()
    .whenTargetNamed('WarcraftClient')

  if (IS_WAGO) {
    container
      .bind<hndl.IPCHandler>('Handler')
      .to(hndl.WagoHandler)
      .inSingletonScope()
      .whenTargetNamed('Wago')
  }

  // Scanners
  container
    .bind<providers.IWowUpFolderScanner>(providers.WowUpFolderScanner)
    .to(providers.WowUpFolderScanner)

  if (IS_OW) {
    container
      .bind<providers.ICurseFolderScanner>(providers.CurseFolderScanner)
      .to(providers.CurseFolderScanner)
  }

  //Services
  container
    .bind<svc.IDatabaseService>(svc.DatabaseService)
    .to(svc.DatabaseService)
    .inSingletonScope()

  container.bind<svc.ITocService>(TYPES.ITocService).to(svc.TocService).inSingletonScope()

  container
    .bind<svc.INetworkService>(TYPES.INetworkService)
    .to(svc.NetworkService)
    .inSingletonScope()

  container
    .bind<svc.IRendererMessageService>(TYPES.IRendererMessageService)
    .to(svc.RendererMessageService)
    .inSingletonScope()

  container
    .bind<svc.IWarcraftClientService>(svc.WarcraftClientService)
    .to(svc.WarcraftClientService)
    .inSingletonScope()

  container
    .bind<svc.IAddonScanService>(svc.AddonScanService)
    .to(svc.AddonScanService)
    .inSingletonScope()

  container
    .bind<svc.IAddonSyncService>(svc.AddonSyncService)
    .to(svc.AddonSyncService)
    .inSingletonScope()

  container
    .bind<svc.IAddonStoreService>(TYPES.IAddonStoreService)
    .to(svc.AddonStoreService)
    .inSingletonScope()

  container
    .bind<svc.IAddonProviderService>(svc.AddonProviderService)
    .to(svc.AddonProviderService)
    .inSingletonScope()

  if (IS_WAGO) {
    container.bind<svc.IWagoService>(svc.WagoService).to(svc.WagoService).inSingletonScope()
  }

  // Addon providers

  container
    .bind<AddonProvider>(TYPES.IAddonProvider)
    .to(providers.WowUpProvider)
    .inTransientScope()
    .whenTargetNamed(TAGS.WowUpProvider)

  container
    .bind<AddonProvider>(TYPES.IAddonProvider)
    .to(providers.TukUiProvider)
    .inTransientScope()
    .whenTargetNamed(TAGS.TukUiProvider)

  container
    .bind<AddonProvider>(TYPES.IAddonProvider)
    .to(providers.CurseforgeProvider)
    .inTransientScope()
    .whenTargetNamed(TAGS.CurseForgeProvider)

  return container
}
