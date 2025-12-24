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

// Provide scene state to child components
provide('sceneObjects', sceneObjects)
provide('selectedObject', selectedObject)
provide('currentFrame', currentFrame)
provide('selectObject', (obj) => {
  selectedObject.value = obj
})

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
    expanded: false
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
        <div class="h-[250px] shrink-0">
          <Timeline />
        </div>
      </div>
      <div class="flex flex-col w-[300px] gap-1 shrink-0">
        <div class="flex-1 min-h-0">
          <SceneTree />
        </div>
        <div class="flex-1 min-h-0">
          <PropertiesPanel />
        </div>
      </div>
    </div>
  </div>
</template>
