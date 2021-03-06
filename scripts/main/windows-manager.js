const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const url = require('url');
const {ArcSessionControl} = require('./session-control');
const {ArcSessionRecorder} = require('./arc-session-recorder');
/**
 * A class that manages opened app windows.
 */
class ArcWindowsManager {
  constructor() {
    this.windows = [];
    this.__windowClosed = this.__windowClosed.bind(this);
    this.__windowMoved = this.__windowMoved.bind(this);
    this.__windowResized = this.__windowResized.bind(this);
    this.recorder = new ArcSessionRecorder();
  }
  // True if has at leas one window.
  get hasWindow() {
    return this.windows.length > 0;
  }
  /**
   * Notifies all opened windows with event data.
   *
   * @param {String} type Event type (channel name)
   * @param {?Array} args List of arguments.
   */
  notifyAll(type, args) {
    this.windows.forEach(win => {
      win.webContents.send(type, args);
    });
  }

  open(path) {
    var index = this.windows.length;
    var session = new ArcSessionControl(index);

    return session.restore()
    .then(data => {
      var win = this.__getNewWindow(index, data);
      win.__arcSession = session;
      this.__loadPage(win, path);
      // win.webContents.openDevTools();
      this.__attachListeners(win);
      this.windows.push(win);
      return this.recorder.record();
    });
  }

  __getNewWindow(index, session) {
    var mainWindow = new BrowserWindow({
      width: session.size.width,
      height: session.size.height,
      x: session.position.x,
      y: session.position.y,
      backgroundColor: '#00A2DF',
      show: false,
      webPreferences: {
        partition: 'persist:arc-window'
      }
    });
    mainWindow.__arcIndex = index;
    return mainWindow;
  }

  __loadPage(win, appPath) {
    appPath = appPath || '#/request/latest/0';
    if (appPath[0] === '/') {
      appPath = '#' + appPath;
    }
    var dest = path.join(__dirname, '..', '..', 'app.html');
    console.log(dest);
    var full = url.format({
      pathname: dest,
      protocol: 'file:',
      slashes: true
    }) + appPath;
    win.loadURL(full);
  }

  __attachListeners(win) {
    win.addListener('closed', this.__windowClosed);
    win.addListener('move', this.__windowMoved);
    win.addListener('resize', this.__windowResized);
    win.once('ready-to-show', this.__readyShowHandler.bind(this));
  }

  __windowClosed(e) {
    var win = e.sender;
    var index = this.windows.findIndex(item => item === win);
    if (index === -1) {
      return;
    }
    this.windows.splice(index, 1);
  }

  __windowMoved(e) {
    var win = e.sender;
    var pos = win.getPosition();
    win.__arcSession.updatePosition(pos[0], pos[1]);
  }

  __windowResized(e) {
    var win = e.sender;
    var size = win.getSize();
    win.__arcSession.updateSize(size[0], size[1]);
  }

  __readyShowHandler(e) {
    e.sender.show();
    e.sender.send('window-rendered');
  }
}

exports.ArcWindowsManager = ArcWindowsManager;
