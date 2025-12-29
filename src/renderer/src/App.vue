<script setup>
import { ref, provide, onMounted, onUnmounted, watch } from 'vue'
import Menubar from './components/Menubar.vue'
import Viewport from './components/Viewport.vue'
import PreviewViewport from './components/PreviewViewport.vue'
import SceneTree from './components/SceneTree.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import Timeline from './components/Timeline.vue'

// Shared state for scene objects
const sceneObjects = ref([])
const selectedObject = ref(null)
const currentFrame = ref(0)

// BroadcastChannel for synchronizing with preview windows
let broadcastChannel = null

// Track if preview is popped out
const isPreviewPoppedOut = ref(false)

// Track if preview viewport is visible
const isPreviewVisible = ref(true)

// Preview viewport dragging and resizing state
const previewViewportRef = ref(null)
const viewportContainerRef = ref(null)
const isDragging = ref(false)
const isResizing = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const previewPosition = ref('bottom-right') // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
const previewSize = ref({ width: 320, height: 240 })
const resizeCorner = ref(null) // 'nw', 'ne', 'sw', 'se'
const resizeStartPos = ref({ x: 0, y: 0 })
const resizeStartSize = ref({ width: 0, height: 0 })

// Project settings
const projectSettings = ref({
  backgroundColor: '#9393FF',
  backgroundImage: null,
  backgroundStretchToFit: true,
  floorTexture: 'block/grass_block_top' // Default to grass block top texture
})

// Provide scene state to child components
provide('sceneObjects', sceneObjects)
provide('selectedObject', selectedObject)
provide('currentFrame', currentFrame)
provide('projectSettings', projectSettings)
provide('isPreviewPoppedOut', isPreviewPoppedOut)
provide('isPreviewVisible', isPreviewVisible)
provide('selectObject', (obj) => {
  selectedObject.value = obj
})
provide('togglePreviewPopout', (shouldPopout) => {
  isPreviewPoppedOut.value = shouldPopout
})
provide('togglePreviewVisibility', () => {
  isPreviewVisible.value = !isPreviewVisible.value
})

// Function to set parent for a scene object
const setParent = (child, parent) => {
  if (!child) return
  
  // Remove child from its current parent's children array if it has a parent
  if (child.parent) {
    const oldParent = sceneObjects.value.find(obj => obj.id === child.parent)
    if (oldParent && oldParent.children) {
      const index = oldParent.children.findIndex(c => c.id === child.id)
      if (index !== -1) {
        oldParent.children.splice(index, 1)
        if (oldParent.children.length === 0) {
          delete oldParent.children
        }
      }
    }
    // Remove from root level if it was there
    const rootIndex = sceneObjects.value.findIndex(obj => obj.id === child.id)
    if (rootIndex === -1) {
      // Child was in a parent, remove parent reference
      child.parent = null
    }
  }
  
  // Set new parent
  if (parent) {
    // Remove child from root level if it's there
    const rootIndex = sceneObjects.value.findIndex(obj => obj.id === child.id)
    if (rootIndex !== -1) {
      sceneObjects.value.splice(rootIndex, 1)
    }
    
    // Initialize parent's children array if needed
    if (!parent.children) {
      parent.children = []
    }
    
    // Add child to new parent's children array
    if (!parent.children.find(c => c.id === child.id)) {
      parent.children.push(child)
    }
    
    child.parent = parent.id
    parent.expanded = true // Auto-expand parent to show child
  } else {
    // Setting parent to null - move to root level
    child.parent = null
    if (!sceneObjects.value.find(obj => obj.id === child.id)) {
      sceneObjects.value.push(child)
    }
  }
}

// Provide setParent function to child components
provide('setParent', setParent)

