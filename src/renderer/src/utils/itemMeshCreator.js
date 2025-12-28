import * as THREE from 'three'
import { loadTextureFromData } from './blockMeshCreator.js'

// Helper function to load and merge parent models
const loadModelWithParents = async (modelPath, window, visited = new Set()) => {
  if (visited.has(modelPath)) {
    console.warn('Circular parent reference detected:', modelPath)
    return null
  }
  visited.add(modelPath)
  
  const model = await window.api.loadBlockModel(modelPath)
  if (model.error) {
    return null
  }
  
  // If model has a parent, load and merge it
  if (model.parent) {
    // Check if parent is the built-in generated model
    const parentRef = model.parent.replace(/^[^:]+:/, '')
    if (parentRef === 'builtin/generated' || parentRef === 'item/generated' || parentRef.includes('/generated')) {
      // For generated models, we don't need to load the parent
      // Just return the model with a flag indicating it should use generated rendering
      return {
        ...model,
        isGenerated: true
      }
    }
    
    // Strip namespace from parent and pass as relative path to let load-block-model handler resolve it
    const parentPath = parentRef + '.json'
    const parentModel = await loadModelWithParents(parentPath, window, visited)
    
    if (parentModel) {
      // Merge parent into current model
      // Parent properties are defaults, child overrides
      return {
        ...parentModel,
        ...model,
        textures: { ...parentModel.textures, ...model.textures },
        elements: model.elements || parentModel.elements
      }
    }
  }
  
  return model
}

// Helper function to create item mesh - either flat plane or 3D voxelized
const createGeneratedItemMesh = async (texture, obj) => {
  // Check render mode - default to voxel if not specified
  const renderMode = obj.itemRenderMode || 'voxel'
  
  if (renderMode === 'plane') {
    // Create a simple flat plane with the texture
    const geometry = new THREE.PlaneGeometry(1, 1)
    
    // Apply pivot offset to geometry (inverted)
    geometry.translate(
      -obj.pivotOffset.x,
      -obj.pivotOffset.y,
      -obj.pivotOffset.z
    )
    
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: obj.opacity,
      side: THREE.DoubleSide,
      alphaTest: 0.1
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    
    // Create parent container for transforms
    const container = new THREE.Object3D()
    container.add(mesh)
    
    // Apply user transforms to container
    container.position.set(obj.position.x, obj.position.y, obj.position.z)
    container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
    container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
    
    // Store reference to scene object for picking
    container.userData.sceneObjectId = obj.id
    mesh.userData.sceneObjectId = obj.id
    container.userData.pivotOffset = { ...obj.pivotOffset }
    
    return container
  }
  
  // Otherwise create 3D voxel mesh (renderMode === 'voxel')
  // Create a canvas to read pixel data from the texture
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = texture.image
  
  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, img.width, img.height)
  const pixels = imageData.data
  
  // Create a group to hold all pixel cubes
  const group = new THREE.Group()
  
  // Scale factor - make each pixel smaller to create a detailed model
  const pixelSize = 1 / 16 // Minecraft items are typically 16x16
  
  // Iterate through each pixel
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const index = (y * img.width + x) * 4
      const r = pixels[index]
      const g = pixels[index + 1]
      const b = pixels[index + 2]
      const a = pixels[index + 3]
      
      // Skip transparent pixels
      if (a < 10) continue
      
      // Create a small cube for this pixel (depth = 1 pixel)
      const geometry = new THREE.BoxGeometry(pixelSize, pixelSize, pixelSize)
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r / 255, g / 255, b / 255),
        transparent: a < 255,
        opacity: a / 255,
        alphaTest: 0.1
      })
      
      const cube = new THREE.Mesh(geometry, material)
      
      // Position the cube
      // Center the entire model and flip Y (image coordinates are top-down)
      const posX = (x - img.width / 2) * pixelSize + pixelSize / 2
      const posY = (img.height / 2 - y) * pixelSize - pixelSize / 2
      const posZ = 0
      
      cube.position.set(posX, posY, posZ)
      cube.userData.sceneObjectId = obj.id
      
      group.add(cube)
    }
  }
  
  // Apply pivot offset to the entire group
  group.position.set(
    -obj.pivotOffset.x,
    -obj.pivotOffset.y,
    -obj.pivotOffset.z
  )
  
  // Create parent container for transforms
  const container = new THREE.Object3D()
  container.add(group)
  
  // Apply user transforms to container
  container.position.set(obj.position.x, obj.position.y, obj.position.z)
  container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
  container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
  
  // Store reference to scene object for picking
  container.userData.sceneObjectId = obj.id
  container.userData.pivotOffset = { ...obj.pivotOffset }
  container.userData.isGroup = true
  
  return container
}

