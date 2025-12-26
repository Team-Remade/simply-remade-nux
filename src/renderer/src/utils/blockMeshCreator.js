import * as THREE from 'three'

// Helper function to load a texture
export const loadTextureFromData = async (textureData) => {
  if (textureData.error) {
    console.error('Error loading texture:', textureData.error)
    return null
  }
  
  const image = new Image()
  image.src = 'data:image/ png;base64,' + textureData.data
  
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
  })
  
  const texture = new THREE.Texture(image)
  texture.needsUpdate = true
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  
  return texture
}

// Helper function to create block mesh from Minecraft JSON model
export const createBlockMesh = async (obj, window) => {
  try {
    // Load the block model JSON
    const blockModel = await window.api.loadBlockModel(obj.blockPath)
    
    if (blockModel.error) {
      console.error('Error loading block model:', blockModel.error)
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
    
    // Check if model has custom elements (complex Minecraft JSON model)
    if (blockModel.elements && Array.isArray(blockModel.elements)) {
      // Load textures referenced in the model
      const textureCache = {}
      if (blockModel.textures) {
        for (const [key, value] of Object.entries(blockModel.textures)) {
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
        while (current && current.startsWith('#') && blockModel.textures) {
          if (visited.has(current)) break // Prevent infinite loops
          visited.add(current)
          
          const key = current.substring(1)
          const value = blockModel.textures[key]
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
      
      for (const element of blockModel.elements) {
        // Convert Minecraft coordinates (0-16 scale) to Three.js units (0-1 scale)
        const from = element.from.map(v => v / 16)
        const to = element.to.map(v => v / 16)
        
        const width = to[0] - from[0]
        const height = to[1] - from[1]
        const depth = to[2] - from[2]
        
        // Create box geometry
        const boxGeometry = new THREE.BoxGeometry(width, height, depth)
        
        // Position the box at the center of its bounds
        // Minecraft coordinates start from bottom-left-back, so offset to center around origin
        const centerX = (from[0] + to[0]) / 2 - 0.5 // Center at 0
        const centerY = (from[1] + to[1]) / 2 - 0.5
        const centerZ = (from[2] + to[2]) / 2 - 0.5
        
        boxGeometry.translate(centerX, centerY, centerZ)
        
        // Create materials for each face if specified
        if (element.faces) {
          // Three.js face order: right(+X/east), left(-X/west), top(+Y/up), bottom(-Y/down), front(+Z/south), back(-Z/north)
          const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north']
          const faceMaterials = []
          
          for (const faceName of faceOrder) {
            const face = element.faces[faceName]
            if (face && face.texture) {
              const texture = resolveTexture(face.texture)
              if (texture) {
                // Clone texture for independent use
                const faceTexture = texture.clone()
                faceTexture.needsUpdate = true
                
                faceMaterials.push(new THREE.MeshStandardMaterial({
                  map: faceTexture,
                  transparent: true,
                  opacity: obj.opacity,
                  depthWrite: false,
                  side: THREE.FrontSide
                }))
              } else {
                // No texture resolved - make invisible
                faceMaterials.push(new THREE.MeshStandardMaterial({
                  visible: false,
                  transparent: true,
                  opacity: 0,
                  depthWrite: false
                }))
              }
            } else {
              // No face definition - make invisible
              faceMaterials.push(new THREE.MeshStandardMaterial({
                visible: false,
                transparent: true,
                opacity: 0,
                depthWrite: false
              }))
            }
          }
          
          // Create mesh for this element
          const elementMesh = new THREE.Mesh(boxGeometry, faceMaterials)
          group.add(elementMesh)
        } else {
          // No face definitions - create with default material
          const elementMesh = new THREE.Mesh(
            boxGeometry,
            new THREE.MeshStandardMaterial({
              color: 0xff00ff,
              transparent: true,
              opacity: obj.opacity
            })
          )
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
      container.position.set(obj.position.x, obj.position.y, obj.position.z)
      container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
      
      // Store reference to scene object for picking
      container.userData.sceneObjectId = obj.id
      container.userData.pivotOffset = { ...obj.pivotOffset }
      container.userData.isGroup = true
      
      return container
    }
    // Simplified cube models (cube_all, cube_column)
    else {
      // Create a cube geometry
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      
      // Apply pivot offset to geometry (inverted)
      geometry.translate(
        -obj.pivotOffset.x,
        -obj.pivotOffset.y,
        -obj.pivotOffset.z
      )
      
      let materials
      
      // Handle cube_all parent (full cube blocks - same texture on all sides)
      if (blockModel.parent === 'minecraft:block/cube_all' && blockModel.textures && blockModel.textures.all) {
        const textureData = await window.api.loadTexture(blockModel.textures.all)
        const texture = await loadTextureFromData(textureData)
        
        if (!texture) {
          return null
        }
        
        // Create material with texture
        materials = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          opacity: obj.opacity
        })
      }
      // Handle cube_column parent (different textures for top/bottom and sides)
      else if (blockModel.parent === 'minecraft:block/cube_column' && blockModel.textures) {
        const endTextureData = blockModel.textures.end ? await window.api.loadTexture(blockModel.textures.end) : null
        const sideTextureData = blockModel.textures.side ? await window.api.loadTexture(blockModel.textures.side) : null
        
        const endTexture = endTextureData ? await loadTextureFromData(endTextureData) : null
        const sideTexture = sideTextureData ? await loadTextureFromData(sideTextureData) : null
        
        if (!endTexture || !sideTexture) {
          return null
        }
        
        // Create array of materials for each face of the cube
        // Order: right, left, top, bottom, front, back
        materials = [
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // right
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // left
          new THREE.MeshStandardMaterial({ map: endTexture, transparent: true, opacity: obj.opacity }),  // top
          new THREE.MeshStandardMaterial({ map: endTexture, transparent: true, opacity: obj.opacity }),  // bottom
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // front
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity })  // back
        ]
      }
      else {
        // Fallback to a placeholder cube if we can't load the model
        console.warn('Unsupported block model format:', blockModel.parent)
        return null
      }
      
      const mesh = new THREE.Mesh(geometry, materials)
      
      mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
      mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
      
      // Store reference to scene object for picking
      mesh.userData.sceneObjectId = obj.id
      // Store initial pivot offset for change tracking
      mesh.userData.pivotOffset = { ...obj.pivotOffset }
      
      return mesh
    }
  } catch (error) {
    console.error('Error creating block mesh:', error)
    return null
  }
}