// Function to delete an object from the scene
const deleteObject = (obj) => {
  if (!obj) return
  
  // If object has a parent, remove it from parent's children
  if (obj.parent) {
    const parent = sceneObjects.value.find(o => o.id === obj.parent)
    if (parent && parent.children) {
      const index = parent.children.findIndex(c => c.id === obj.id)
      if (index !== -1) {
        parent.children.splice(index, 1)
        if (parent.children.length === 0) {
          delete parent.children
        }
      }
    }
  } else {
    // Remove from root level
    const index = sceneObjects.value.findIndex(o => o.id === obj.id)
    if (index !== -1) {
      sceneObjects.value.splice(index, 1)
    }
  }
  
  // If deleted object was selected, deselect it
  if (selectedObject.value === obj) {
    selectedObject.value = null
  }
}

// Provide deleteObject function to child components
provide('deleteObject', deleteObject)

// Function to duplicate an object
const duplicateObject = (obj) => {
  if (!obj) return
  
  // Create a deep copy of the object
  const duplicate = JSON.parse(JSON.stringify(obj))
  
  // Generate a new unique ID
  duplicate.id = Date.now() + Math.random()
  
  // Find all objects with similar names and get the highest number
  const getAllObjects = (objects) => {
    let allObjs = []
    objects.forEach(o => {
      allObjs.push(o)
      if (o.children) {
        allObjs = allObjs.concat(getAllObjects(o.children))
      }
    })
    return allObjs
  }
  
  const allObjects = getAllObjects(sceneObjects.value)
  
  // Extract base name and find the highest number
  let baseName = obj.name
  let highestNum = 0
  
  // Check if the name already ends with a number (e.g., "Object 1")
  const match = obj.name.match(/^(.*?)(\d+)$/)
  if (match) {
    baseName = match[1].trim()
    highestNum = parseInt(match[2])
  }
  
  // Find all objects with the same base name and get highest number
  allObjects.forEach(o => {
    if (o.name.startsWith(baseName)) {
      const numMatch = o.name.match(/^.*?(\d+)$/)
      if (numMatch) {
        const num = parseInt(numMatch[1])
        if (num > highestNum) {
          highestNum = num
        }
      }
    }
  })
  
  // Set the new name with incremented number
  duplicate.name = `${baseName}${highestNum + 1}`
  
  // Reset parent reference initially
  const parentId = duplicate.parent
  duplicate.parent = null
  
  // If the object has children, update their parent references
  if (duplicate.children) {
    const updateChildrenParent = (children, newParentId) => {
      children.forEach(child => {
        child.id = Date.now() + Math.random()
        child.parent = newParentId
        if (child.children) {
          updateChildrenParent(child.children, child.id)
        }
      })
    }
    updateChildrenParent(duplicate.children, duplicate.id)
  }
  
  // Add the duplicate to the scene at the same level as the original
  if (parentId) {
    // Find the parent and add duplicate to its children
    const parent = sceneObjects.value.find(o => o.id === parentId)
    if (parent) {
      if (!parent.children) {
        parent.children = []
      }
      parent.children.push(duplicate)
      duplicate.parent = parentId
    }
  } else {
    // Add to root level
    sceneObjects.value.push(duplicate)
  }
  
  // Select the duplicated object
  selectedObject.value = duplicate
}

// Provide duplicateObject function to child components
provide('duplicateObject', duplicateObject)

// Preview viewport dragging handlers
const handlePreviewMouseDown = (event) => {
  // Only drag from the header (not resize handles)
  if (event.target.closest('.preview-header') && !event.target.closest('.resize-handle')) {
    isDragging.value = true
    const rect = previewViewportRef.value.getBoundingClientRect()
    dragOffset.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
    event.preventDefault()
  }
}

// Preview viewport resizing handlers
const handleResizeMouseDown = (event, corner) => {
  isResizing.value = true
  resizeCorner.value = corner
  resizeStartPos.value = { x: event.clientX, y: event.clientY }
  resizeStartSize.value = { ...previewSize.value }
  event.stopPropagation()
  event.preventDefault()
}

