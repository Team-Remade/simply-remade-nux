import { app, shell, BrowserWindow, ipcMain, screen, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/appIcon01.png?asset'
import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs'

// Track all preview windows
const previewWindows = new Set()

// Reference to loading window
let loadingWindow = null

// Enable hardware acceleration optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('enable-webgl')
app.commandLine.appendSwitch('enable-webgl2-compute-context')
app.commandLine.appendSwitch('ignore-gpu-blocklist')

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: '#1e3c72',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  loadingWindow.center()

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    loadingWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/loading.html')
  } else {
    loadingWindow.loadFile(join(__dirname, '../renderer/loading.html'))
  }

  return loadingWindow
}

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
    // Close loading window if it exists
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close()
      loadingWindow = null
    }
    mainWindow.show()
  })

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized')
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized')
  })

  // Close all preview windows when main window closes
  mainWindow.on('close', () => {
    previewWindows.forEach(previewWin => {
      if (previewWin && !previewWin.isDestroyed()) {
        previewWin.close()
      }
    })
    previewWindows.clear()
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

// Function to recursively search for models/item folder
function findItemsFolder(startPath) {
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
            // Check if this is models/item directory
            if (item.toLowerCase() === 'item' && currentPath.endsWith('models')) {
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

// Function to generate items.json from models/item folder for a given assets folder
function generateItemsJsonForFolder(dataDir, assetsFolder, sendProgress = null) {
  try {
    console.log(`Generating items.json for ${assetsFolder}...`)
    
    if (sendProgress) {
      sendProgress(`Generating items for ${assetsFolder}`, assetsFolder)
    }
    
    // Category mappings based on item names
    const categoryMappings = {
      '_sword': 'Sword',
      '_pickaxe': 'Pickaxe',
      '_axe': 'Axe',
      '_shovel': 'Shovel',
      '_hoe': 'Hoe',
      '_helmet': 'Helmet',
      '_chestplate': 'Chestplate',
      '_leggings': 'Leggings',
      '_boots': 'Boots',
      '_ingot': 'Ingot',
      '_nugget': 'Nugget',
      'potion': 'Potion',
      'spawn_egg': 'Spawn Egg',
      'bucket': 'Bucket',
      'arrow': 'Arrow'
    }
    
    // Search for items directory recursively
    const assetsFolderPath = join(dataDir, assetsFolder)
    const itemsPath = findItemsFolder(assetsFolderPath)
    
    if (!itemsPath) {
      console.log(`No models/item folder found in ${assetsFolder}`)
      return null
    }
    
    console.log(`Found items at: ${itemsPath}`)
    
    // Determine the relative path prefix for models based on items location
    const relativePath = itemsPath.replace(assetsFolderPath, assetsFolder).replace(/\\/g, '/')
    const pathParts = relativePath.split('/')
    // Remove 'item' from the end to get the models path prefix
    pathParts.pop()
    const modelsPrefix = pathParts.join('/')
    
    // Read all item model files
    const itemFiles = readdirSync(itemsPath).filter(file =>
      file.endsWith('.json') && statSync(join(itemsPath, file)).isFile()
    )
    
    console.log(`Found ${itemFiles.length} item files in ${assetsFolder}`)
    
    const items = []
    const fs = require('fs')
    
    for (const filename of itemFiles) {
      const itemId = filename.replace('.json', '')
      
      // Read item model JSON to check parent
      const itemModelPath = join(itemsPath, filename)
      const itemModelContent = fs.readFileSync(itemModelPath, 'utf8')
      const itemModel = JSON.parse(itemModelContent)
      
      // Skip items that inherit from block models
      if (itemModel.parent && itemModel.parent.includes('block/')) {
        console.log(`Skipping ${itemId} - inherits from block model: ${itemModel.parent}`)
        continue
      }
      
      // Check if item inherits from handheld or handheld_rod
      let shouldReplaceWithGenerated = false
      if (itemModel.parent) {
        const parent = itemModel.parent.toLowerCase()
        if (parent.includes('handheld')) {
          shouldReplaceWithGenerated = true
          console.log(`${itemId} uses handheld model, will replace with generated`)
        }
      }
      
      // Convert item ID to readable name
      const name = itemId
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      
      // Determine category
      let category = undefined
      for (const [key, cat] of Object.entries(categoryMappings)) {
        if (itemId.includes(key)) {
          category = cat
          break
        }
      }
      
      const item = {
        name: name,
        path: `${modelsPrefix}/item/${itemId}.json`,
        useGenerated: shouldReplaceWithGenerated
      }
      
      if (category) {
        item.category = category
      }
      
      items.push(item)
    }
    
    // Sort items alphabetically
    items.sort((a, b) => a.name.localeCompare(b.name))
    
    const output = {
      items: items
    }
    
    // Write items.json to the assets folder directory
    const itemsJsonPath = join(dataDir, assetsFolder, 'items.json')
    writeFileSync(itemsJsonPath, JSON.stringify(output, null, 2))
    
    console.log(`Generated items.json for ${assetsFolder} with ${items.length} items`)
    console.log('Items saved to:', itemsJsonPath)
    
    return itemsJsonPath
    
  } catch (error) {
    console.error(`Error generating items.json for ${assetsFolder}:`, error)
    return null
  }
}

// Function to generate blocks.json from blockstates for a given assets folder
function generateBlocksJsonForFolder(dataDir, assetsFolder, sendProgress = null) {
  try {
    console.log(`Generating blocks.json for ${assetsFolder}...`)
    
    if (sendProgress) {
      sendProgress(`Generating blocks for ${assetsFolder}`, assetsFolder)
    }
    
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

// Function to scan data directory for folders containing "assets" and generate blocks.json and items.json for each
function generateAllBlocksJson(sendProgress = null) {
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
    
    if (sendProgress) {
      sendProgress(`Found ${assetsFolders.length} asset folders`, 'Scanning...', 10)
    }
    
    // Generate blocks.json and items.json for each assets folder
    const generatedBlockFiles = []
    const generatedItemFiles = []
    assetsFolders.forEach((folder, index) => {
      const progress = 10 + ((index / assetsFolders.length) * 80)
      
      if (sendProgress) {
        sendProgress(`Processing ${folder}`, folder, progress)
      }
      
      const blockResult = generateBlocksJsonForFolder(dataDir, folder, (status, currentFolder) => {
        if (sendProgress) {
          sendProgress(status, currentFolder, progress)
        }
      })
      if (blockResult) {
        generatedBlockFiles.push(blockResult)
      }
      
      const itemResult = generateItemsJsonForFolder(dataDir, folder, (status, currentFolder) => {
        if (sendProgress) {
          sendProgress(status, currentFolder, progress + 5)
        }
      })
      if (itemResult) {
        generatedItemFiles.push(itemResult)
      }
    })
    
    // Also generate the main blocks.json that combines all packs (for backwards compatibility)
    if (generatedBlockFiles.length > 0) {
      // Merge all blocks.json files into one
      const fs = require('fs')
      const allBlocks = []
      
      for (const filePath of generatedBlockFiles) {
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
      console.log(`Merged blocks.json created with ${allBlocks.length} total blocks from ${generatedBlockFiles.length} asset packs`)
    }
    
    // Also generate the main items.json that combines all packs
    if (generatedItemFiles.length > 0) {
      // Merge all items.json files into one
      const fs = require('fs')
      const allItems = []
      
      for (const filePath of generatedItemFiles) {
        const data = fs.readFileSync(filePath, 'utf8')
        const itemsData = JSON.parse(data)
        if (itemsData.items && Array.isArray(itemsData.items)) {
          allItems.push(...itemsData.items)
        }
      }
      
      // Sort merged items alphabetically
      allItems.sort((a, b) => a.name.localeCompare(b.name))
      
      const mergedOutput = {
        items: allItems
      }
      
      writeFileSync(join(dataDir, 'items.json'), JSON.stringify(mergedOutput, null, 2))
      console.log(`Merged items.json created with ${allItems.length} total items from ${generatedItemFiles.length} asset packs`)
    }
    
  } catch (error) {
    console.error('Error generating blocks.json files:', error)
  }
}

// Function to scan and cache block textures
function scanBlockTextures(sendProgress = null) {
  try {
    const dataDir = join(app.getPath('userData'), 'data')
    const blockTextures = []
    
    if (sendProgress) {
      sendProgress('Scanning block textures...', 'textures/block', 90)
    }
    
    // Read all items in data directory
    const items = readdirSync(dataDir)
    
    // Filter for directories that contain "assets" in their name
    const assetsFolders = items.filter(item => {
      const itemPath = join(dataDir, item)
      return statSync(itemPath).isDirectory() && item.toLowerCase().includes('assets')
    })
    
    console.log(`Scanning ${assetsFolders.length} asset folders for block textures...`)
    
    // Scan each assets folder for block textures
    for (const assetsFolder of assetsFolders) {
      const assetsFolderPath = join(dataDir, assetsFolder)
      
      if (sendProgress) {
        sendProgress(`Scanning textures in ${assetsFolder}`, assetsFolder, 92)
      }
      
      try {
        // Look for textures/block folders recursively
        const findTexturesFolders = (startPath) => {
          const toSearch = [startPath]
          const texturesFolders = []
          
          while (toSearch.length > 0) {
            const currentPath = toSearch.shift()
            
            try {
              const dirItems = readdirSync(currentPath)
              
              for (const dirItem of dirItems) {
                const dirItemPath = join(currentPath, dirItem)
                
                try {
                  const stats = statSync(dirItemPath)
                  
                  if (stats.isDirectory()) {
                    // Check if this is a block texture directory
                    if (dirItem.toLowerCase() === 'block' && currentPath.endsWith('textures')) {
                      texturesFolders.push(dirItemPath)
                    } else {
                      // Add to search queue
                      toSearch.push(dirItemPath)
                    }
                  }
                } catch {
                  continue
                }
              }
            } catch {
              continue
            }
          }
          
          return texturesFolders
        }
        
        const blockTextureFolders = findTexturesFolders(assetsFolderPath)
        
        // Scan each block texture folder for PNG files
        for (const blockTextureFolder of blockTextureFolders) {
          try {
            const textureFiles = readdirSync(blockTextureFolder).filter(file =>
              file.endsWith('.png') && statSync(join(blockTextureFolder, file)).isFile()
            )
            
            // Determine the namespace from the path
            const relativePath = blockTextureFolder.replace(assetsFolderPath, '').replace(/\\/g, '/')
            const pathParts = relativePath.split('/').filter(p => p)
            
            // Expected structure: assets/namespace/textures/block
            let namespace = 'minecraft'
            for (let i = 0; i < pathParts.length; i++) {
              if (pathParts[i] === 'assets' && i + 1 < pathParts.length) {
                namespace = pathParts[i + 1]
                break
              }
            }
            
            for (const textureFile of textureFiles) {
              const textureName = textureFile.replace('.png', '')
              
              // Convert texture name to readable name
              const displayName = textureName
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              
              blockTextures.push({
                name: displayName,
                path: `${namespace}:block/${textureName}`,
                category: namespace === 'minecraft' ? 'Minecraft' : namespace.charAt(0).toUpperCase() + namespace.slice(1)
              })
            }
          } catch (error) {
            console.error(`Error reading textures from ${blockTextureFolder}:`, error)
          }
        }
      } catch (error) {
        console.error(`Error scanning ${assetsFolder} for block textures:`, error)
      }
    }
    
    // Sort textures alphabetically
    blockTextures.sort((a, b) => a.name.localeCompare(b.name))
    
    console.log(`Found ${blockTextures.length} block textures`)
    
    // Cache the results to a JSON file for faster subsequent loads
    const cacheFile = join(dataDir, 'block-textures-cache.json')
    writeFileSync(cacheFile, JSON.stringify({ textures: blockTextures }, null, 2))
    
    if (sendProgress) {
      sendProgress('Block textures scanned', `${blockTextures.length} textures found`, 95)
    }
    
    return blockTextures
  } catch (error) {
    console.error('Error scanning block textures:', error)
    return []
  }
}

// Function to scan and cache item textures
async function scanItemTextures(sendProgress = null) {
  try {
    const dataDir = join(app.getPath('userData'), 'data')
    const itemsJsonPath = join(dataDir, 'items.json')
    const itemTextures = {}
    
    if (!existsSync(itemsJsonPath)) {
      console.log('No items.json found, skipping item texture scan')
      return {}
    }
    
    if (sendProgress) {
      sendProgress('Scanning item textures...', 'items/', 95)
    }
    
    const fs = await import('fs/promises')
    const itemsData = await fs.readFile(itemsJsonPath, 'utf-8')
    const items = JSON.parse(itemsData).items || []
    
    console.log(`Scanning textures for ${items.length} items...`)
    
    // Process items in parallel for faster loading
    const promises = items.map(async (item, index) => {
      try {
        // Load the item model to get the texture
        const fullPath = join(dataDir, item.path)
        
        if (existsSync(fullPath)) {
          const itemModelData = await fs.readFile(fullPath, 'utf-8')
          const itemModel = JSON.parse(itemModelData)
          
          if (itemModel && itemModel.textures && itemModel.textures.layer0) {
            const textureRef = itemModel.textures.layer0
            
            // Load texture using the existing load texture logic
            const textureData = await loadTextureData(textureRef, dataDir)
            if (textureData && textureData.data) {
              itemTextures[item.path] = 'data:image/png;base64,' + textureData.data
            }
          }
        }
        
        // Update progress occasionally
        if (index % 100 === 0 && sendProgress) {
          const progress = 95 + ((index / items.length) * 3) // 95-98%
          sendProgress(`Loading item textures... (${index}/${items.length})`, `${Math.floor((index / items.length) * 100)}% complete`, progress)
        }
      } catch (error) {
        // Silently skip items that fail to load
        console.log(`Skipping texture for ${item.path}:`, error.message)
      }
    })
    
    await Promise.all(promises)
    
    console.log(`Loaded ${Object.keys(itemTextures).length} item textures`)
    
    // Cache the results
    const cacheFile = join(dataDir, 'item-textures-cache.json')
    await fs.writeFile(cacheFile, JSON.stringify(itemTextures, null, 2))
    
    if (sendProgress) {
      sendProgress('Item textures scanned', `${Object.keys(itemTextures).length} textures loaded`, 98)
    }
    
    return itemTextures
  } catch (error) {
    console.error('Error scanning item textures:', error)
    return {}
  }
}

// Helper function to load texture data
async function loadTextureData(texturePath, dataDir) {
  try {
    // Handle paths with namespace (namespace:path/to/texture)
    if (texturePath.includes(':')) {
      const parts = texturePath.split(':')
      
      let namespace, path
      if (parts.length > 2) {
        namespace = parts[parts.length - 2]
        path = parts[parts.length - 1]
      } else {
        namespace = parts[0]
        path = parts[1]
      }
      
      // Look for folders containing "assets" in their name
      const items = readdirSync(dataDir)
      
      for (const item of items) {
        const itemPath = join(dataDir, item)
        try {
          if (statSync(itemPath).isDirectory() && item.toLowerCase().includes('assets')) {
            // Check if this assets folder has the namespace directory
            const namespacePath = join(itemPath, 'assets', namespace, 'textures', path + '.png')
            if (existsSync(namespacePath)) {
              const fs = await import('fs/promises')
              const data = await fs.readFile(namespacePath)
              return {
                data: data.toString('base64'),
                path: namespacePath
              }
            }
          }
        } catch (err) {
          continue
        }
      }
    }
    
    // Try fallback
    const fallbackPath = join(dataDir, 'SimplyRemadeAssetsV1/assets/minecraft/textures/block/1.png')
    if (existsSync(fallbackPath)) {
      const fs = await import('fs/promises')
      const data = await fs.readFile(fallbackPath)
      return {
        data: data.toString('base64'),
        path: fallbackPath
      }
    }
    
    return null
  } catch (error) {
    return null
  }
}

// Function to extract assets on startup
async function extractAssets(sendProgress = null) {
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
      
      if (sendProgress) {
        sendProgress('Extracting assets...', 'SimplyRemadeAssetsV1.zip', 5)
      }
      
      // Create data directory
      mkdirSync(dataDir, { recursive: true })
      
      // Extract zip file
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(dataDir, true)
      
      console.log('Assets extracted successfully to:', dataDir)
      
      if (sendProgress) {
        sendProgress('Assets extracted', dataDir, 10)
      }
    } else {
      console.log('Data directory already exists, skipping extraction.')
      
      if (sendProgress) {
        sendProgress('Assets already exist', dataDir, 10)
      }
    }
    
    // Generate blocks.json for all asset folders
    generateAllBlocksJson(sendProgress)
    
    // Scan block textures
    scanBlockTextures(sendProgress)
    
    // Scan item textures
    await scanItemTextures(sendProgress)
    
    if (sendProgress) {
      sendProgress('Complete!', 'All resources loaded', 100)
    }
  } catch (error) {
    console.error('Error extracting assets:', error)
    if (sendProgress) {
      sendProgress('Error loading assets', error.message, 100)
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Create loading window first
  createLoadingWindow()

  // Wait for loading window to be ready before starting asset extraction
  loadingWindow.webContents.once('did-finish-load', async () => {
    // Extract assets with progress reporting
    await extractAssets((status, folder, progress) => {
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        loadingWindow.webContents.send('loading-progress', {
          status,
          folder,
          progress
        })
      }
    })

    // Send completion signal
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.webContents.send('loading-complete')
    }

    // Wait a moment to show completion, then create main window
    setTimeout(() => {
      createWindow()
    }, 500)
  })

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

  // Handler to get items data
  ipcMain.handle('get-items', async () => {
    try {
      // Read from the generated items.json file in data directory
      const dataDir = join(app.getPath('userData'), 'data')
      const itemsJsonPath = join(dataDir, 'items.json')
      
      if (existsSync(itemsJsonPath)) {
        const fs = await import('fs/promises')
        const data = await fs.readFile(itemsJsonPath, 'utf-8')
        return JSON.parse(data)
      } else {
        return { items: [], error: 'items.json not found' }
      }
    } catch (error) {
      console.error('Error reading items data:', error)
      return { items: [], error: error.message }
    }
  })

  // Handler to get cached item textures
  ipcMain.handle('get-item-textures', async () => {
    try {
      const dataDir = join(app.getPath('userData'), 'data')
      const cacheFile = join(dataDir, 'item-textures-cache.json')
      
      // Try to read from cache
      if (existsSync(cacheFile)) {
        console.log('Loading item textures from cache...')
        const fs = await import('fs/promises')
        const data = await fs.readFile(cacheFile, 'utf-8')
        return JSON.parse(data)
      } else {
        console.log('Item textures cache not found')
        return {}
      }
    } catch (error) {
      console.error('Error getting item textures:', error)
      return {}
    }
  })

  // Handler to get block textures - uses cached data from initial scan
  ipcMain.handle('get-block-textures', async () => {
    try {
      const dataDir = join(app.getPath('userData'), 'data')
      const cacheFile = join(dataDir, 'block-textures-cache.json')
      
      // Try to read from cache first
      if (existsSync(cacheFile)) {
        console.log('Loading block textures from cache...')
        const fs = await import('fs/promises')
        const data = await fs.readFile(cacheFile, 'utf-8')
        return JSON.parse(data)
      } else {
        // If cache doesn't exist, scan now and cache
        console.log('Cache not found, scanning block textures now...')
        const textures = scanBlockTextures()
        return { textures }
      }
    } catch (error) {
      console.error('Error getting block textures:', error)
      return { textures: [], error: error.message }
    }
  })

  // Handler to get characters (scan for GLB files in data directory)
  ipcMain.handle('get-characters', async () => {
    try {
      // Check data folder for GLB files (recursively scan all asset folders)
      const dataDir = join(app.getPath('userData'), 'data')
      
      console.log('Scanning for characters in:', dataDir)
      
      if (!existsSync(dataDir)) {
        console.log('Data directory does not exist')
        return { characters: [] }
      }
      
      const characters = []
      
      // Recursive function to scan directories for GLB files
      const scanDirectory = (dir, relativePath = '') => {
        try {
          const items = readdirSync(dir)
          
          for (const item of items) {
            const fullPath = join(dir, item)
            const stats = statSync(fullPath)
            
            if (stats.isDirectory()) {
              // Recursively scan subdirectories
              const newRelativePath = relativePath ? `${relativePath}/${item}` : item
              scanDirectory(fullPath, newRelativePath)
            } else if (stats.isFile() && item.toLowerCase().endsWith('.glb')) {
              // Found a GLB file
              // Convert filename to readable name
              const name = item.replace('.glb', '')
                .split(/[-_]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              
              const pathInData = relativePath ? `${relativePath}/${item}` : item
              
              characters.push({
                name: name,
                path: pathInData, // Path relative to data directory
                fileName: item,
                fullPath: fullPath
              })
            }
          }
        } catch (error) {
          console.error(`Error scanning directory ${dir}:`, error)
        }
      }
      
      scanDirectory(dataDir)
      
      console.log(`Found ${characters.length} character files`)
      
      return { characters }
    } catch (error) {
      console.error('Error scanning for characters:', error)
      return { characters: [], error: error.message }
    }
  })

  // Handler to load a GLB character file
  ipcMain.handle('load-character-glb', async (event, characterPath) => {
    try {
      const dataDir = join(app.getPath('userData'), 'data')
      const fullPath = join(dataDir, characterPath)
      
      console.log(`Loading character GLB from: ${fullPath}`)
      
      if (existsSync(fullPath)) {
        const fs = await import('fs/promises')
        const data = await fs.readFile(fullPath)
        return {
          data: data.toString('base64'),
          path: fullPath
        }
      } else {
        return { error: 'GLB file not found', path: characterPath }
      }
    } catch (error) {
      console.error('Error loading character GLB:', error)
      return { error: error.message }
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

  // Handler to create a new preview window
  ipcMain.handle('create-preview-window', async () => {
    try {
      const previewWindow = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        icon: icon,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: false,
          webgl: true,
          acceleratedGraphics: true,
          hardwareAcceleration: true
        },
        backgroundColor: '#2c2e29',
        titleBarStyle: 'hidden'
      })

      // Track preview window
      previewWindows.add(previewWindow)

      // Remove from tracking when closed
      previewWindow.on('closed', () => {
        previewWindows.delete(previewWindow)
      })

      // Load preview page with URL parameter
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        previewWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?preview=true')
      } else {
        previewWindow.loadFile(join(__dirname, '../renderer/index.html'), {
          query: { preview: 'true' }
        })
      }

      return { success: true }
    } catch (error) {
      console.error('Error creating preview window:', error)
      return { success: false, error: error.message }
    }
  })

  // Don't create window here anymore - it's created after asset loading completes

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
