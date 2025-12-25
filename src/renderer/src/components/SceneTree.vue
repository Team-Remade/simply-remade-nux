<script setup>
import { inject, ref } from 'vue'

// Inject scene state from App.vue
const sceneObjects = inject('sceneObjects')
const selectedObject = inject('selectedObject')
const selectObject = inject('selectObject')
const setParent = inject('setParent')
const deleteObject = inject('deleteObject')

// Context menu state
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  targetObject: null
})

const showContextMenu = (event, obj) => {
  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    targetObject: obj
  }
}

const hideContextMenu = () => {
  contextMenu.value.visible = false
}

const handleDeleteFromContextMenu = () => {
  if (contextMenu.value.targetObject) {
    deleteObject(contextMenu.value.targetObject)
  }
  hideContextMenu()
}

const toggleExpand = (obj) => {
  obj.expanded = !obj.expanded
}

// Drag and drop state
const draggedObject = ref(null)
const dropTarget = ref(null)

const handleDragStart = (event, obj) => {
  draggedObject.value = obj
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', obj.id)
  // Add a semi-transparent effect to the dragged element
  event.target.style.opacity = '0.5'
}

const handleDragEnd = (event) => {
  event.target.style.opacity = '1'
  draggedObject.value = null
  dropTarget.value = null
}

const handleDragOver = (event, obj) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  
  // Don't allow dropping onto itself or its own children
  if (draggedObject.value && obj.id !== draggedObject.value.id && !isDescendant(obj, draggedObject.value)) {
    dropTarget.value = obj
  } else {
    dropTarget.value = null
  }
}

const handleDragLeave = (event) => {
  // Only clear if we're actually leaving this element
  if (event.target === event.currentTarget) {
    dropTarget.value = null
  }
}

const handleDrop = (event, targetObj) => {
  event.preventDefault()
  event.stopPropagation()
  
  if (draggedObject.value && targetObj.id !== draggedObject.value.id) {
    // Don't allow parenting to own descendants
    if (!isDescendant(targetObj, draggedObject.value)) {
      setParent(draggedObject.value, targetObj)
    }
  }
  
  dropTarget.value = null
  draggedObject.value = null
}

const handleDropOnRoot = (event) => {
  event.preventDefault()
  event.stopPropagation()
  
  if (draggedObject.value) {
    // Move to root level
    setParent(draggedObject.value, null)
  }
  
  dropTarget.value = null
  draggedObject.value = null
}

// Check if checkObj is a descendant of parentObj
const isDescendant = (checkObj, parentObj) => {
  if (!parentObj.children) return false
  
  for (const child of parentObj.children) {
    if (child.id === checkObj.id) return true
    if (isDescendant(checkObj, child)) return true
  }
  
  return false
}
</script>

<template>
  <div
    class="flex flex-col bg-[#252525] border border-[#2c2c2c] h-full overflow-hidden"
    @dragover.prevent
    @drop="handleDropOnRoot"
    @click="hideContextMenu"
  >
    <div class="bg-[#2c2c2c] text-white px-2 py-1.5 text-xs font-medium border-b border-[#1a1a1a]">
      Scene Tree
    </div>
    <div class="flex-1 overflow-y-auto py-1">
      <div v-for="(obj, index) in sceneObjects" :key="index" class="w-full">
        <div
          draggable="true"
          class="flex items-center px-3 py-1 cursor-pointer text-[#ccc] text-[13px] select-none hover:bg-[#2c2c2c] transition-colors"
          :class="{
            'bg-[#3c5a99] text-white': selectedObject === obj,
            'bg-[#4a4a4a] outline outline-2 outline-blue-400': dropTarget === obj
          }"
          @click="selectObject(obj)"
          @contextmenu="showContextMenu($event, obj)"
          @dragstart="handleDragStart($event, obj)"
          @dragend="handleDragEnd"
          @dragover="handleDragOver($event, obj)"
          @dragleave="handleDragLeave"
          @drop="handleDrop($event, obj)"
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
            draggable="true"
            class="flex items-center pl-7 pr-3 py-1 cursor-pointer text-[#ccc] text-[13px] select-none hover:bg-[#2c2c2c] transition-colors"
            :class="{
              'bg-[#3c5a99] text-white': selectedObject === child,
              'bg-[#4a4a4a] outline outline-2 outline-blue-400': dropTarget === child
            }"
            @click="selectObject(child)"
            @contextmenu="showContextMenu($event, child)"
            @dragstart="handleDragStart($event, child)"
            @dragend="handleDragEnd"
            @dragover="handleDragOver($event, child)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, child)"
          >
            <span class="w-4 mr-1">  </span>
            <span>{{ child.name }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="fixed bg-[#2c2c2c] border border-[#3a3a3a] rounded shadow-lg py-1 z-50"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div
        class="px-4 py-2 text-[13px] text-[#ccc] hover:bg-[#3c3c3c] cursor-pointer"
        @click="handleDeleteFromContextMenu"
      >
        Delete
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom dark scrollbar styling */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 0;
}

::-webkit-scrollbar-thumb {
  background: #3c3c3c;
  border-radius: 6px;
  border: 2px solid #1a1a1a;
}

::-webkit-scrollbar-thumb:hover {
  background: #4c4c4c;
}

::-webkit-scrollbar-thumb:active {
  background: #5c5c5c;
}

::-webkit-scrollbar-corner {
  background: #1a1a1a;
}

/* Firefox scrollbar styling */
* {
  scrollbar-width: thin;
  scrollbar-color: #3c3c3c #1a1a1a;
}
</style>
