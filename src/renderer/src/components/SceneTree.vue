<script setup>
import { inject } from 'vue'

// Inject scene state from App.vue
const sceneObjects = inject('sceneObjects')
const selectedObject = inject('selectedObject')
const selectObject = inject('selectObject')

const toggleExpand = (obj) => {
  obj.expanded = !obj.expanded
}
</script>

<template>
  <div class="flex flex-col bg-[#252525] border border-[#2c2c2c] h-full overflow-hidden">
    <div class="bg-[#2c2c2c] text-white px-3 py-2 text-sm font-medium border-b border-[#1a1a1a]">
      Scene Tree
    </div>
    <div class="flex-1 overflow-y-auto py-2">
      <div v-for="(obj, index) in sceneObjects" :key="index" class="w-full">
        <div
          class="flex items-center px-3 py-1 cursor-pointer text-[#ccc] text-[13px] select-none hover:bg-[#2c2c2c]"
          :class="{ 'bg-[#3c5a99] text-white': selectedObject === obj }"
          @click="selectObject(obj)"
        >
          <span class="w-4 mr-1 text-[10px] cursor-pointer" @click.stop="toggleExpand(obj)">
            <i v-if="obj.children" :class="obj.expanded ? 'bi bi-chevron-down' : 'bi bi-chevron-right'"></i>
          </span>
          <span>{{ obj.name }}</span>
        </div>
        <div v-if="obj.expanded && obj.children">
          <div
            v-for="(child, childIndex) in obj.children"
            :key="childIndex"
            class="flex items-center pl-7 pr-3 py-1 cursor-pointer text-[#ccc] text-[13px] select-none hover:bg-[#2c2c2c]"
            :class="{ 'bg-[#3c5a99] text-white': selectedObject === child }"
            @click="selectObject(child)"
          >
            <span class="w-4 mr-1">  </span>
            <span>{{ child.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
