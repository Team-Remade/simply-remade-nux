<script setup>
import { inject, ref, defineComponent, h } from 'vue'

// Inject scene state from App.vue
const sceneObjects = inject('sceneObjects')
const selectedObject = inject('selectedObject')
const selectObject = inject('selectObject')
const setParent = inject('setParent')
const deleteObject = inject('deleteObject')
const duplicateObject = inject('duplicateObject')

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

const handleDuplicateFromContextMenu = () => {
  if (contextMenu.value.targetObject) {
    duplicateObject(contextMenu.value.targetObject)
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

// Recursive TreeItem component
const TreeItem = defineComponent({
  name: 'TreeItem',
  props: {
    obj: Object,
    depth: Number,
    selectedObject: Object,
    dropTarget: Object
  },
  emits: ['select', 'contextMenu', 'dragStart', 'dragEnd', 'dragOver', 'dragLeave', 'drop', 'toggleExpand'],
  setup(props, { emit }) {
    return () => {
      const paddingLeft = props.depth * 16 + 12 // 16px per level + 12px base
      
      return h('div', { class: 'w-full' }, [
        // Main item
        h('div', {
          draggable: true,
          class: [
            'flex items-center py-1 cursor-pointer text-[#ccc] text-[13px] select-none hover:bg-[#2c2c2c] transition-colors',
            {
              'bg-[#3c5a99] text-white': props.selectedObject === props.obj,
              'bg-[#4a4a4a] outline outline-2 outline-blue-400': props.dropTarget === props.obj
            }
          ],
          style: { paddingLeft: `${paddingLeft}px`, paddingRight: '12px' },
          onClick: () => emit('select', props.obj),
          onContextmenu: (e) => emit('contextMenu', e, props.obj),
          onDragstart: (e) => emit('dragStart', e, props.obj),
          onDragend: (e) => emit('dragEnd', e),
          onDragover: (e) => emit('dragOver', e, props.obj),
          onDragleave: (e) => emit('dragLeave', e),
          onDrop: (e) => emit('drop', e, props.obj)
        }, [
          h('span', {
            class: 'w-4 mr-1 text-[10px] cursor-pointer',
            onClick: (e) => {
              e.stopPropagation()
              emit('toggleExpand', props.obj)
            }
          }, [
            props.obj.children && props.obj.children.length > 0
              ? h('i', {
                  class: props.obj.expanded ? 'bi bi-chevron-down' : 'bi bi-chevron-right'
                })
              : null
          ]),
          h('span', props.obj.name)
        ]),
        // Children (recursive)
        props.obj.expanded && props.obj.children
          ? h('div', props.obj.children.map((child, index) =>
              h(TreeItem, {
                key: index,
                obj: child,
                depth: props.depth + 1,
                selectedObject: props.selectedObject,
                dropTarget: props.dropTarget,
                onSelect: (obj) => emit('select', obj),
                onContextMenu: (e, obj) => emit('contextMenu', e, obj),
                onDragStart: (e, obj) => emit('dragStart', e, obj),
                onDragEnd: (e) => emit('dragEnd', e),
                onDragOver: (e, obj) => emit('dragOver', e, obj),
                onDragLeave: (e) => emit('dragLeave', e),
                onDrop: (e, obj) => emit('drop', e, obj),
                onToggleExpand: (obj) => emit('toggleExpand', obj)
              })
            ))
          : null
      ])
    }
  }
})
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
      <TreeItem
        v-for="(obj, index) in sceneObjects"
        :key="index"
        :obj="obj"
        :depth="0"
        :selected-object="selectedObject"
        :drop-target="dropTarget"
        @select="selectObject"
        @context-menu="showContextMenu"
        @drag-start="handleDragStart"
        @drag-end="handleDragEnd"
        @drag-over="handleDragOver"
        @drag-leave="handleDragLeave"
        @drop="handleDrop"
        @toggle-expand="toggleExpand"
      />
    </div>
    
    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="fixed bg-[#2c2c2c] border border-[#3a3a3a] rounded shadow-lg py-0.5 z-50"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div
        class="px-3 py-1 text-[13px] text-[#ccc] hover:bg-[#3c3c3c] cursor-pointer"
        @click="handleDuplicateFromContextMenu"
      >
        Duplicate
      </div>
      <div
        class="px-3 py-1 text-[13px] text-[#ccc] hover:bg-[#3c3c3c] cursor-pointer"
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
