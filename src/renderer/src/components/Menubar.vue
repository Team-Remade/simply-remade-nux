<script setup>
import { ref } from 'vue'

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
  <div class="flex bg-[#2c2c2c] text-white p-0 select-none border-b border-[#1a1a1a]" @mouseleave="closeMenu">
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
</template>
