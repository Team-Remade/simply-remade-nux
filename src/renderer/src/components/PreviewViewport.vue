<script setup>
import { ref, inject, watch, onMounted, onUnmounted, computed } from 'vue'
import * as THREE from 'three'
import { createBlockMesh } from '../utils/blockMeshCreator'
import { createItemMesh } from '../utils/itemMeshCreator'

const canvasContainer = ref(null)
let scene, camera, renderer, animationId, handleResize, resizeObserver
let backgroundPlane = null

// Inject scene state
const sceneObjects = inject('sceneObjects')
const projectSettings = inject('projectSettings')
const isPreviewPoppedOut = inject('isPreviewPoppedOut', ref(false))
const togglePreviewPopout = inject('togglePreviewPopout', null)

// Check if we're in a standalone preview window (no togglePreviewPopout means we're in PreviewWindow.vue)
const isStandalone = !togglePreviewPopout

// Map to track Three.js meshes for each scene object
const meshMap = new Map()

// Selected camera for preview
const selectedCameraId = ref(null)

// Get all camera objects from the scene recursively
const getAllCameras = (objects) => {
  const cameras = []
  const traverse = (objs) => {
    objs.forEach(obj => {
      if (obj.type === 'perspective-camera' || obj.type === 'orthographic-camera') {
        cameras.push(obj)
      }
      if (obj.children && obj.children.length > 0) {
        traverse(obj.children)
      }
    })
  }
  traverse(objects)
  return cameras
}

// Computed property to get all available cameras
const availableCameras = computed(() => {
  return getAllCameras(sceneObjects.value)
})

// Get the currently selected camera object
const selectedCamera = computed(() => {
  if (!selectedCameraId.value) return null
  return availableCameras.value.find(cam => cam.id === selectedCameraId.value)
})

// Automatically select the first camera when cameras become available
watch(availableCameras, (cameras) => {
  if (cameras.length > 0 && !selectedCameraId.value) {
    selectedCameraId.value = cameras[0].id
  }
  // If selected camera was deleted, switch to first available
  if (selectedCameraId.value && !cameras.find(cam => cam.id === selectedCameraId.value)) {
    selectedCameraId.value = cameras.length > 0 ? cameras[0].id : null
  }
}, { immediate: true })

// Pop-out window handler
const handlePopOut = async () => {
  if (!isPreviewPoppedOut.value) {
    // Pop out - create new window
    if (window.api && window.api.createPreviewWindow) {
      try {
        const result = await window.api.createPreviewWindow()
        if (result.success) {
          console.log('Preview window created successfully')
          if (togglePreviewPopout) {
            togglePreviewPopout(true)
          }
        } else {
          console.error('Failed to create preview window:', result.error)
        }
      } catch (error) {
        console.error('Error creating preview window:', error)
      }
    }
  } else {
    // Pop back in - just hide the preview in main window
    if (togglePreviewPopout) {
      togglePreviewPopout(false)
    }
    // Send message to close the popout window
    if (window.broadcastChannel) {
      window.broadcastChannel.postMessage({ type: 'close-popout' })
    }
  }
}

// Pop-in handler for standalone window
const handlePopIn = () => {
  // Just close the standalone window
  window.close()
}

