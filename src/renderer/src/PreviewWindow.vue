<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue'
import PreviewTitlebar from './components/PreviewTitlebar.vue'
import PreviewViewport from './components/PreviewViewport.vue'

// Shared state - will be synchronized from main window
const sceneObjects = ref([])
const projectSettings = ref({
  backgroundColor: '#9393FF',
  backgroundImage: null,
  backgroundStretchToFit: true
})

// Provide scene state to child components
provide('sceneObjects', sceneObjects)
provide('projectSettings', projectSettings)

// BroadcastChannel for cross-window communication
let channel = null

onMounted(() => {
  // Set title for the window
  document.title = 'Camera Preview'
  
  // Setup BroadcastChannel for receiving scene updates
  channel = new BroadcastChannel('preview-sync')
  
  channel.onmessage = (event) => {
    const { type, data } = event.data
    
    if (type === 'close-popout') {
      // Main window requested close
      window.close()
      return
    }
    
    try {
      // Deserialize the JSON data
      const parsedData = JSON.parse(data)
      
      if (type === 'scene-update') {
        sceneObjects.value = parsedData.sceneObjects
      } else if (type === 'settings-update') {
        projectSettings.value = parsedData.projectSettings
      } else if (type === 'full-state') {
        sceneObjects.value = parsedData.sceneObjects
        projectSettings.value = parsedData.projectSettings
      }
    } catch (error) {
      console.error('Error parsing broadcast message:', error)
    }
  }
  
  // Request initial state from main window
  channel.postMessage({ type: 'request-state' })
  
  // Listen for window close event and notify main window
  window.addEventListener('beforeunload', () => {
    if (channel) {
      channel.postMessage({ type: 'popout-closed' })
    }
  })
})

onUnmounted(() => {
  if (channel) {
    channel.close()
  }
})
</script>

<template>
  <div class="flex flex-col w-screen h-screen overflow-hidden bg-[#1a1a1a]">
    <PreviewTitlebar />
    <div class="flex-1">
      <PreviewViewport />
    </div>
  </div>
</template>
