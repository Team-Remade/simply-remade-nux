<script setup>
import { ref, computed, inject, onMounted } from 'vue'

defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'spawn'])

// Inject scene state
const sceneObjects = inject('sceneObjects')
const selectObject = inject('selectObject')

const selectedCategory = ref('Primitives')
const selectedItem = ref(null)
const blocks = ref([])

// Load blocks from the API
onMounted(async () => {
  try {
    const blocksData = await window.api.getBlocks()
    if (blocksData && blocksData.blocks) {
      blocks.value = blocksData.blocks.map(block => ({
        name: block.name,
        type: 'block',
        blockPath: block.path,
        id: block.path // Use path as unique identifier
      }))
    }
  } catch (error) {
    console.error('Failed to load blocks:', error)
  }
})

// Object categories and items
const spawnCategories = computed(() => ({
  'Primitives': [
    { name: 'Cube', type: 'cube' },
    { name: 'Sphere', type: 'sphere' },
    { name: 'Cylinder', type: 'cylinder' },
    { name: 'Cone', type: 'cone' },
    { name: 'Plane', type: 'plane' }
  ],
  'Blocks': blocks.value,
  'Lights': [
    { name: 'Point Light', type: 'pointlight' },
    { name: 'Directional Light', type: 'directionallight' },
    { name: 'Spot Light', type: 'spotlight' }
  ],
  'Cameras': [
    { name: 'Perspective Camera', type: 'perspective-camera' },
    { name: 'Orthographic Camera', type: 'orthographic-camera' }
  ]
}))

const categoryList = computed(() => Object.keys(spawnCategories.value))
const currentCategoryItems = computed(() => spawnCategories.value[selectedCategory.value] || [])

// Function to select an item
const selectItem = (item) => {
  selectedItem.value = item
}

// Function to create the selected object
const createObject = () => {
  if (!selectedItem.value) return
  
  // Add object to scene
  const newObject = {
    id: Date.now().toString(),
    name: selectedItem.value.name,
    type: selectedItem.value.type,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    pivotOffset: { x: 0, y: -0.5, z: 0 },
    parent: null,
    expanded: false
  }
  
  // Add blockPath if it's a block
  if (selectedItem.value.blockPath) {
    newObject.blockPath = selectedItem.value.blockPath
  }
  
  sceneObjects.value.push(newObject)
  selectObject(newObject)
  emit('spawn', newObject)
  emit('close')
  selectedItem.value = null
}

const closeMenu = () => {
  emit('close')
}
</script>

<template>
  <div
    v-if="show"
    class="absolute top-20 left-4 w-[500px] h-[400px] bg-[#2c2c2c] border border-[#3c3c3c] rounded shadow-2xl z-10 flex overflow-hidden"
  >
    <!-- Categories Column -->
    <div class="w-1/3 bg-[#1a1a1a] border-r border-[#3c3c3c] overflow-y-auto">
      <div class="p-1.5 border-b border-[#3c3c3c] text-[#aaa] text-xs font-semibold">
        Categories
      </div>
      <div class="p-1">
        <button
          v-for="category in categoryList"
          :key="category"
          @click="selectedCategory = category"
          :class="[
            'w-full text-left px-2 py-1.5 text-xs rounded mb-0.5 transition-colors',
            selectedCategory === category
              ? 'bg-[#3c8edb] text-white'
              : 'text-[#aaa] hover:bg-[#333]'
          ]"
        >
          {{ category }}
        </button>
      </div>
    </div>

    <!-- Objects Column -->
    <div class="flex-1 flex flex-col">
      <div class="p-1.5 border-b border-[#3c3c3c] text-[#aaa] text-xs font-semibold">
        {{ selectedCategory }}
      </div>
      <div class="flex-1 overflow-y-auto p-1.5">
        <button
          v-for="item in currentCategoryItems"
          :key="item.id || item.type"
          @click="selectItem(item)"
          :class="[
            'w-full text-left px-2 py-1.5 text-xs rounded mb-0.5 transition-colors',
            (selectedItem?.id && selectedItem?.id === item.id) || (selectedItem?.type === item.type && !item.id)
              ? 'bg-[#3c8edb] text-white'
              : 'text-[#aaa] hover:bg-[#333]'
          ]"
        >
          {{ item.name }}
        </button>
      </div>
      <div class="p-1.5 border-t border-[#3c3c3c] flex justify-end gap-1.5">
        <button
          @click="closeMenu"
          class="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-[#333] text-[#aaa] rounded transition-colors"
        >
          Close
        </button>
        <button
          @click="createObject"
          :disabled="!selectedItem"
          :class="[
            'px-2 py-1 text-xs rounded transition-colors',
            selectedItem
              ? 'bg-[#3c8edb] hover:bg-[#2c7edb] text-white'
              : 'bg-[#1a1a1a] text-[#555] cursor-not-allowed'
          ]"
        >
          Create
        </button>
      </div>
    </div>
  </div>
</template>
