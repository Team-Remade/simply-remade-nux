import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Helper function to create character mesh from GLB file
export const createCharacterMesh = async (obj, window) => {
  try {
    // Initialize opacity if not set
    if (obj.opacity === undefined) {
      obj.opacity = 1
    }
    
    // Initialize pivot offset if not set
    if (obj.pivotOffset === undefined) {
      obj.pivotOffset = { x: 0, y: 0, z: 0 }
    }
    
    console.log('Loading character GLB from:', obj.characterPath)
    
    // Load the GLB file via IPC to avoid CSP issues
    const glbData = await window.api.loadCharacterGLB(obj.characterPath)
    
    if (glbData.error) {
      console.error('Failed to load character GLB:', glbData.error)
      throw new Error(glbData.error)
    }
    
    // Convert base64 to ArrayBuffer
    const binaryString = atob(glbData.data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const arrayBuffer = bytes.buffer
    
    // Load the character GLB model from ArrayBuffer
    const loader = new GLTFLoader()
    
    return new Promise((resolve, reject) => {
      loader.parse(
        arrayBuffer,
        '', // Resource path (empty for embedded resources)
        (gltf) => {
          const model = gltf.scene
          const animations = gltf.animations || []
          
          console.log('Character model loaded successfully')
          console.log('Animations found:', animations.length)
          
          // Store bones as a map for easy access
          const bonesMap = new Map()
          
          // Traverse the model to find bones
          model.traverse((child) => {
            if (child.isBone) {
              console.log('Found bone:', child.name)
              bonesMap.set(child.name, child)
              
              // Mark bone with userData for identification
              child.userData.isBone = true
              child.userData.boneName = child.name
              child.userData.sceneObjectId = obj.id
            }
            
            // Update materials for visibility
            if (child.isMesh) {
              child.userData.sceneObjectId = obj.id
              
              // Ensure materials support transparency
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material = child.material.map(mat => {
                    const newMat = mat.clone()
                    newMat.transparent = true
                    newMat.opacity = obj.opacity
                    return newMat
                  })
                } else {
                  const newMat = child.material.clone()
                  newMat.transparent = true
                  newMat.opacity = obj.opacity
                  child.material = newMat
                }
              }
            }
          })
          
          console.log('Total bones found:', bonesMap.size)
          
          // First pass: Create all bone scene objects
          const boneObjects = []
          const boneIdMap = new Map() // Map bone names to their scene object IDs
          const boneObjMap = new Map() // Map bone IDs to bone objects for second pass
          
          bonesMap.forEach((bone, boneName) => {
            const boneId = `${obj.id}_bone_${boneName}`
            const boneObject = {
              id: boneId,
              name: boneName,
              type: 'bone',
              position: { x: bone.position.x, y: bone.position.y, z: bone.position.z },
              rotation: { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z },
              scale: { x: bone.scale.x, y: bone.scale.y, z: bone.scale.z },
              pivotOffset: { x: 0, y: 0, z: 0 },
              parent: obj.id, // Temporary - will be fixed in second pass
              expanded: false,
              boneName: boneName, // Store the bone name for mapping
              characterId: obj.id, // Reference back to character
              children: [], // Initialize children array for hierarchy
              _threeBone: bone // Temporary reference for determining parent
            }
            
            boneIdMap.set(boneName, boneId)
            boneObjMap.set(boneId, boneObject)
            boneObjects.push(boneObject)
          })
          
          // Second pass: Fix parent relationships
          boneObjects.forEach(boneObject => {
            const threeBone = boneObject._threeBone
            if (threeBone.parent && threeBone.parent.isBone) {
              // This bone's parent is another bone
              const parentBoneName = threeBone.parent.name
              if (boneIdMap.has(parentBoneName)) {
                boneObject.parent = boneIdMap.get(parentBoneName)
                console.log(`Bone ${boneObject.name} parented to bone ${parentBoneName}`)
              }
            }
            // Clean up temporary reference
            delete boneObject._threeBone
          })
          
          console.log('Created bone objects with hierarchy:', boneObjects.length)
          
          // Create a container group for the model
          const group = new THREE.Group()
          group.add(model)
          
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
          container.userData.isCharacter = true
          container.userData.characterModel = model
          container.userData.bonesMap = bonesMap
          container.userData.animations = animations
          container.userData.boneObjects = boneObjects // Store the bone objects
          
          // Resolve with both the container and the bone objects
          resolve({ mesh: container, bones: boneObjects })
        },
        // Progress callback
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100
          console.log(`Loading character: ${percent.toFixed(2)}%`)
        },
        // Error callback
        (error) => {
          console.error('Error loading character GLB model:', error)
          reject(error)
        }
      )
    })
  } catch (error) {
    console.error('Error creating character mesh:', error)
    return null
  }
}

// Helper function to update bone transforms from scene objects
export const updateBoneTransforms = (characterMesh, boneObjects) => {
  if (!characterMesh || !characterMesh.userData.bonesMap) return
  
  const bonesMap = characterMesh.userData.bonesMap
  
  boneObjects.forEach(boneObj => {
    const bone = bonesMap.get(boneObj.boneName)
    if (bone) {
      // Update bone transform from scene object
      bone.position.set(boneObj.position.x, boneObj.position.y, boneObj.position.z)
      bone.rotation.set(boneObj.rotation.x, boneObj.rotation.y, boneObj.rotation.z)
      bone.scale.set(boneObj.scale.x, boneObj.scale.y, boneObj.scale.z)
    }
  })
}

// Helper function to create a simple bone visualization (helper box/sphere)
export const createBoneHelper = (boneName) => {
  // Create a small sphere to represent the bone visually
  const geometry = new THREE.SphereGeometry(0.05, 8, 8)
  const material = new THREE.MeshBasicMaterial({
    color: 0xff9900,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
    depthWrite: false
  })
  const helper = new THREE.Mesh(geometry, material)
  helper.userData.isBoneHelper = true
  helper.userData.boneName = boneName
  return helper
}
