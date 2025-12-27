import { app, shell, BrowserWindow, ipcMain, screen, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/appIcon01.png?asset'
import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs'

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

// Function to recursively search for blockstates folder
function findBlockstatesFolder(startPath) {
  const toSearch = [startPath]
  
  while (toSearch.length > 0) {
    const currentPath = toSearch.shift()
    
    try {
      const items = readdirSync(currentPath)
      
      for (const item of items) {
        const itemPath = join(currentPath, item)
        
        try {
          const stats = statSync(itemPath)
          
          if (stats.isDirectory()) {
            // Check if this directory is named "blockstates"
            if (item.toLowerCase() === 'blockstates') {
              return itemPath
            }
            // Add to search queue
            toSearch.push(itemPath)
          }
        } catch {
          // Skip items we can't access
          continue
        }
      }
    } catch {
      // Skip directories we can't read
      continue
    }
  }
  
  return null
}

// Function to generate blocks.json from blockstates for a given assets folder
function generateBlocksJsonForFolder(dataDir, assetsFolder) {
  try {
    console.log(`Generating blocks.json for ${assetsFolder}...`)
    
    // Category mappings based on block names
    const categoryMappings = {
      '_log': 'Log',
      '_wool': 'Wool',
      '_sapling': 'Sapling',
      '_ore': 'Ore',
      '_stairs': 'Stairs',
      '_slab': 'Slab',
      '_fence': 'Fence',
      '_door': 'Door',
      '_pressure_plate': 'Pressure Plate',
      'piston': 'Piston',
      'mushroom': 'Mushroom',
      'dandelion': 'Flower',
      'rose': 'Flower',
      'dead_bush': 'Shrub',
      'grass': 'Shrub',
      'fern': 'Shrub',
      'sandstone': 'Sandstone',
      '_block': 'Compressed Block',
      'rail': 'Rail',
      'stone_brick': 'Stone Brick'
    }
    
    // Search for blockstates directory recursively
    const assetsFolderPath = join(dataDir, assetsFolder)
    const blockstatesPath = findBlockstatesFolder(assetsFolderPath)
    
    if (!blockstatesPath) {
      console.log(`No blockstates folder found in ${assetsFolder}`)
      return null
    }
    
    console.log(`Found blockstates at: ${blockstatesPath}`)
    
    // Determine the relative path prefix for models based on blockstates location
    // Extract the path from assetsFolder to blockstates parent
    const relativePath = blockstatesPath.replace(assetsFolderPath, assetsFolder).replace(/\\/g, '/')
    const pathParts = relativePath.split('/')
    // Remove 'blockstates' from the end to get the models path prefix
    pathParts.pop()
    const modelsPrefix = pathParts.join('/')
    
    // Read all blockstate files
    const blockstateFiles = readdirSync(blockstatesPath).filter(file =>
      file.endsWith('.json') && statSync(join(blockstatesPath, file)).isFile()
    )
    
    console.log(`Found ${blockstateFiles.length} blockstate files in ${assetsFolder}`)
    
    const blocks = []
    const fs = require('fs')
    
    for (const filename of blockstateFiles) {
      const blockId = filename.replace('.json', '')
      
      // Convert block ID to readable name
      const name = blockId
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      
      // Determine category
      let category = undefined
      for (const [key, cat] of Object.entries(categoryMappings)) {
        if (blockId.includes(key)) {
          category = cat
          break
        }
      }
      
      // Read blockstate JSON to determine variants/states
      const blockstateContent = fs.readFileSync(join(blockstatesPath, filename), 'utf8')
      const blockstate = JSON.parse(blockstateContent)
      
      const block = {
        name: name,
        path: `${modelsPrefix}/models/block/${blockId}.json`
      }
      
      if (category) {
        block.category = category
      }
      
      // Parse variants for complex blocks with states
      if (blockstate.variants) {
        const variantKeys = Object.keys(blockstate.variants)
        
        // If there are multiple variants with properties, add states
        if (variantKeys.length > 1 && variantKeys.some(key => key.includes('='))) {
          const states = []
          const processedModels = new Set()
          
          for (const variantKey of variantKeys) {
            const variant = blockstate.variants[variantKey]
            const variantData = Array.isArray(variant) ? variant[0] : variant
            
            if (variantData.model) {
              // Remove any namespace prefix (minecraft:, biomesoplenty:, etc.)
              const modelPath = variantData.model.replace(/^[^:]+:/, '')
              const modelName = modelPath.split('/').pop()
              
              // Skip duplicate models
              if (processedModels.has(modelName)) continue
              processedModels.add(modelName)
              
              const state = {
                name: variantKey || modelName,
                path: `${modelsPrefix}/models/${modelPath}.json`
              }
              
              // Add orientation if rotations are present
              if (variantData.y !== undefined || variantData.x !== undefined) {
                if (variantKey.includes('facing=north')) state.orientation = 'north'
                else if (variantKey.includes('facing=south')) state.orientation = 'south'
                else if (variantKey.includes('facing=east')) state.orientation = 'east'
                else if (variantKey.includes('facing=west')) state.orientation = 'west'
                else if (variantKey.includes('facing=up')) state.orientation = 'up'
                else if (variantKey.includes('facing=down')) state.orientation = 'down'
              }
              
              states.push(state)
            }
          }
          
          // Only add states if there are interesting variants
          if (states.length > 1 && states.length < 50) {
            block.states = states
          }
        }
      }
      
      blocks.push(block)
    }
    
    // Sort blocks alphabetically
    blocks.sort((a, b) => a.name.localeCompare(b.name))
    
    const output = {
      blocks: blocks
    }
    
    // Write blocks.json to the assets folder directory
    const blocksJsonPath = join(dataDir, assetsFolder, 'blocks.json')
    writeFileSync(blocksJsonPath, JSON.stringify(output, null, 2))
    
    console.log(`Generated blocks.json for ${assetsFolder} with ${blocks.length} blocks`)
    console.log('Blocks saved to:', blocksJsonPath)
    
    return blocksJsonPath
    
  } catch (error) {
    console.error(`Error generating blocks.json for ${assetsFolder}:`, error)
    return null
  }
}

// Function to scan data directory for folders containing "assets" and generate blocks.json for each
function generateAllBlocksJson() {
  try {
    const dataDir = join(app.getPath('userData'), 'data')
    
    if (!existsSync(dataDir)) {
      console.log('Data directory does not exist yet')
      return
    }
    
    // List all items in data directory
    const items = readdirSync(dataDir)
    
    // Filter for directories that contain "assets" in their name
    const assetsFolders = items.filter(item => {
      const itemPath = join(dataDir, item)
      return statSync(itemPath).isDirectory() && item.toLowerCase().includes('assets')
    })
    
    console.log(`Found ${assetsFolders.length} folders containing "assets": ${assetsFolders.join(', ')}`)
    
    // Generate blocks.json for each assets folder
    const generatedFiles = []
    assetsFolders.forEach(folder => {
      const result = generateBlocksJsonForFolder(dataDir, folder)
      if (result) {
        generatedFiles.push(result)
      }
    })
    
    // Also generate the main blocks.json that combines all packs (for backwards compatibility)
    if (generatedFiles.length > 0) {
      // Merge all blocks.json files into one
      const fs = require('fs')
      const allBlocks = []
      
      for (const filePath of generatedFiles) {
        const data = fs.readFileSync(filePath, 'utf8')
        const blocksData = JSON.parse(data)
        if (blocksData.blocks && Array.isArray(blocksData.blocks)) {
          allBlocks.push(...blocksData.blocks)
        }
      }
      
      // Sort merged blocks alphabetically
      allBlocks.sort((a, b) => a.name.localeCompare(b.name))
      
      const mergedOutput = {
        blocks: allBlocks
      }
      
      writeFileSync(join(dataDir, 'blocks.json'), JSON.stringify(mergedOutput, null, 2))
      console.log(`Merged blocks.json created with ${allBlocks.length} total blocks from ${generatedFiles.length} asset packs`)
    }
    
  } catch (error) {
    console.error('Error generating blocks.json files:', error)
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
    
    // Generate blocks.json for all asset folders
    generateAllBlocksJson()
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
      // Read from the generated blocks.json file in data directory
      const dataDir = join(app.getPath('userData'), 'data')
      const blocksJsonPath = join(dataDir, 'blocks.json')
      
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
      
      console.log(`Loading block model: ${blockPath}`)
      console.log(`Full path: ${fullPath}`)
      
      if (existsSync(fullPath)) {
        console.log(`Found model at: ${fullPath}`)
        const fs = await import('fs/promises')
        const data = await fs.readFile(fullPath, 'utf-8')
        return JSON.parse(data)
      } else {
        console.log(`Model not found at: ${fullPath}`)
        
        // Check if the path is relative (no namespace/folder prefix)
        // e.g., "block/cube_all" without a proper assets folder prefix
        const pathParts = blockPath.split('/')
        
        // If path starts with "block/" or "item/" (no namespace), try SimplyRemadeAssetsV1
        if (pathParts[0] === 'block' || pathParts[0] === 'item') {
          const minecraftFallback = join(dataDir, `SimplyRemadeAssetsV1/assets/minecraft/models/${blockPath}`)
          
          console.log(`Trying minecraft namespace fallback: ${minecraftFallback}`)
          
          if (existsSync(minecraftFallback)) {
            console.log(`Using minecraft namespace fallback: ${minecraftFallback}`)
            const fs = await import('fs/promises')
            const data = await fs.readFile(minecraftFallback, 'utf-8')
            return JSON.parse(data)
          } else {
            console.log(`Minecraft fallback not found at: ${minecraftFallback}`)
          }
        }
        
        // Try fallback to 1.json if the requested model doesn't exist
        const fallback1Json = join(dataDir, 'SimplyRemadeAssetsV1/assets/minecraft/models/block/1.json')
        
        if (existsSync(fallback1Json)) {
          console.log(`Using fallback: 1.json`)
          const fs = await import('fs/promises')
          const data = await fs.readFile(fallback1Json, 'utf-8')
          return JSON.parse(data)
        } else {
          console.log(`Fallback 1.json not found at: ${fallback1Json}`)
          return { error: 'Block model file not found and fallback 1.json not available' }
        }
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
      
      console.log(`Loading texture: ${texturePath}`)
      
      // Handle paths with namespace (namespace:path/to/texture)
      // Some paths might have double namespace like "minecraft:biomesoplenty:block/dead_log"
      // We need to extract the real namespace (the last one before the path)
      if (texturePath.includes(':')) {
        // Split by all colons and identify the real namespace
        const parts = texturePath.split(':')
        
        let namespace, path
        if (parts.length > 2) {
          // Format: "minecraft:biomesoplenty:block/dead_log_top"
          // The real namespace is the second to last part, path is the last part
          namespace = parts[parts.length - 2]
          path = parts[parts.length - 1]
          console.log(`Found double namespace format - using namespace: ${namespace}, path: ${path}`)
        } else {
          // Format: "biomesoplenty:block/dead_log"
          namespace = parts[0]
          path = parts[1]
          console.log(`Detected namespace: ${namespace}, path: ${path}`)
        }
        
        // First try to find the asset folder corresponding to the namespace
        // Look for folders containing "assets" in their name
        const items = readdirSync(dataDir)
        
        for (const item of items) {
          const itemPath = join(dataDir, item)
          try {
            if (statSync(itemPath).isDirectory() && item.toLowerCase().includes('assets')) {
              // Check if this assets folder has the namespace directory
              const namespacePath = join(itemPath, 'assets', namespace, 'textures', path + '.png')
              console.log(`Checking: ${namespacePath}`)
              if (existsSync(namespacePath)) {
                console.log(`Found texture at: ${namespacePath}`)
                const fs = await import('fs/promises')
                const data = await fs.readFile(namespacePath)
                return {
                  data: data.toString('base64'),
                  path: namespacePath
                }
              }
            }
          } catch (err) {
            console.log(`Error checking ${itemPath}:`, err.message)
            continue
          }
        }
        
        console.log(`Namespace texture not found, trying fallback for ${namespace}:${path}`)
      }
      
      // Try fallback to 1.png if the requested texture doesn't exist
      const fallbackPath = join(dataDir, 'SimplyRemadeAssetsV1/assets/minecraft/textures/block/1.png')
      
      if (existsSync(fallbackPath)) {
        console.log(`Using fallback: 1.png`)
        const fs = await import('fs/promises')
        const data = await fs.readFile(fallbackPath)
        return {
          data: data.toString('base64'),
          path: fallbackPath
        }
      } else {
        return { error: 'Texture file not found and fallback 1.png not available', path: texturePath }
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