const handleMouseMove = (event) => {
  if (isResizing.value) {
    const deltaX = event.clientX - resizeStartPos.value.x
    const deltaY = event.clientY - resizeStartPos.value.y
    
    let newWidth = resizeStartSize.value.width
    let newHeight = resizeStartSize.value.height
    
    // Calculate new size based on which corner is being dragged
    if (resizeCorner.value === 'se') {
      // Bottom-right corner
      newWidth = resizeStartSize.value.width + deltaX
      newHeight = resizeStartSize.value.height + deltaY
    } else if (resizeCorner.value === 'sw') {
      // Bottom-left corner
      newWidth = resizeStartSize.value.width - deltaX
      newHeight = resizeStartSize.value.height + deltaY
    } else if (resizeCorner.value === 'ne') {
      // Top-right corner
      newWidth = resizeStartSize.value.width + deltaX
      newHeight = resizeStartSize.value.height - deltaY
    } else if (resizeCorner.value === 'nw') {
      // Top-left corner
      newWidth = resizeStartSize.value.width - deltaX
      newHeight = resizeStartSize.value.height - deltaY
    }
    
    // Apply minimum and maximum constraints
    newWidth = Math.max(200, Math.min(800, newWidth))
    newHeight = Math.max(150, Math.min(600, newHeight))
    
    previewSize.value = { width: newWidth, height: newHeight }
  } else if (isDragging.value && previewViewportRef.value && viewportContainerRef.value) {
    const containerRect = viewportContainerRef.value.getBoundingClientRect()
    const previewRect = previewViewportRef.value.getBoundingClientRect()
    
    // Calculate new position relative to container
    let newX = event.clientX - containerRect.left - dragOffset.value.x
    let newY = event.clientY - containerRect.top - dragOffset.value.y
    
    // Clamp within bounds
    newX = Math.max(0, Math.min(newX, containerRect.width - previewRect.width))
    newY = Math.max(0, Math.min(newY, containerRect.height - previewRect.height))
    
    // Apply position
    previewViewportRef.value.style.left = `${newX}px`
    previewViewportRef.value.style.top = `${newY}px`
    previewViewportRef.value.style.bottom = 'auto'
    previewViewportRef.value.style.right = 'auto'
  }
}

const handleMouseUp = () => {
  if (isResizing.value) {
    isResizing.value = false
    resizeCorner.value = null
    return
  }
  
  if (!isDragging.value || !previewViewportRef.value || !viewportContainerRef.value) return
  
  isDragging.value = false
  
  // Snap to nearest corner
  const containerRect = viewportContainerRef.value.getBoundingClientRect()
  const previewRect = previewViewportRef.value.getBoundingClientRect()
  
  const centerX = previewRect.left + previewRect.width / 2 - containerRect.left
  const centerY = previewRect.top + previewRect.height / 2 - containerRect.top
  
  const isLeft = centerX < containerRect.width / 2
  const isTop = centerY < containerRect.height / 2
  
  // Reset inline styles
  previewViewportRef.value.style.left = ''
  previewViewportRef.value.style.top = ''
  previewViewportRef.value.style.bottom = ''
  previewViewportRef.value.style.right = ''
  
  // Set position class
  if (isTop && isLeft) {
    previewPosition.value = 'top-left'
  } else if (isTop && !isLeft) {
    previewPosition.value = 'top-right'
  } else if (!isTop && isLeft) {
    previewPosition.value = 'bottom-left'
  } else {
    previewPosition.value = 'bottom-right'
  }
}

onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  
  // Setup BroadcastChannel for syncing with preview windows
  broadcastChannel = new BroadcastChannel('preview-sync')
  
  // Make broadcastChannel globally accessible
  window.broadcastChannel = broadcastChannel
  
  // Listen for state requests from preview windows
  broadcastChannel.onmessage = (event) => {
    if (event.data.type === 'request-state') {
      // Send full state to requesting preview window (serialize to avoid cloning issues)
      broadcastChannel.postMessage({
        type: 'full-state',
        data: JSON.stringify({
          sceneObjects: sceneObjects.value,
          projectSettings: projectSettings.value
        })
      })
    } else if (event.data.type === 'popout-closed') {
      // Preview window was closed, show the inline preview again
      isPreviewPoppedOut.value = false
    }
  }
  
  // Watch for scene changes and broadcast to preview windows
  watch(sceneObjects, (newValue) => {
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'scene-update',
        data: JSON.stringify({
          sceneObjects: newValue
        })
      })
    }
  }, { deep: true })
  
  // Watch for settings changes and broadcast to preview windows
  watch(projectSettings, (newValue) => {
    if (broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'settings-update',
        data: JSON.stringify({
          projectSettings: newValue
        })
      })
    }
  }, { deep: true })
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  
  if (broadcastChannel) {
    broadcastChannel.close()
  }
})