onMounted(() => {
  if (canvasContainer.value) {
    // Create scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(projectSettings.value.backgroundColor)

    // Create default camera (will be replaced by preview camera)
    camera = new THREE.PerspectiveCamera(
      75,
      canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
      0.1,
      Number.MAX_SAFE_INTEGER
    )
    camera.position.set(0, 0, 5)
    camera.rotation.order = 'YXZ'

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
    canvasContainer.value.appendChild(renderer.domElement)

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(5, 10, 7)
    scene.add(directionalLight)

    // Add grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0xff0000, 0x333333)
    scene.add(gridHelper)

    // Watch for background color changes
    watch(() => projectSettings.value.backgroundColor, (newColor) => {
      if (scene) {
        scene.background = new THREE.Color(newColor)
      }
    })

    // Helper function to create/update background plane
    const updateBackgroundPlane = () => {
      if (!scene || !camera) return
      
      // Remove existing background plane if any
      if (backgroundPlane) {
        camera.remove(backgroundPlane)
        backgroundPlane.geometry.dispose()
        backgroundPlane.material.map?.dispose()
        backgroundPlane.material.dispose()
        backgroundPlane = null
      }
      
      const newImage = projectSettings.value.backgroundImage
      const stretchToFit = projectSettings.value.backgroundStretchToFit
      
      if (newImage) {
        // Load texture from data URL
        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(newImage, (texture) => {
          const distance = Number.MAX_SAFE_INTEGER - 900
          const vFov = camera.fov * Math.PI / 180
          
          let width, height
          let offsetX = 0, offsetY = 0
          
          if (stretchToFit) {
            // Stretch to fill viewport
            height = 2 * Math.tan(vFov / 2) * distance
            width = height * camera.aspect
          } else {
            // Use original image resolution (1:1 pixel mapping)
            const viewportHeight = 2 * Math.tan(vFov / 2) * distance
            const viewportWidth = viewportHeight * camera.aspect
            
            const canvasHeight = canvasContainer.value.clientHeight
            const pixelToWorldRatio = viewportHeight / canvasHeight
            
            height = texture.image.height * pixelToWorldRatio
            width = texture.image.width * pixelToWorldRatio
            
            offsetX = -(viewportWidth / 2) + (width / 2)
            offsetY = (viewportHeight / 2) - (height / 2)
          }
          
          const geometry = new THREE.PlaneGeometry(width, height)
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
          })
          
          backgroundPlane = new THREE.Mesh(geometry, material)
          backgroundPlane.position.set(offsetX, offsetY, -distance)
          backgroundPlane.renderOrder = -1000
          
          camera.add(backgroundPlane)
          
          if (!camera.parent) {
            scene.add(camera)
          }
        })
      } else {
        if (camera.parent) {
          scene.remove(camera)
        }
      }
    }
    
    // Watch for background image changes
    watch(() => projectSettings.value.backgroundImage, () => {
      updateBackgroundPlane()
    })
    
    // Watch for stretch to fit changes
    watch(() => projectSettings.value.backgroundStretchToFit, () => {
      updateBackgroundPlane()
    })

    // Recursive function to collect all objects including children
    const collectAllObjects = (objects) => {
      const allObjects = []
      const traverse = (objs) => {
        objs.forEach(obj => {
          allObjects.push(obj)
          if (obj.children && obj.children.length > 0) {
            traverse(obj.children)
          }
        })
      }
      traverse(objects)
      return allObjects
    }

    // Watch for changes in sceneObjects
    watch(sceneObjects, (newObjects) => {
      // Collect all objects including nested children
      const allObjects = collectAllObjects(newObjects)
      
      // Add any new objects that don't have a mesh yet
      allObjects.forEach(obj => {
        if (!meshMap.has(obj.id)) {
          // Skip camera objects - we don't want to render them in the preview
          if (obj.type === 'perspective-camera' || obj.type === 'orthographic-camera') {
            return
          }
          
          if (obj.type === 'block' && obj.blockPath) {
            createBlockMesh(obj, window).then(mesh => {
              if (mesh && !meshMap.has(obj.id)) {
                if (obj.parent) {
                  const parentMesh = meshMap.get(obj.parent)
                  if (parentMesh) {
                    parentMesh.add(mesh)
                  } else {
                    scene.add(mesh)
                  }
                } else {
                  scene.add(mesh)
                }
                meshMap.set(obj.id, mesh)
              }
            })
          } else if (obj.type === 'item' && obj.itemPath) {
            createItemMesh(obj, window).then(mesh => {
              if (mesh && !meshMap.has(obj.id)) {
                if (obj.parent) {
                  const parentMesh = meshMap.get(obj.parent)
                  if (parentMesh) {
                    parentMesh.add(mesh)
                  } else {
                    scene.add(mesh)
                  }
                } else {
                  scene.add(mesh)
                }
                meshMap.set(obj.id, mesh)
              }
            })
          } else if (obj.type === 'cube') {
            const geometry = new THREE.BoxGeometry(1, 1, 1)
            
            if (obj.opacity === undefined) {
              obj.opacity = 1
            }
            
            if (obj.pivotOffset === undefined) {
              obj.pivotOffset = { x: 0, y: -0.5, z: 0 }
            }
            
            const material = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: obj.opacity
            })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.userData.sceneObjectId = obj.id
            
            // Create nested container structure for pivot offset
            // Inner container holds the visual mesh with offset
            const pivotContainer = new THREE.Object3D()
            pivotContainer.position.set(
              -obj.pivotOffset.x,
              -obj.pivotOffset.y,
              -obj.pivotOffset.z
            )
            pivotContainer.add(mesh)
            
            // Outer container applies user transforms
            const container = new THREE.Object3D()
            container.add(pivotContainer)
            container.position.set(obj.position.x, obj.position.y, obj.position.z)
            container.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
            container.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
            
            // Store references
            container.userData.sceneObjectId = obj.id
            container.userData.pivotOffset = { ...obj.pivotOffset }
            container.userData.pivotContainer = pivotContainer
            
            if (obj.parent) {
              const parentMesh = meshMap.get(obj.parent)
              if (parentMesh) {
                parentMesh.add(container)
              } else {
                scene.add(container)
              }
            } else {
              scene.add(container)
            }
            
            meshMap.set(obj.id, container)
          }
        }
      })
      
      // Update parent-child relationships
      allObjects.forEach(obj => {
        const mesh = meshMap.get(obj.id)
        if (mesh) {
          if (obj.parent) {
            const parentMesh = meshMap.get(obj.parent)
            if (parentMesh && mesh.parent !== parentMesh) {
              if (mesh.parent) {
                mesh.parent.remove(mesh)
              }
              parentMesh.add(mesh)
            }
          } else if (mesh.parent !== scene) {
            if (mesh.parent) {
              mesh.parent.remove(mesh)
            }
            scene.add(mesh)
          }
        }
      })
      
      // Remove meshes for deleted objects
      const currentIds = new Set(allObjects.map(obj => obj.id))
      for (const [id, mesh] of meshMap.entries()) {
        if (!currentIds.has(id)) {
          if (mesh.parent) {
            mesh.parent.remove(mesh)
          }
          if (mesh.geometry) mesh.geometry.dispose()
          if (mesh.material) mesh.material.dispose()
          meshMap.delete(id)
        }
      }
    }, { deep: true })

    // Animation loop
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Update camera from selected scene camera object
      if (selectedCamera.value) {
        const camObj = selectedCamera.value
        
        // Update camera type if changed
        if (camObj.type === 'perspective-camera' && !(camera instanceof THREE.PerspectiveCamera)) {
          camera = new THREE.PerspectiveCamera(
            camObj.fov || 75,
            canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
            0.1,
            Number.MAX_SAFE_INTEGER
          )
        } else if (camObj.type === 'orthographic-camera' && !(camera instanceof THREE.OrthographicCamera)) {
          const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
          const frustumSize = camObj.orthoSize || 5
          camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            Number.MAX_SAFE_INTEGER
          )
        }
        
        // Update camera properties
        if (camera instanceof THREE.PerspectiveCamera && camObj.fov) {
          camera.fov = camObj.fov
          camera.updateProjectionMatrix()
        } else if (camera instanceof THREE.OrthographicCamera && camObj.orthoSize) {
          const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
          const frustumSize = camObj.orthoSize
          camera.left = frustumSize * aspect / -2
          camera.right = frustumSize * aspect / 2
          camera.top = frustumSize / 2
          camera.bottom = frustumSize / -2
          camera.updateProjectionMatrix()
        }
        
        // Update camera transform with pivot offset applied
        const pivotOffset = camObj.pivotOffset || { x: 0, y: 0, z: 0 }
        camera.position.set(
          camObj.position.x - pivotOffset.x,
          camObj.position.y - pivotOffset.y,
          camObj.position.z - pivotOffset.z
        )
        camera.rotation.set(camObj.rotation.x, camObj.rotation.y, camObj.rotation.z)
        camera.rotation.order = 'YXZ'
      } else {
        // Default fallback camera position
        camera.position.set(0, 0, 5)
        camera.lookAt(0, 0, 0)
      }

      // Update mesh transforms from scene objects
      const updateMeshTransforms = (objects, parentOpacity = 1, parentPivotOffset = { x: 0, y: -0.5, z: 0 }) => {
        objects.forEach(obj => {
          // Skip camera objects
          if (obj.type === 'perspective-camera' || obj.type === 'orthographic-camera') {
            if (obj.children && obj.children.length > 0) {
              updateMeshTransforms(obj.children, parentOpacity, parentPivotOffset)
            }
            return
          }
          
          const mesh = meshMap.get(obj.id)
          if (mesh) {
            mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
            mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
            mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
            
            const objectOpacity = obj.opacity !== undefined ? obj.opacity : 1
            const finalOpacity = objectOpacity * parentOpacity
            
            if (mesh.userData.isGroup) {
              mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                      mat.opacity = finalOpacity
                      mat.transparent = true
                      mat.needsUpdate = true
                    })
                  } else {
                    child.material.opacity = finalOpacity
                    child.material.transparent = true
                    child.material.needsUpdate = true
                  }
                }
              })
            } else if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => {
                  mat.opacity = finalOpacity
                  mat.transparent = true
                })
              } else {
                mesh.material.opacity = finalOpacity
                mesh.material.transparent = true
              }
            }
            
            // Update pivot offset dynamically using the pivot container
            const effectivePivotOffset = obj.parent ? parentPivotOffset : (obj.pivotOffset || { x: 0, y: -0.5, z: 0 })
            const currentPivot = mesh.userData.pivotOffset || { x: 0, y: -0.5, z: 0 }
            
            // Update pivot container position if pivot offset changed
            if (effectivePivotOffset.x !== currentPivot.x ||
                effectivePivotOffset.y !== currentPivot.y ||
                effectivePivotOffset.z !== currentPivot.z) {
              // Update the pivot container's position
              if (mesh.userData.pivotContainer) {
                mesh.userData.pivotContainer.position.set(
                  -effectivePivotOffset.x,
                  -effectivePivotOffset.y,
                  -effectivePivotOffset.z
                )
              }
              mesh.userData.pivotOffset = { ...effectivePivotOffset }
            }
            
            const pivotForChildren = obj.pivotOffset || effectivePivotOffset
            
            if (obj.children && obj.children.length > 0) {
              updateMeshTransforms(obj.children, finalOpacity, pivotForChildren)
            }
          } else {
            if (obj.children && obj.children.length > 0) {
              updateMeshTransforms(obj.children, parentOpacity, parentPivotOffset)
            }
          }
        })
      }
      
      updateMeshTransforms(sceneObjects.value)

      renderer.render(scene, camera)
    }
    animate()

    // Handle window and container resize
    handleResize = () => {
      if (canvasContainer.value && renderer && camera) {
        const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
        
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = aspect
          camera.updateProjectionMatrix()
        } else if (camera instanceof THREE.OrthographicCamera && selectedCamera.value) {
          const frustumSize = selectedCamera.value.orthoSize || 5
          camera.left = frustumSize * aspect / -2
          camera.right = frustumSize * aspect / 2
          camera.top = frustumSize / 2
          camera.bottom = frustumSize / -2
          camera.updateProjectionMatrix()
        }
        
        renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
      }
    }
    window.addEventListener('resize', handleResize)
    
    // Add ResizeObserver to watch for container size changes (e.g., when user resizes the viewport)
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(canvasContainer.value)
  }
})

