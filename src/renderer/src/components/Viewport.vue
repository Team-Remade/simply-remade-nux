<script setup>
import { ref, inject, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useKeyframes } from '../composables/useKeyframes'

const canvasContainer = ref(null)
let scene, camera, renderer, animationId, handleResize
let handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu, handleKeyDown, handleKeyUp, handleClick
let raycaster, mouse, transformControls

// Inject scene state
const sceneObjects = inject('sceneObjects')
const selectedObject = inject('selectedObject')
const selectObject = inject('selectObject')

// Use keyframe composable
const { addKeyframeAtCurrentFrame } = useKeyframes()

// Track previous transform values to detect changes
const previousTransform = ref({})

// Map to track Three.js meshes for each scene object
const meshMap = new Map()
// Store outline for selected object
let selectionOutline = null

// Transform mode state ('translate', 'rotate', 'scale')
const transformMode = ref('translate')
// Transform space state ('world', 'local')
const transformSpace = ref('world')

// Free fly controls state
const controls = {
  isRightMouseDown: false,
  lastMouseX: 0,
  lastMouseY: 0,
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  moveUp: false,
  moveDown: false,
  yaw: 0, // Rotation around Y axis
  pitch: 0, // Rotation around X axis
  moveSpeed: 0.1,
  lookSpeed: 0.002,
  isTransformDragging: false,
  wasTransformDragging: false // Track if we were dragging to prevent click selection
}