</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-[#1a1a1a]">
    <Menubar />
    <div class="flex flex-1 overflow-hidden gap-1 p-1">
      <div class="flex flex-col flex-1 gap-1 min-w-0">
        <div ref="viewportContainerRef" class="flex-1 min-h-0 relative">
          <Viewport />
          <!-- Preview Viewport as draggable and resizable overlay -->
          <div
            v-if="!isPreviewPoppedOut && isPreviewVisible"
            ref="previewViewportRef"
            @mousedown="handlePreviewMouseDown"
            class="absolute shadow-lg transition-all"
            :class="{
              'top-4 left-4': previewPosition === 'top-left',
              'top-4 right-4': previewPosition === 'top-right',
              'bottom-4 left-4': previewPosition === 'bottom-left',
              'bottom-4 right-4': previewPosition === 'bottom-right',
              'cursor-move': !isDragging && !isResizing,
              'cursor-grabbing': isDragging,
              'transition-none': isDragging || isResizing
            }"
            :style="{
              width: `${previewSize.width}px`,
              height: `${previewSize.height}px`,
              userSelect: (isDragging || isResizing) ? 'none' : 'auto'
            }"
          >
            <div class="h-full preview-header">
              <PreviewViewport />
            </div>
            
            <!-- Resize handles -->
            <div
              class="resize-handle absolute w-3 h-3 bg-[#3c8edb] rounded-full opacity-0 hover:opacity-100 transition-opacity"
              :class="{ 'opacity-100': isResizing && resizeCorner === 'nw' }"
              style="top: -6px; left: -6px; cursor: nwse-resize;"
              @mousedown.stop="handleResizeMouseDown($event, 'nw')"
            ></div>
            <div
              class="resize-handle absolute w-3 h-3 bg-[#3c8edb] rounded-full opacity-0 hover:opacity-100 transition-opacity"
              :class="{ 'opacity-100': isResizing && resizeCorner === 'ne' }"
              style="top: -6px; right: -6px; cursor: nesw-resize;"
              @mousedown.stop="handleResizeMouseDown($event, 'ne')"
            ></div>
            <div
              class="resize-handle absolute w-3 h-3 bg-[#3c8edb] rounded-full opacity-0 hover:opacity-100 transition-opacity"
              :class="{ 'opacity-100': isResizing && resizeCorner === 'sw' }"
              style="bottom: -6px; left: -6px; cursor: nesw-resize;"
              @mousedown.stop="handleResizeMouseDown($event, 'sw')"
            ></div>
            <div
              class="resize-handle absolute w-3 h-3 bg-[#3c8edb] rounded-full opacity-0 hover:opacity-100 transition-opacity"
              :class="{ 'opacity-100': isResizing && resizeCorner === 'se' }"
              style="bottom: -6px; right: -6px; cursor: nwse-resize;"
              @mousedown.stop="handleResizeMouseDown($event, 'se')"
            ></div>
          </div>
        </div>
        <div class="h-[180px] shrink-0">
          <Timeline />
        </div>
      </div>
      <div class="flex flex-col w-[240px] gap-1 shrink-0">
        <div class="h-[30%] min-h-0">
          <SceneTree />
        </div>
        <div class="h-[70%] min-h-0">
          <PropertiesPanel />
        </div>
      </div>
    </div>
  </div>
</template>
