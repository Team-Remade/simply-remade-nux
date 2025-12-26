import * as THREE from 'three'

// Helper function to apply orientation to a mesh
const applyOrientation = (target, orientation) => {
  console.log('applyOrientation called with:', orientation)
  console.log('Before rotation:', target.rotation.y * (180 / Math.PI), 'degrees')
  
  switch (orientation) {
    case 'north': // -Z direction (default in most block models)
      // No rotation needed, this is default
      target.rotation.y = 0
      break
    case 'south': // +Z direction
      target.rotation.y = Math.PI
      break
    case 'east': // +X direction
      target.rotation.y = Math.PI / 2
      break
    case 'west': // -X direction
      target.rotation.y = -Math.PI / 2
      break
    case 'up': // +Y direction
      target.rotation.x = -Math.PI / 2
      break
    case 'down': // -Y direction
      target.rotation.x = Math.PI / 2
      break
  }
  
  console.log('After rotation:', target.rotation.y * (180 / Math.PI), 'degrees')
}

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
    // Convert parent reference to path
    const parentPath = model.parent.replace('minecraft:', 'SimplyRemadeAssetsV1/assets/minecraft/models/') + '.json'
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

// Helper function to create block mesh from Minecraft JSON model
export const createBlockMesh = async (obj, window) => {
  try {
    // Debug: Log orientation
    if (obj.orientation) {
      console.log('Creating block with orientation:', obj.orientation, 'for block:', obj.name)
    }
    
    // Load the block model JSON with parents
    const blockModel = await loadModelWithParents(obj.blockPath, window)
    
    if (!blockModel || blockModel.error) {
      console.error('Error loading block model:', blockModel.error || 'Model not found')
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
          
          // Get UV attribute for custom mapping
          const uvAttribute = boxGeometry.attributes.uv
          
          for (let faceIndex = 0; faceIndex < faceOrder.length; faceIndex++) {
            const faceName = faceOrder[faceIndex]
            const face = element.faces[faceName]
            
            if (face && face.texture) {
              const texture = resolveTexture(face.texture)
              if (texture) {
                // Clone texture for independent use
                const faceTexture = texture.clone()
                faceTexture.needsUpdate = true
                // Use repeat wrapping to avoid edge bleeding
                faceTexture.wrapS = THREE.RepeatWrapping
                faceTexture.wrapT = THREE.RepeatWrapping
                
                // Apply UV mapping
                const imgWidth = texture.image.width
                const imgHeight = texture.image.height
                
                let u1, v1, u2, v2
                
                if (face.uv) {
                  // Use explicit UV coordinates from model
                  // Minecraft UV format: [x1, y1, x2, y2] in pixels
                  u1 = face.uv[0] / imgWidth
                  v1 = 1 - (face.uv[3] / imgHeight) // Bottom edge, flipped
                  u2 = face.uv[2] / imgWidth
                  v2 = 1 - (face.uv[1] / imgHeight) // Top edge, flipped
                } else {
                  // Auto-generate UV based on element dimensions
                  // Map the element's size to the full texture (0-16 in Minecraft = 0-1 in texture)
                  // Different calculation for each face based on which dimensions it uses
                  const fromMC = element.from // Original 0-16 scale
                  const toMC = element.to
                  
                  switch(faceName) {
                    case 'east': // +X face, uses Z (horizontal) and Y (vertical)
                    case 'west': // -X face, uses Z (horizontal) and Y (vertical)
                      u1 = fromMC[2] / 16
                      u2 = toMC[2] / 16
                      v1 = fromMC[1] / 16 // Bottom of element
                      v2 = toMC[1] / 16 // Top of element
                      break
                    case 'up': // +Y face, uses X and Z
                      u1 = fromMC[0] / imgWidth
                      u2 = toMC[0] / imgWidth
                      v1 = 1 - (fromMC[2] / imgHeight)
                      v2 = 1 - (toMC[2] / imgHeight)
                      break
                    case 'down': // -Y face, uses X and Z
                      u1 = fromMC[0] / imgWidth
                      u2 = toMC[0] / imgWidth
                      v1 = 1 - (toMC[2] / imgHeight)
                      v2 = 1 - (fromMC[2] / imgHeight)
                      break
                    case 'south': // +Z face, uses X (horizontal) and Y (vertical)
                    case 'north': // -Z face, uses X (horizontal) and Y (vertical)
                      u1 = fromMC[0] / 16
                      u2 = toMC[0] / 16
                      v1 = fromMC[1] / 16 // Bottom of element
                      v2 = toMC[1] / 16 // Top of element
                      break
                  }
                }
                
                // Each face of a box has 2 triangles = 4 vertices
                // Each face starts at index faceIndex * 4
                const startIdx = faceIndex * 4
                
                // Handle UV rotation if specified (0, 90, 180, 270)
                let uvCoords =  [
                  { u: u1, v: v2 }, // bottom-left
                  { u: u2, v: v2 }, // bottom-right
                  { u: u1, v: v1 }, // top-left
                  { u: u2, v: v1 }  // top-right
]
                
                if (face.rotation) {
                  // Rotate UV coordinates
                  // rotation is in degrees: 90 = clockwise 90°, 180 = 180°, 270 = clockwise 270° (=counter-clockwise 90°)
                  const rotations = face.rotation / 90 // Number of 90° rotations
                  for (let r = 0; r < rotations; r++) {
                    // Rotate clockwise by 90 degrees: shift indices
                    uvCoords = [
                      uvCoords[2], // top-left -> bottom-left
                      uvCoords[0], // bottom-left -> bottom-right
                      uvCoords[3], // top-right -> top-left
                      uvCoords[1]  // bottom-right -> top-right
                    ]
                  }
                }
                
                // Set UV coordinates for this face's 4 vertices
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
          // Add scene object ID to element mesh for picking
          elementMesh.userData.sceneObjectId = obj.id
          
          // Apply rotation if specified
          if (element.rotation) {
            const rot = element.rotation
            // Set rotation origin
            if (rot.origin) {
              // Origin is in Minecraft coordinates (0-16), convert to Three.js (-0.5 to 0.5)
              const originX = rot.origin[0] / 16 - 0.5
              const originY = rot.origin[1] / 16 - 0.5
              const originZ = rot.origin[2] / 16 - 0.5
              
              // Move mesh so rotation origin is at center
              elementMesh.position.set(
                centerX - originX,
                centerY - originY,
                centerZ - originZ
              )
            }
            
            // Apply rotation based on axis
            const angle = (rot.angle || 0) * (Math.PI / 180) // Convert to radians
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
      
      // Apply orientation to group before adding to container
      if (obj.orientation) {
        applyOrientation(group, obj.orientation)
      }
      
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
    // Simplified cube models (cube_all, cube_column, orientable)
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
      // Handle cube_bottom_top parent (grass, mycelium, etc. - different textures for top, bottom, and sides)
      else if (blockModel.parent === 'minecraft:block/cube_bottom_top' && blockModel.textures) {
        const topTextureData = blockModel.textures.top ? await window.api.loadTexture(blockModel.textures.top) : null
        const bottomTextureData = blockModel.textures.bottom ? await window.api.loadTexture(blockModel.textures.bottom) : null
        const sideTextureData = blockModel.textures.side ? await window.api.loadTexture(blockModel.textures.side) : null
        
        const topTexture = topTextureData ? await loadTextureFromData(topTextureData) : null
        const bottomTexture = bottomTextureData ? await loadTextureFromData(bottomTextureData) : null
        const sideTexture = sideTextureData ? await loadTextureFromData(sideTextureData) : null
        
        if (!topTexture || !bottomTexture || !sideTexture) {
          return null
        }
        
        // Create array of materials for each face of the cube
        // Order: right, left, top, bottom, front, back
        materials = [
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // right
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // left
          new THREE.MeshStandardMaterial({ map: topTexture, transparent: true, opacity: obj.opacity }),   // top
          new THREE.MeshStandardMaterial({ map: bottomTexture, transparent: true, opacity: obj.opacity }), // bottom
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // front
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity })  // back
        ]
      }
      // Handle cube_top parent (jukebox, etc. - top texture on top, side texture on all other faces)
      else if (blockModel.parent === 'minecraft:block/cube_top' && blockModel.textures) {
        const topTextureData = blockModel.textures.top ? await window.api.loadTexture(blockModel.textures.top) : null
        const sideTextureData = blockModel.textures.side ? await window.api.loadTexture(blockModel.textures.side) : null
        
        const topTexture = topTextureData ? await loadTextureFromData(topTextureData) : null
        const sideTexture = sideTextureData ? await loadTextureFromData(sideTextureData) : null
        
        if (!topTexture || !sideTexture) {
          return null
        }
        
        // Create array of materials for each face of the cube
        // Order: right, left, top, bottom, front, back
        materials = [
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // right
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // left
          new THREE.MeshStandardMaterial({ map: topTexture, transparent: true, opacity: obj.opacity }),  // top
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }),  // bottom
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // front
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity })  // back
        ]
      }
      // Handle orientable parent (furnace, dispenser, etc. - different textures for front, side, top)
      else if (blockModel.parent === 'minecraft:block/orientable' && blockModel.textures) {
        const topTextureData = blockModel.textures.top ? await window.api.loadTexture(blockModel.textures.top) : null
        const frontTextureData = blockModel.textures.front ? await window.api.loadTexture(blockModel.textures.front) : null
        const sideTextureData = blockModel.textures.side ? await window.api.loadTexture(blockModel.textures.side) : null
        
        const topTexture = topTextureData ? await loadTextureFromData(topTextureData) : null
        const frontTexture = frontTextureData ? await loadTextureFromData(frontTextureData) : null
        const sideTexture = sideTextureData ? await loadTextureFromData(sideTextureData) : null
        
        if (!topTexture || !frontTexture || !sideTexture) {
          return null
        }
        
        // Create array of materials for each face of the cube
        // Order: right(+X), left(-X), top(+Y), bottom(-Y), front(+Z), back(-Z)
        // For orientable: sides on X faces, front on +Z, back gets side texture, top/bottom use top texture
        materials = [
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // right (+X)
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity }), // left (-X)
          new THREE.MeshStandardMaterial({ map: topTexture, transparent: true, opacity: obj.opacity }),   // top (+Y)
          new THREE.MeshStandardMaterial({ map: topTexture, transparent: true, opacity: obj.opacity }),   // bottom (-Y)
          new THREE.MeshStandardMaterial({ map: frontTexture, transparent: true, opacity: obj.opacity }), // front (+Z)
          new THREE.MeshStandardMaterial({ map: sideTexture, transparent: true, opacity: obj.opacity })   // back (-Z)
        ]
      }
      else {
        // Fallback to a placeholder cube if we can't load the model
        console.warn('Unsupported block model format:', blockModel.parent)
        return null
      }
      
     // Create parent container for orientation
      const container = new THREE.Object3D()
      const mesh = new THREE.Mesh(geometry, materials)
      
      // Apply orientation to mesh
      if (obj.orientation) {
        applyOrientation(mesh, obj.orientation)
      }
      
      container.add(mesh)
      
      // Apply user transforms to container
      container.position.set(obj.position.x, obj.position.y, obj.position.z)
      container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
      
      // Store reference to scene object for picking
      container.userData.sceneObjectId = obj.id
      mesh.userData.sceneObjectId = obj.id
      // Store initial pivot offset for change tracking
      container.userData.pivotOffset = { ...obj.pivotOffset }
      
      return container
    }
  } catch (error) {
    console.error('Error creating block mesh:', error)
    return null
  }
}