onMounted(() => {
  if (canvasContainer.value) {
    // Create scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    // Create camera
    camera = new THREE.PerspectiveCamera(
      75,
      canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
      0.1,
      1000
    )
    camera.position.set(5, 5, 5)
    camera.rotation.order = 'YXZ'
    camera.lookAt(0, 0, 0)
    
    // Initialize yaw and pitch from camera's rotation after lookAt
    controls.yaw = camera.rotation.y
    controls.pitch = camera.rotation.x

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
    canvasContainer.value.appendChild(renderer.domElement)

    // Initialize raycaster and mouse for object picking
    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2()

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    // Add grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0xff0000, 0x333333)
    scene.add(gridHelper)

    // Add axes helper
    //const axesHelper = new THREE.AxesHelper(5)
    //scene.add(axesHelper)

    // Initialize transform controls
    transformControls = new TransformControls(camera, renderer.domElement)
    transformControls.setMode(transformMode.value)
    transformControls.setSpace('world')
    transformControls.setSize(1.5) // Make gizmo larger and more visible
    scene.add(transformControls.getHelper()) // Add the visual helper to the scene

    // Handle transform control events
    transformControls.addEventListener('dragging-changed', (event) => {
      controls.isTransformDragging = event.value
      // Track if we were dragging to prevent click selection
      if (event.value) {
        controls.wasTransformDragging = true
        controls.isRightMouseDown = false
        // Store initial transform state when starting drag
        if (selectedObject.value) {
          previousTransform.value = {
            position: { ...selectedObject.value.position },
            rotation: { ...selectedObject.value.rotation },
            scale: { ...selectedObject.value.scale }
          }
        }
      } else {
        // When drag ends, check what changed and create keyframes
        if (selectedObject.value && previousTransform.value) {
          const mode = transformMode.value
          const obj = selectedObject.value
          const prev = previousTransform.value
          
          if (mode === 'translate') {
            // Check which axes changed
            if (obj.position.x !== prev.position.x) {
              addKeyframeAtCurrentFrame(obj, 'position', 'x')
            }
            if (obj.position.y !== prev.position.y) {
              addKeyframeAtCurrentFrame(obj, 'position', 'y')
            }
            if (obj.position.z !== prev.position.z) {
              addKeyframeAtCurrentFrame(obj, 'position', 'z')
            }
          } else if (mode === 'rotate') {
            // Check which axes changed
            if (obj.rotation.x !== prev.rotation.x) {
              addKeyframeAtCurrentFrame(obj, 'rotation', 'x')
            }
            if (obj.rotation.y !== prev.rotation.y) {
              addKeyframeAtCurrentFrame(obj, 'rotation', 'y')
            }
            if (obj.rotation.z !== prev.rotation.z) {
              addKeyframeAtCurrentFrame(obj, 'rotation', 'z')
            }
          } else if (mode === 'scale') {
            // Check which axes changed
            if (obj.scale.x !== prev.scale.x) {
              addKeyframeAtCurrentFrame(obj, 'scale', 'x')
            }
            if (obj.scale.y !== prev.scale.y) {
              addKeyframeAtCurrentFrame(obj, 'scale', 'y')
            }
            if (obj.scale.z !== prev.scale.z) {
              addKeyframeAtCurrentFrame(obj, 'scale', 'z')
            }
          }
          
          previousTransform.value = {}
        }
      }
    })

    // Update scene object when transform control changes
    transformControls.addEventListener('objectChange', () => {
      if (selectedObject.value && transformControls.object) {
        const mesh = transformControls.object
        selectedObject.value.position.x = mesh.position.x
        selectedObject.value.position.y = mesh.position.y
        selectedObject.value.position.z = mesh.position.z
        selectedObject.value.rotation.x = mesh.rotation.x
        selectedObject.value.rotation.y = mesh.rotation.y
        selectedObject.value.rotation.z = mesh.rotation.z
        selectedObject.value.scale.x = mesh.scale.x
        selectedObject.value.scale.y = mesh.scale.y
        selectedObject.value.scale.z = mesh.scale.z
      }
    })

    // Watch for selection changes to add edge outline
    watch(selectedObject, (newSelected) => {
      // Remove previous outline
      if (selectionOutline) {
        scene.remove(selectionOutline)
        selectionOutline.geometry.dispose()
        selectionOutline.material.dispose()
        selectionOutline = null
      }
      
      // Detach transform controls
      transformControls.detach()
      
      // Add outline to new selection
      if (newSelected) {
        const mesh = meshMap.get(newSelected.id)
        if (mesh) {
          // Create edges geometry from the mesh
          const edges = new THREE.EdgesGeometry(mesh.geometry, 15) // 15 degree threshold
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffaa00, // Orange outline color
            linewidth: 2 // Note: linewidth > 1 may not work on all platforms
          })
          selectionOutline = new THREE.LineSegments(edges, lineMaterial)
          
          // Match the mesh's transform
          selectionOutline.position.copy(mesh.position)
          selectionOutline.rotation.copy(mesh.rotation)
          selectionOutline.scale.copy(mesh.scale)
          
          scene.add(selectionOutline)
          
          // Attach transform controls to selected mesh
          transformControls.attach(mesh)
          console.log('Transform controls attached to mesh', mesh)
        }
      }
    })

    // Watch for transform mode changes
    watch(transformMode, (newMode) => {
      if (transformControls) {
        transformControls.setMode(newMode)
      }
    })

    // Watch for transform space changes
    watch(transformSpace, (newSpace) => {
      if (transformControls) {
        transformControls.setSpace(newSpace)
      }
    })

    // Watch for changes in sceneObjects
    watch(sceneObjects, (newObjects) => {
      // Add any new objects that don't have a mesh yet
      newObjects.forEach(obj => {
        if (!meshMap.has(obj.id)) {
          if (obj.type === 'cube') {
            const geometry = new THREE.BoxGeometry(1, 1, 1)
            const material = new THREE.MeshStandardMaterial({ color: 0x3c8edb })
            const mesh = new THREE.Mesh(geometry, material)
            
            mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
            mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
            mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
            
            // Store reference to scene object for picking
            mesh.userData.sceneObjectId = obj.id
            
            scene.add(mesh)
            meshMap.set(obj.id, mesh)
          }
        }
      })
      
      // Remove meshes for deleted objects
      const currentIds = new Set(newObjects.map(obj => obj.id))
      for (const [id, mesh] of meshMap.entries()) {
        if (!currentIds.has(id)) {
          scene.remove(mesh)
          mesh.geometry.dispose()
          mesh.material.dispose()
          meshMap.delete(id)
        }
      }
    }, { deep: true })

    // Mouse event handlers
    handleMouseDown = (event) => {
      if (event.button === 2) { // Right mouse button
        // Don't enable camera controls if dragging transform gizmo
        if (!controls.isTransformDragging) {
          controls.isRightMouseDown = true
          
          // Request pointer lock for grabbed mouse behavior
          canvasContainer.value.requestPointerLock()
        }
      }
    }

    handleClick = (event) => {
      // Only handle left click
      if (event.button !== 0) return
      
      // Don't handle click if we're interacting with transform controls
      if (controls.isTransformDragging) return
      
      // Don't handle click if we just finished dragging the gizmo
      if (controls.wasTransformDragging) {
        controls.wasTransformDragging = false
        return
      }

      // Calculate mouse position in normalized device coordinates (-1 to +1)
      const rect = canvasContainer.value.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // Update raycaster with camera and mouse position
      raycaster.setFromCamera(mouse, camera)

      // Get all meshes in the scene (excluding helpers)
      const pickableMeshes = Array.from(meshMap.values())

      // Calculate intersections
      const intersects = raycaster.intersectObjects(pickableMeshes, false)

      if (intersects.length > 0) {
        // Find the scene object that corresponds to the clicked mesh
        const clickedMesh = intersects[0].object
        const sceneObjectId = clickedMesh.userData.sceneObjectId

        if (sceneObjectId) {
          const obj = sceneObjects.value.find(o => o.id === sceneObjectId)
          if (obj) {
            selectObject(obj)
            console.log('Object selected, gizmo should be visible')
          }
        }
      } else {
        // Deselect if clicking on empty space
        selectObject(null)
        console.log('Deselected')
      }
    }

    handleMouseMove = (event) => {
      if (controls.isRightMouseDown && document.pointerLockElement === canvasContainer.value) {
        // Use movementX/Y for pointer lock (relative movement)
        const deltaX = event.movementX
        const deltaY = event.movementY

        controls.yaw -= deltaX * controls.lookSpeed
        controls.pitch -= deltaY * controls.lookSpeed

        // Clamp pitch to prevent camera flipping
        controls.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, controls.pitch))
      }
    }

    handleMouseUp = (event) => {
      if (event.button === 2) {
        controls.isRightMouseDown = false
        
        // Exit pointer lock
        if (document.pointerLockElement === canvasContainer.value) {
          document.exitPointerLock()
        }
      }
    }

    handleContextMenu = (event) => {
      event.preventDefault() // Prevent context menu from appearing
    }

    // Keyboard event handlers
    handleKeyDown = (event) => {
      // Don't handle camera keys if dragging transform
      if (controls.isTransformDragging) return
      
      const key = event.key.toLowerCase()
      
      // Camera movement keys - when right mouse button is held, these take priority
      if (controls.isRightMouseDown) {
        switch (key) {
          case 'w':
            controls.moveForward = true
            break
          case 's':
            controls.moveBackward = true
            break
          case 'a':
            controls.moveLeft = true
            break
          case 'd':
            controls.moveRight = true
            break
          case 'q':
            controls.moveDown = true
            break
          case 'e':
            controls.moveUp = true
            break
        }
        return // Don't process transform shortcuts when navigating
      }
      
      // Transform shortcuts - work when an object is selected
      if (selectedObject.value) {
        // Transform mode shortcuts
        if (key === 't') {
          transformMode.value = 'translate'
          return
        }
        if (key === 'r') {
          transformMode.value = 'rotate'
          return
        }
        if (key === 's') {
          transformMode.value = 'scale'
          return
        }
        // Transform space toggle
        if (key === 'g') {
          transformSpace.value = transformSpace.value === 'world' ? 'local' : 'world'
          console.log('Transform space:', transformSpace.value)
          return
        }
      }
    }

    handleKeyUp = (event) => {
      switch (event.key.toLowerCase()) {
        case 'w':
          controls.moveForward = false
          break
        case 's':
          controls.moveBackward = false
          break
        case 'a':
          controls.moveLeft = false
          break
        case 'd':
          controls.moveRight = false
          break
        case 'q':
          controls.moveDown = false
          break
        case 'e':
          controls.moveUp = false
          break
      }
    }

    // Add event listeners
    canvasContainer.value.addEventListener('mousedown', handleMouseDown)
    canvasContainer.value.addEventListener('mousemove', handleMouseMove)
    canvasContainer.value.addEventListener('mouseup', handleMouseUp)
    canvasContainer.value.addEventListener('click', handleClick)
    canvasContainer.value.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Animation loop
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Update camera rotation based on mouse movement
      camera.rotation.order = 'YXZ'
      camera.rotation.y = controls.yaw
      camera.rotation.x = controls.pitch

      // Calculate movement direction based on camera rotation
      const forward = new THREE.Vector3()
      const right = new THREE.Vector3()
      
      camera.getWorldDirection(forward)
      right.crossVectors(camera.up, forward).normalize()

      // Update camera position based on keyboard input
      if (controls.moveForward) {
        camera.position.addScaledVector(forward, controls.moveSpeed)
      }
      if (controls.moveBackward) {
        camera.position.addScaledVector(forward, -controls.moveSpeed)
      }
      if (controls.moveLeft) {
        camera.position.addScaledVector(right, controls.moveSpeed)
      }
      if (controls.moveRight) {
        camera.position.addScaledVector(right, -controls.moveSpeed)
      }
      if (controls.moveUp) {
        camera.position.y += controls.moveSpeed
      }
      if (controls.moveDown) {
        camera.position.y -= controls.moveSpeed
      }

      // Update mesh transforms from scene objects
      sceneObjects.value.forEach(obj => {
        const mesh = meshMap.get(obj.id)
        if (mesh) {
          mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
          mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z)
          mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
          
          // Update outline if this is the selected object
          if (selectedObject.value && selectedObject.value.id === obj.id && selectionOutline) {
            selectionOutline.position.copy(mesh.position)
            selectionOutline.rotation.copy(mesh.rotation)
            selectionOutline.scale.copy(mesh.scale)
          }
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    // Handle window resize
    handleResize = () => {
      if (canvasContainer.value) {
        camera.aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
      }
    }
    window.addEventListener('resize', handleResize)
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
  
  // Remove event listeners
  if (canvasContainer.value) {
    canvasContainer.value.removeEventListener('mousedown', handleMouseDown)
    canvasContainer.value.removeEventListener('mousemove', handleMouseMove)
    canvasContainer.value.removeEventListener('mouseup', handleMouseUp)
    canvasContainer.value.removeEventListener('click', handleClick)
    canvasContainer.value.removeEventListener('contextmenu', handleContextMenu)
  }
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})
</script>