// Helper function to create item mesh from Minecraft JSON model
export const createItemMesh = async (obj, window) => {
  try {
    // Load the item model JSON with parents
    const itemModel = await loadModelWithParents(obj.itemPath, window)
    
    if (!itemModel || itemModel.error) {
      console.error('Error loading item model:', itemModel.error || 'Model not found')
      return null
    }
    
    // Initialize opacity if not set
    if (obj.opacity === undefined) {
      obj.opacity = 1
    }
    
    // Initialize pivot offset if not set
    if (obj.pivotOffset === undefined) {
      obj.pivotOffset = { x: 0, y: -0.5, z: 0 }
    }
    
    // Check if we should use generated model (for handheld items or items with builtin/generated parent)
    if (obj.useGenerated || itemModel.isGenerated) {
      console.log('Using generated model for item:', obj.name)
      
      // For generated models, we just need the layer0 texture
      if (itemModel.textures && itemModel.textures.layer0) {
        const textureData = await window.api.loadTexture(itemModel.textures.layer0)
        const texture = await loadTextureFromData(textureData)
        
        if (texture) {
          return createGeneratedItemMesh(texture, obj)
        }
      }
      
      console.warn('No layer0 texture found for generated item model')
      return null
    }
    
    // Check if model has custom elements (complex Minecraft JSON model)
    if (itemModel.elements && Array.isArray(itemModel.elements)) {
      // Load textures referenced in the model
      const textureCache = {}
      if (itemModel.textures) {
        for (const [key, value] of Object.entries(itemModel.textures)) {
          // Skip texture references that start with # (these reference other textures in the same model)
          if (!value.startsWith('#')) {
            const texturePath = value.startsWith('minecraft:') ? value : `minecraft:${value}`
            const textureData = await window.api.loadTexture(texturePath)
            textureCache[`#${key}`] = await loadTextureFromData(textureData)
          }
        }
      }
      
      // Resolve texture references (handle #references)
      const resolveTexture = (ref) => {
        if (!ref || !ref.startsWith('#')) return null
        
        // Check if already loaded
        if (textureCache[ref]) return textureCache[ref]
        
        // Follow the reference chain
        let current = ref
        const visited = new Set()
        while (current && current.startsWith('#') && itemModel.textures) {
          if (visited.has(current)) break // Prevent infinite loops
          visited.add(current)
          
          const key = current.substring(1)
          const value = itemModel.textures[key]
          if (!value) break
          
          if (!value.startsWith('#')) {
            // Found actual texture path - check cache
            const cacheKey = `#${key}`
            if (textureCache[cacheKey]) {
              textureCache[ref] = textureCache[cacheKey]
              return textureCache[ref]
            }
            break
          }
          current = value
        }
        return textureCache[ref] || null
      }
      
      // Create a group to hold all element meshes
      const group = new THREE.Group()
      
      for (const element of itemModel.elements) {
        // Convert Minecraft coordinates (0-16 scale) to Three.js units (0-1 scale)
        const from = element.from.map(v => v / 16)
        const to = element.to.map(v => v / 16)
        
        const width = to[0] - from[0]
        const height = to[1] - from[1]
        const depth = to[2] - from[2]
        
        // Create box geometry
        const boxGeometry = new THREE.BoxGeometry(width, height, depth)
        
        // Position the box at the center of its bounds
        const centerX = (from[0] + to[0]) / 2 - 0.5
        const centerY = (from[1] + to[1]) / 2 - 0.5
        const centerZ = (from[2] + to[2]) / 2 - 0.5
        
        boxGeometry.translate(centerX, centerY, centerZ)
        
        // Create materials for each face if specified
        if (element.faces) {
          const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north']
          const faceMaterials = []
          
          const uvAttribute = boxGeometry.attributes.uv
          
          for (let faceIndex = 0; faceIndex < faceOrder.length; faceIndex++) {
            const faceName = faceOrder[faceIndex]
            const face = element.faces[faceName]
            
            if (face && face.texture) {
              const texture = resolveTexture(face.texture)
              if (texture) {
                const faceTexture = texture.clone()
                faceTexture.needsUpdate = true
                faceTexture.wrapS = THREE.RepeatWrapping
                faceTexture.wrapT = THREE.RepeatWrapping
                
                const imgWidth = texture.image.width
                const imgHeight = texture.image.height
                
                let u1, v1, u2, v2
                
                if (face.uv) {
                  u1 = face.uv[0] / imgWidth
                  v1 = 1 - (face.uv[3] / imgHeight)
                  u2 = face.uv[2] / imgWidth
                  v2 = 1 - (face.uv[1] / imgHeight)
                } else {
                  const fromMC = element.from
                  const toMC = element.to
                  
                  switch(faceName) {
                    case 'east':
                    case 'west':
                      u1 = fromMC[2] / 16
                      u2 = toMC[2] / 16
                      v1 = fromMC[1] / 16
                      v2 = toMC[1] / 16
                      break
                    case 'up':
                      u1 = fromMC[0] / imgWidth
                      u2 = toMC[0] / imgWidth
                      v1 = 1 - (fromMC[2] / imgHeight)
                      v2 = 1 - (toMC[2] / imgHeight)
                      break
                    case 'down':
                      u1 = fromMC[0] / imgWidth
                      u2 = toMC[0] / imgWidth
                      v1 = 1 - (toMC[2] / imgHeight)
                      v2 = 1 - (fromMC[2] / imgHeight)
                      break
                    case 'south':
                    case 'north':
                      u1 = fromMC[0] / 16
                      u2 = toMC[0] / 16
                      v1 = fromMC[1] / 16
                      v2 = toMC[1] / 16
                      break
                  }
                }
                
                const startIdx = faceIndex * 4
                
                let uvCoords = [
                  { u: u1, v: v2 },
                  { u: u2, v: v2 },
                  { u: u1, v: v1 },
                  { u: u2, v: v1 }
                ]
                
                if (face.rotation) {
                  const rotations = face.rotation / 90
                  for (let r = 0; r < rotations; r++) {
                    uvCoords = [
                      uvCoords[2],
                      uvCoords[0],
                      uvCoords[3],
                      uvCoords[1]
                    ]
                  }
                }
                
                uvAttribute.setXY(startIdx + 0, uvCoords[0].u, uvCoords[0].v)
                uvAttribute.setXY(startIdx + 1, uvCoords[1].u, uvCoords[1].v)
                uvAttribute.setXY(startIdx + 2, uvCoords[2].u, uvCoords[2].v)
                uvAttribute.setXY(startIdx + 3, uvCoords[3].u, uvCoords[3].v)
                
                uvAttribute.needsUpdate = true
                
                faceMaterials.push(new THREE.MeshStandardMaterial({
                  map: faceTexture,
                  transparent: true,
                  opacity: obj.opacity,
                  depthWrite: false,
                  side: THREE.FrontSide,
                  alphaTest: 0.1
                }))
              } else {
                faceMaterials.push(new THREE.MeshStandardMaterial({
                  visible: false,
                  transparent: true,
                  opacity: 0,
                  depthWrite: false
                }))
              }
            } else {
              faceMaterials.push(new THREE.MeshStandardMaterial({
                visible: false,
                transparent: true,
                opacity: 0,
                depthWrite: false
              }))
            }
          }
          
          const elementMesh = new THREE.Mesh(boxGeometry, faceMaterials)
          elementMesh.userData.sceneObjectId = obj.id
          
          // Apply rotation if specified
          if (element.rotation) {
            const rot = element.rotation
            if (rot.origin) {
              const originX = rot.origin[0] / 16 - 0.5
              const originY = rot.origin[1] / 16 - 0.5
              const originZ = rot.origin[2] / 16 - 0.5
              
              elementMesh.position.set(
                centerX - originX,
                centerY - originY,
                centerZ - originZ
              )
            }
            
            const angle = (rot.angle || 0) * (Math.PI / 180)
            switch (rot.axis) {
              case 'x':
                elementMesh.rotation.x = angle
                break
              case 'y':
                elementMesh.rotation.y = angle
                break
              case 'z':
                elementMesh.rotation.z = angle
                break
            }
          }
          
          group.add(elementMesh)
        }
      }
      
      // Apply pivot offset to the entire group
      group.position.set(
        -obj.pivotOffset.x,
        -obj.pivotOffset.y,
        -obj.pivotOffset.z
      )
      
      // Set transform
      const container = new THREE.Object3D()
      container.add(group)
      
      // Apply user transforms to container
      container.position.set(obj.position.x, obj.position.y, obj.position.z)
      container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
      
      // Store reference to scene object for picking
      container.userData.sceneObjectId = obj.id
      container.userData.pivotOffset = { ...obj.pivotOffset }
      container.userData.isGroup = true
      
      return container
    }
    
    // Default: treat as generated model with layer0 texture
    if (itemModel.textures && itemModel.textures.layer0) {
      const textureData = await window.api.loadTexture(itemModel.textures.layer0)
      const texture = await loadTextureFromData(textureData)
      
      if (texture) {
        return createGeneratedItemMesh(texture, obj)
      }
    }
    
    console.warn('Unsupported item model format:', itemModel)
    return null
    
  } catch (error) {
    console.error('Error creating item mesh:', error)
    return null
  }
}
