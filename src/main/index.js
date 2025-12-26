import { app, shell, BrowserWindow, ipcMain, screen, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/appIcon01.png?asset'
import AdmZip from 'adm-zip'
import { existsSync, mkdirSync } from 'fs'

// Enable hardware acceleration optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('enable-webgl')
app.commandLine.appendSwitch('enable-webgl2-compute-context')
app.commandLine.appendSwitch('ignore-gpu-blocklist')

function createWindow() {
  // Create the browser window.
  nativeTheme.themeSource = 'dark'

  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webgl: true,
      acceleratedGraphics: true,
      hardwareAcceleration: true
    },
    backgroundColor: '#2c2e29',
    icon: icon,
    titleBarStyle: 'hidden'
  })

  // Set window size and center
  let screenWidth = screen.getPrimaryDisplay().workAreaSize.width
  let screenHeight = screen.getPrimaryDisplay().workAreaSize.height

  screenWidth -= 200
  screenHeight -= 160

  mainWindow.setSize(screenWidth, screenHeight)
  mainWindow.center()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized')
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Function to extract assets on startup
function extractAssets() {
  try {
    // Use userData directory for cross-platform compatibility
    const dataDir = join(app.getPath('userData'), 'data')
    
    // Path to the zip file in the built application
    // In production, this will be in the unpacked resources
    const zipPath = join(__dirname, 'SimplyRemadeAssetsV1.zip')
    
    // Check if data directory already exists
    if (!existsSync(dataDir)) {
      console.log('Extracting SimplyRemadeAssetsV1 assets to data directory...')
      console.log('Zip path:', zipPath)
      console.log('Data directory:', dataDir)
      
      // Create data directory
      mkdirSync(dataDir, { recursive: true })
      
      // Extract zip file
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(dataDir, true)
      
      console.log('Assets extracted successfully to:', dataDir)
    } else {
      console.log('Data directory already exists, skipping extraction.')
    }
  } catch (error) {
    console.error('Error extracting assets:', error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Extract assets before creating window
  extractAssets()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Handler to get blocks data
  ipcMain.handle('get-blocks', async () => {
    try {
      // Read from the bundled blocks.json file
      const blocksJsonPath = join(__dirname, 'blocks.json')
      
      if (existsSync(blocksJsonPath)) {
        const fs = await import('fs/promises')
        const data = await fs.readFile(blocksJsonPath, 'utf-8')
        return JSON.parse(data)
      } else {
        return { blocks: [], error: 'blocks.json not found' }
      }
    } catch (error) {
      console.error('Error reading blocks data:', error)
      return { blocks: [], error: error.message }
    }
  })

  // Handler to get data directory path
  ipcMain.handle('get-data-dir', () => {
    return join(app.getPath('userData'), 'data')
  })

  // Handler to load a block model JSON
  ipcMain.handle('load-block-model', async (event, blockPath) => {
    try {
      const dataDir = join(app.getPath('userData'), 'data')
      const fullPath = join(dataDir, blockPath)
      
      if (existsSync(fullPath)) {
        const fs = await import('fs/promises')
        const data = await fs.readFile(fullPath, 'utf-8')
        return JSON.parse(data)
      } else {
        return { error: 'Block model file not found' }
      }
    } catch (error) {
      console.error('Error loading block model:', error)
      return { error: error.message }
    }
  })

  // Handler to load a texture file
  ipcMain.handle('load-texture', async (event, texturePath) => {
    try {
      const dataDir = join(app.getPath('userData'), 'data')
      // Convert texture path like "minecraft:block/bedrock" to actual file path
      const actualPath = texturePath.replace('minecraft:', 'SimplyRemadeAssetsV1/assets/minecraft/textures/')
      const fullPath = join(dataDir, actualPath + '.png')
      
      if (existsSync(fullPath)) {
        const fs = await import('fs/promises')
        const data = await fs.readFile(fullPath)
        // Convert to base64 for use in renderer
        return {
          data: data.toString('base64'),
          path: fullPath
        }
      } else {
        return { error: 'Texture file not found', path: fullPath }
      }
    } catch (error) {
      console.error('Error loading texture:', error)
      return { error: error.message }
    }
  })

  // Window control handlers
  ipcMain.on('minimize-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.minimize()
  })

  ipcMain.on('maximize-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  ipcMain.on('close-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.close()
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