<template>
  <div class="flex flex-col bg-[#1a1a1a] border border-[#2c2c2c] h-full">
    <div class="bg-[#2c2c2c] text-[#aaa] px-3 py-1 text-xs border-b border-[#1a1a1a] flex items-center justify-between">
      <span>3D Viewport</span>
      <div v-if="selectedObject" class="flex gap-2">
        <div class="flex gap-1">
          <button
            @click="transformMode = 'translate'"
            :class="['px-2 py-0.5 text-xs rounded', transformMode === 'translate' ? 'bg-[#3c8edb] text-white' : 'bg-[#1a1a1a] hover:bg-[#333]']"
            title="Translate (T)"
          >
            Move
          </button>
          <button
            @click="transformMode = 'rotate'"
            :class="['px-2 py-0.5 text-xs rounded', transformMode === 'rotate' ? 'bg-[#3c8edb] text-white' : 'bg-[#1a1a1a] hover:bg-[#333]']"
            title="Rotate (R)"
          >
            Rotate
          </button>
          <button
            @click="transformMode = 'scale'"
            :class="['px-2 py-0.5 text-xs rounded', transformMode === 'scale' ? 'bg-[#3c8edb] text-white' : 'bg-[#1a1a1a] hover:bg-[#333]']"
            title="Scale (S)"
          >
            Scale
          </button>
        </div>
        <div class="border-l border-[#1a1a1a]"></div>
        <button
          @click="transformSpace = transformSpace === 'world' ? 'local' : 'world'"
          :class="['px-2 py-0.5 text-xs rounded', 'bg-[#1a1a1a] hover:bg-[#333]']"
          title="Toggle World/Local Space (G)"
        >
          {{ transformSpace === 'world' ? 'World' : 'Local' }}
        </button>
      </div>
    </div>
    <div ref="canvasContainer" class="w-full h-full"></div>
  </div>
</template>
