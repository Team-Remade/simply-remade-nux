<script setup>
import { ref, onMounted } from 'vue'
import { randomInt } from '../MathUtil'
import appIcon from '../../../../resources/appIcon01.png'
import cheggIcon from '../../../../resources/chegg.png'

const iconSrc = ref(appIcon)
const isMaximized = ref(false)

onMounted(() => {
  // Window icon Easter egg. This has a small chance to replace Steve with Herobrine
  const rand = randomInt(1, 1000)
  
  if (rand === 1) {
    iconSrc.value = cheggIcon
  }

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

const menuItems = [
  {
    label: 'File',
    submenu: ['New', 'Open', 'Recent', 'Save', 'Save As', 'Import Asset', 'Exit']
  },
  {
    label: 'Edit',
    submenu: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Duplicate', 'Delete', 'Hide', 'Show'],
  },
  {
    label: 'Render',
    submenu: ['Image', 'Animation'],
  },
  {
    label: 'View',
    submenu: ['Reset Work Camera', 'Secondary View', 'Markers', 'Home Screen'],
  },
  {
    label: 'Help',
    submenu: ['About', 'Tutorials']
  }
]

const activeMenu = ref(null)

const toggleMenu = (index) => {
  activeMenu.value = activeMenu.value === index ? null : index
}

const closeMenu = () => {
  activeMenu.value = null
}
</script>

<template>
  <div class="flex justify-between bg-[#2c2c2c] text-white p-0 select-none border-b border-[#1a1a1a] draggable-region" @mouseleave="closeMenu">
    <div class="flex no-drag">
      <div class="flex items-center px-2">
        <img :src="iconSrc" alt="App Icon" class="w-5 h-5 object-contain" />
      </div>
      <div
        v-for="(item, index) in menuItems"
        :key="index"
        class="relative px-3 py-1.5 cursor-pointer text-xs hover:bg-[#3c3c3c]"
        @click="toggleMenu(index)"
        @mouseenter="activeMenu !== null && toggleMenu(index)"
      >
        <span>{{ item.label }}</span>
        <div v-if="activeMenu === index" class="absolute top-full left-0 bg-[#2c2c2c] border border-[#1a1a1a] min-w-[140px] shadow-lg z-[1000]">
          <div v-for="(subitem, subindex) in item.submenu" :key="subindex" class="px-3 py-1.5 cursor-pointer hover:bg-[#3c3c3c] text-xs">
            {{ subitem }}
          </div>
        </div>
      </div>
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
