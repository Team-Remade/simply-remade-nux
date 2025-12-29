import * as THREE from 'three'

// Helper function to create a canvas texture from Bootstrap icon
const createIconTexture = () => {
  // Create a canvas to render the icon
  const canvas = document.createElement('canvas')
  const size = 128
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  
  // Clear canvas
  ctx.clearRect(0, 0, size, size)
  
  // Draw a circle icon (simulating bi-circle)
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
  ctx.fill()
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  
  return texture
}

// Helper function to create point light mesh
export const createLightMesh = async (obj) => {
  try {
    // Initialize opacity if not set
    if (obj.opacity === undefined) {
      obj.opacity = 1
    }
    
    // Initialize pivot offset if not set (centered for lights)
    if (obj.pivotOffset === undefined) {
      obj.pivotOffset = { x: 0, y: 0, z: 0 }
    }
    
    // Initialize light properties if not set
    if (obj.lightColor === undefined) {
      obj.lightColor = '#ffffff'
    }
    if (obj.lightIntensity === undefined) {
      obj.lightIntensity = 10 // Higher default for better range
    }
    if (obj.lightDistance === undefined) {
      obj.lightDistance = 0 // 0 means infinite
    }
    
    // Create the actual Three.js light
    const light = new THREE.PointLight(
      new THREE.Color(obj.lightColor),
      obj.lightIntensity,
      obj.lightDistance
    )
    light.castShadow = false // Don't cast shadows
    
    // Create a plane geometry for the billboard
    const planeSize = 0.5
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize)
    
    // Create texture from icon
    const texture = createIconTexture('bi-circle')
    
    // Create unshaded material with no lighting (MeshBasicMaterial)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: obj.opacity,
      side: THREE.DoubleSide,
      depthTest: false, // Always render on top
      depthWrite: false
    })
    
    // Create the billboard mesh
    const billboard = new THREE.Mesh(geometry, material)
    billboard.userData.sceneObjectId = obj.id
    billboard.userData.isBillboard = true
    
    // Create a group to hold both the light and billboard
    const group = new THREE.Group()
    group.add(light)
    group.add(billboard)
    
    // Store references on the group
    group.userData.sceneObjectId = obj.id
    group.userData.isLight = true
    group.userData.light = light
    group.userData.billboard = billboard
    
    // Create nested container structure for pivot offset
    // Inner container holds the visual mesh with offset
    const pivotContainer = new THREE.Object3D()
    pivotContainer.position.set(
      -obj.pivotOffset.x,
      -obj.pivotOffset.y,
      -obj.pivotOffset.z
    )
    pivotContainer.add(group)
    
    // Outer container applies user transforms
    const container = new THREE.Object3D()
    container.add(pivotContainer)
    
    // Apply user transforms to container
    container.position.set(obj.position.x, obj.position.y, obj.position.z)
    container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
    container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
    
    // Store references
    container.userData.sceneObjectId = obj.id
    container.userData.pivotOffset = { ...obj.pivotOffset }
    container.userData.pivotContainer = pivotContainer
    container.userData.isGroup = true
    container.userData.isLight = true
    container.userData.light = light
    container.userData.billboard = billboard
    
    return container
  } catch (error) {
    console.error('Error creating light mesh:', error)
    return null
  }
}

// Function to update billboard to face camera
export const updateBillboardRotation = (lightContainer, camera) => {
  if (!lightContainer || !camera) return
  
  const billboard = lightContainer.userData.billboard
  if (!billboard) return
  
  // Make billboard face the camera
  billboard.quaternion.copy(camera.quaternion)
}