onUnmounted(() => {
  // Clean up
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (renderer) {
    renderer.dispose()
  }
  if (handleResize) {
    window.removeEventListener('resize', handleResize)
  }
  if (resizeObserver && canvasContainer.value) {
    resizeObserver.unobserve(canvasContainer.value)
    resizeObserver.disconnect()
  }
  
  // Clean up meshes
  for (const mesh of meshMap.values()) {
    if (mesh.geometry) mesh.geometry.dispose()
    if (mesh.material) mesh.material.dispose()
  }
  meshMap.clear()
})
</script>

<template>
  <div class="flex flex-col bg-[#1a1a1a] border border-[#2c2c2c] h-full">
    <div class="bg-[#2c2c2c] text-[#aaa] px-2 py-1 text-xs border-b border-[#1a1a1a] flex items-center justify-between cursor-move select-none">
      <span>Camera Preview</span>
      <div class="flex items-center gap-2">
        <button
          v-if="!isStandalone"
          @click.stop="handlePopOut"
          class="bg-[#1a1a1a] text-[#aaa] px-2 py-0.5 text-xs rounded border border-[#3c3c3c] hover:border-[#3c8edb] hover:text-[#3c8edb] focus:outline-none transition-colors"
          :title="isPreviewPoppedOut ? 'Pop back in' : 'Pop out into new window'"
        >
          {{ isPreviewPoppedOut ? '⤓' : '⤢' }}
        </button>
        <button
          v-else
          @click.stop="handlePopIn"
          class="bg-[#1a1a1a] text-[#aaa] px-2 py-0.5 text-xs rounded border border-[#3c3c3c] hover:border-[#3c8edb] hover:text-[#3c8edb] focus:outline-none transition-colors"
          title="Pop back into main window"
        >
          ⤓
        </button>
        <label class="text-xs">Camera:</label>
        <select
          v-model="selectedCameraId"
          class="bg-[#1a1a1a] text-[#aaa] px-2 py-0.5 text-xs rounded border border-[#3c3c3c] hover:border-[#4c4c4c] focus:outline-none focus:border-[#3c8edb]"
          :disabled="availableCameras.length === 0"
          @mousedown.stop
          @click.stop
        >
          <option v-if="availableCameras.length === 0" :value="null">No cameras available</option>
          <option
            v-for="cam in availableCameras"
            :key="cam.id"
            :value="cam.id"
          >
            {{ cam.name }}
          </option>
        </select>
      </div>
    </div>
    <div ref="canvasContainer" class="w-full h-full relative">
      <div 
        v-if="availableCameras.length === 0"
        class="absolute inset-0 flex items-center justify-center text-[#666] text-sm"
      >
        Add a camera to the scene to see preview
      </div>
    </div>
  </div>
</template>
