<script setup>
import { ref, onMounted } from 'vue'
import appIcon from '../../../../resources/appIcon01.png'

const isMaximized = ref(false)

onMounted(() => {
  // Listen for maximize/unmaximize events if available
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('window-maximized', () => {
      isMaximized.value = true
    })
    window.electron.ipcRenderer.on('window-unmaximized', () => {
      isMaximized.value = false
    })
  }
})

const minimizeWindow = () => {
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('minimize-window')
  }
}

const maximizeWindow = () => {
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('maximize-window')
    isMaximized.value = !isMaximized.value
  }
}

const closeWindow = () => {
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('close-window')
  }
}
</script>

<template>
  <div class="flex justify-between bg-[#2c2c2c] text-white p-0 select-none border-b border-[#1a1a1a] draggable-region">
    <div class="flex items-center px-2 no-drag">
      <img :src="appIcon" alt="App Icon" class="w-5 h-5 object-contain mr-2" />
      <span class="text-xs text-[#aaa]">Camera Preview</span>
    </div>
    
    <!-- Window Controls -->
    <div class="flex items-stretch no-drag">
      <button
        @click="minimizeWindow"
        class="px-4 hover:bg-[#3c3c3c] flex items-center transition-colors"
        title="Minimize"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="currentColor" d="M19 13H5v-2h14z"/>
        </svg>
      </button>
      <button
        @click="maximizeWindow"
        class="px-4 hover:bg-[#3c3c3c] flex items-center transition-colors"
        title="Maximize"
      >
        <svg v-if="!isMaximized" class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="currentColor" d="M4 4h16v16H4zm2 2v12h12V6z"/>
        </svg>
        <svg v-else class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="currentColor" d="M4 8h4V4h12v12h-4v4H4zm12-2V4h-2v4h4V6zM6 10v8h8v-8z"/>
        </svg>
      </button>
      <button
        @click="closeWindow"
        class="px-4 hover:bg-[#e81123] flex items-center transition-colors"
        title="Close"
      >
        <i class="bi bi-x-lg text-sm"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.draggable-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}
</style>
