<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue'
import Menubar from './components/Menubar.vue'
import Viewport from './components/Viewport.vue'
import SceneTree from './components/SceneTree.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import Timeline from './components/Timeline.vue'

// Shared state for scene objects
const sceneObjects = ref([])
const selectedObject = ref(null)
const currentFrame = ref(0)
let cubeCounter = 0

// Project settings
const projectSettings = ref({
  backgroundColor: '#9393FF',
  backgroundImage: null,
  backgroundStretchToFit: true
})

// Provide scene state to child components
provide('sceneObjects', sceneObjects)
provide('selectedObject', selectedObject)
provide('currentFrame', currentFrame)
provide('projectSettings', projectSettings)
provide('selectObject', (obj) => {
  selectedObject.value = obj
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

// Function to spawn a cube
const spawnCube = () => {
  cubeCounter++
  const newCube = {
    id: `cube_${cubeCounter}`,
    name: `Cube ${cubeCounter}`,
    type: 'cube',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    pivotOffset: { x: 0, y: -0.5, z: 0 },
    parent: null,
    expanded: false,
    setParent(parent) {
      setParent(this, parent)
    }
  }
  sceneObjects.value.push(newCube)
}

// Keyboard event handler
const handleKeyPress = (event) => {
  if (event.key === 'F7') {
    event.preventDefault()
    spawnCube()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyPress)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress)
})
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-[#1a1a1a]">
    <Menubar />
    <div class="flex flex-1 overflow-hidden gap-1 p-1">
      <div class="flex flex-col flex-1 gap-1 min-w-0">
        <div class="flex-1 min-h-0">
          <Viewport />
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
