const TOP_TITLEBAR_HEIGHT_MAC = '22px';
const TOP_TITLEBAR_HEIGHT_WIN = '30px';

export class WowUpTitlebar {

  private readonly _userAgent = window.navigator.userAgent;
  private readonly _isMac = this._userAgent.indexOf('Macintosh') >= 0;
  private readonly _isWindows = this._userAgent.indexOf('Windows') >= 0;
  private readonly _isLinux = this._userAgent.indexOf('Linux') >= 0;

  private _container: HTMLDivElement;

  constructor(){
    this.createTitleBar();
  }

  private createTitleBar(){
    this._container = this.createTitleBarContainer();

    document.body.prepend(this._container);

    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
  }

  private createTitleBarContainer(){
    const container = document.createElement('div');
    container.classList.add('container-after-titlebar');

    container.style.top = this._isMac ? TOP_TITLEBAR_HEIGHT_MAC : TOP_TITLEBAR_HEIGHT_WIN;
    container.style.bottom = '0px';
    container.style.right = '0';
    container.style.left = '0';
    container.style.position = 'absolute';

    return container;
  }
}