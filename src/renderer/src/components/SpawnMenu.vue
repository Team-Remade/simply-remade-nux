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
const selectedState = ref(null)
const searchQuery = ref('')
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
        category: block.category || null,
        states: block.states || null,
        id: block.path // Use path as unique identifier
      }))
    }
  } catch (error) {
    console.error('Failed to load blocks:', error)
  }
})

// Object categories and items
const spawnCategories = computed(() => {
  // Group blocks by subcategory
  const blocksByCategory = {}
  
  blocks.value.forEach(block => {
    const category = block.category || 'Other'
    if (!blocksByCategory[category]) {
      blocksByCategory[category] = []
    }
    blocksByCategory[category].push(block)
  })
  
  // Convert to items array with subcategory headers
  const blockItems = []
  const sortedCategories = Object.keys(blocksByCategory).sort()
  
  sortedCategories.forEach(category => {
    // Add subcategory header
    blockItems.push({
      name: category,
      type: 'subcategory-header',
      isHeader: true,
      id: `header-${category}` // Unique ID for headers
    })
    // Add blocks in this subcategory
    blocksByCategory[category].forEach(block => {
      blockItems.push({
        ...block,
        categoryName: category // Store which category this block belongs to
      })
    })
  })
  
  return {
    'Primitives': [
      { name: 'Cube', type: 'cube' },
      { name: 'Sphere', type: 'sphere' },
      { name: 'Cylinder', type: 'cylinder' },
      { name: 'Cone', type: 'cone' },
      { name: 'Plane', type: 'plane' }
    ],
    'Blocks': blockItems,
    'Lights': [
      { name: 'Point Light', type: 'pointlight' },
      { name: 'Directional Light', type: 'directionallight' },
      { name: 'Spot Light', type: 'spotlight' }
    ],
    'Cameras': [
      { name: 'Perspective Camera', type: 'perspective-camera' },
      { name: 'Orthographic Camera', type: 'orthographic-camera' }
    ]
  }
})

const categoryList = computed(() => Object.keys(spawnCategories.value))

const currentCategoryItems = computed(() => {
  const items = spawnCategories.value[selectedCategory.value] || []
  
  // If search query is empty, return all items
  if (!searchQuery.value.trim()) {
    return items
  }
  
  // Filter items based on search query
  const query = searchQuery.value.toLowerCase().trim()
  const filtered = []
  let currentHeader = null
  const categoryItems = []
  
  items.forEach((item) => {
    if (item.isHeader) {
      // If we have a previous header with items, add them to filtered
      if (currentHeader && categoryItems.length > 0) {
        filtered.push(currentHeader)
        filtered.push(...categoryItems)
      }
      // Start new category
      currentHeader = item
      categoryItems.length = 0
    } else if (item.name.toLowerCase().includes(query)) {
      // Add matching item to current category
      categoryItems.push(item)
    }
  })
  
  // Don't forget the last category
  if (currentHeader && categoryItems.length > 0) {
    filtered.push(currentHeader)
    filtered.push(...categoryItems)
  }
  
  return filtered
})

// Function to select an item
const selectItem = (item) => {
  selectedItem.value = item
  // If the item has states, default to the first state
  if (item.states && item.states.length > 0) {
    selectedState.value = item.states[0]
  } else {
    selectedState.value = null
  }
}

// Function to select a state
const selectState = (state) => {
  selectedState.value = state
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
    // Use the selected state's path if available, otherwise use default
    if (selectedState.value && selectedState.value.path) {
      newObject.blockPath = selectedState.value.path
      newObject.blockState = selectedState.value.name
      // Add orientation if the state has one
      if (selectedState.value.orientation) {
        newObject.orientation = selectedState.value.orientation
      }
    } else {
      newObject.blockPath = selectedItem.value.blockPath
    }
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
      <!-- Category Header with Search -->
      <div class="border-b border-[#3c3c3c]">
        <div class="p-1.5 text-[#aaa] text-xs font-semibold">
          {{ selectedCategory }}
        </div>
        <div class="px-1.5 pb-1.5">
          <input
            v-model.trim="searchQuery"
            type="text"
            :placeholder="`Search ${selectedCategory}...`"
            @input="() => {}"
            class="w-full px-2 py-1 text-xs bg-[#1a1a1a] border border-[#3c3c3c] rounded text-[#aaa] placeholder-[#666] focus:outline-none focus:border-[#3c8edb]"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-1.5">
        <template v-for="item in currentCategoryItems" :key="item.id">
          <!-- Subcategory Header -->
          <div
            v-if="item.isHeader"
            class="px-2 py-1 text-[10px] font-semibold text-[#888] uppercase tracking-wider mt-2 first:mt-0"
          >
            {{ item.name }}
          </div>
          <!-- Regular Item Button -->
          <button
            v-else
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
          </template>
        </div>
        <!-- States Selector (if selected item has states) -->
        <div v-if="selectedItem?.states && selectedItem.states.length > 0" class="p-1.5 border-t border-[#3c3c3c] bg-[#252525]">
          <div class="text-[10px] text-[#888] uppercase tracking-wider mb-1 font-semibold">Block State</div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="state in selectedItem.states"
              :key="state.name"
              @click="selectState(state)"
              :class="[
                'px-2 py-1 text-xs rounded transition-colors capitalize',
                selectedState?.name === state.name
                  ? 'bg-[#3c8edb] text-white'
                  : 'bg-[#333] text-[#aaa] hover:bg-[#3c3c3c]'
              ]"
            >
              {{ state.name }}
            </button>
          </div>
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
