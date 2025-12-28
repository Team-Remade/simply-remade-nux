import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import cameraModelUrl from '../assets/mesh/Camera.glb?url'

// Helper function to create camera mesh from GLB
export const createCameraMesh = async (obj) => {
  try {
    // Initialize opacity if not set
    if (obj.opacity === undefined) {
      obj.opacity = 1
    }
    
    // Initialize pivot offset if not set
    if (obj.pivotOffset === undefined) {
      obj.pivotOffset = { x: 0, y: 0, z: 0 }
    }
    
    // Load the Camera.glb model
    const loader = new GLTFLoader()
    
    return new Promise((resolve, reject) => {
      loader.load(
        cameraModelUrl,
        (gltf) => {
          const model = gltf.scene
          
          // Create a bounding box for selection (invisible hitbox)
          // Use a larger box than the visual model for easier selection
          const hitboxGeometry = new THREE.BoxGeometry(1, 1, 1)
          const hitboxMaterial = new THREE.MeshBasicMaterial({
            visible: false, // Invisible but still selectable
            opacity: 0,
            transparent: true
          })
          const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial)
          hitbox.userData.sceneObjectId = obj.id
          
          // Create a container group for the model and hitbox
          const group = new THREE.Group()
          
          // Apply the camera model visual with unshaded material
          model.traverse((child) => {
            if (child.isMesh) {
              child.userData.sceneObjectId = obj.id
              
              // Replace material with unshaded MeshBasicMaterial
              if (child.material) {
                // Get the original color if available
                const originalColor = child.material.color ? child.material.color.clone() : new THREE.Color(0xcccccc)
                
                // Create new unshaded material with no depth testing
                child.material = new THREE.MeshBasicMaterial({
                  color: originalColor,
                  transparent: true,
                  opacity: obj.opacity,
                  depthTest: false, // Always render on top
                  depthWrite: false
                })
              }
            }
          })
          
          // Add model and hitbox to group
          group.add(model)
          group.add(hitbox)
          
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
          container.rotation.order = 'YXZ' // Match viewport camera rotation order
          container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
          container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
          
          // Store references
          container.userData.sceneObjectId = obj.id
          container.userData.pivotOffset = { ...obj.pivotOffset }
          container.userData.pivotContainer = pivotContainer
          container.userData.isGroup = true
          container.userData.isCamera = true
          container.userData.cameraModel = model
          container.userData.hitbox = hitbox
          
          resolve(container)
        },
        // Progress callback
        undefined,
        // Error callback
        (error) => {
          console.error('Error loading camera GLB model:', error)
          reject(error)
        }
      )
    })
  } catch (error) {
    console.error('Error creating camera mesh:', error)
    return null
  }
}
