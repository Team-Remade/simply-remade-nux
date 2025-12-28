<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'

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
const viewportCamera = inject('viewportCamera', null)
const viewportControls = inject('viewportControls', null)

const selectedCategory = ref('Primitives')
const selectedItem = ref(null)
const selectedState = ref(null)
const searchQuery = ref('')
const itemRenderMode = ref('voxel') // 'voxel' or 'plane'
const itemTextureSource = ref('item') // 'item' or 'block'
const blocks = ref([])
const items = ref([])
const itemTextures = ref({}) // Store loaded textures for items

// Load blocks and items from the API
onMounted(async () => {
  try {
    // Load blocks
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
    
    // Load items
    const itemsData = await window.api.getItems()
    if (itemsData && itemsData.items) {
      items.value = itemsData.items.map(item => ({
        name: item.name,
        type: 'item',
        itemPath: item.path,
        useGenerated: item.useGenerated,
        category: item.category || null,
        id: item.path // Use path as unique identifier
      }))
      
      // Load textures for items
      for (const item of items.value) {
        loadItemTexture(item)
      }
    }
  } catch (error) {
    console.error('Failed to load blocks/items:', error)
  }
})

// Function to load item texture
const loadItemTexture = async (item, textureSource = 'item') => {
  try {
    // Load the item model to get the texture
    const itemModel = await window.api.loadBlockModel(item.itemPath)
    if (itemModel && itemModel.textures) {
      // Get layer0 texture (main texture for items)
      let textureRef = itemModel.textures.layer0
      if (textureRef) {
        // Replace /item/ with /block/ if using block textures
        if (textureSource === 'block') {
          textureRef = textureRef.replace(/\/item\//, '/block/')
          // Skip if the texture path still contains 'item' after replacement
          if (textureRef.includes('item')) {
            delete itemTextures.value[item.id]
            return
          }
        }
        
        const textureData = await window.api.loadTexture(textureRef)
        // Only add texture if successfully loaded and not using fallback
        if (textureData && textureData.data && !textureData.error) {
          itemTextures.value[item.id] = 'data:image/png;base64,' + textureData.data
        } else {
          // If texture failed to load, ensure it's not in the map
          delete itemTextures.value[item.id]
        }
      }
    }
  } catch (error) {
    console.error('Failed to load texture for item:', item.name, error)
    // Remove texture if it fails to load
    delete itemTextures.value[item.id]
  }
}

// Watch for texture source changes and reload item textures
watch(itemTextureSource, async (newSource) => {
  // Create a completely new empty object to force reactivity
  itemTextures.value = {}
  
  // Small delay to ensure reactivity updates
  await new Promise(resolve => setTimeout(resolve, 10))
  
  // Reload all item textures with new source
  for (const item of items.value) {
    await loadItemTexture(item, newSource)
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
  
  // Group items by subcategory
  const itemsByCategory = {}
  
  items.value.forEach(item => {
    const category = item.category || 'Other'
    if (!itemsByCategory[category]) {
      itemsByCategory[category] = []
    }
    itemsByCategory[category].push(item)
  })
  
  // Convert to items array with subcategory headers
  const itemsList = []
  const sortedItemCategories = Object.keys(itemsByCategory).sort()
  
  sortedItemCategories.forEach(category => {
    // Add subcategory header
    itemsList.push({
      name: category,
      type: 'subcategory-header',
      isHeader: true,
      id: `header-item-${category}` // Unique ID for headers
    })
    // Add items in this subcategory
    itemsByCategory[category].forEach(item => {
      itemsList.push({
        ...item,
        categoryName: category // Store which category this item belongs to
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
    'Items': itemsList,
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
  
  //Helper function to check if item should be shown
  const shouldShowItem = (item) => {
    // Skip headers
    if (item.isHeader) return true
    
    // For items, only show if texture is loaded
    if (item.type === 'item') {
      return !!itemTextures.value[item.id]
    }
    // For other types, always show
    return true
  }
  
  // Check if this category has headers (like Blocks and Items)
  const hasHeaders = items.some(item => item.isHeader)
  
  // If search query is empty, filter by texture availability
  if (!searchQuery.value.trim()) {
    // If no headers, just filter items directly
    if (!hasHeaders) {
      return items.filter(shouldShowItem)
    }
    
    // With headers, use the grouped filtering logic
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
      } else if (shouldShowItem(item)) {
        // Add item if it should be shown
        categoryItems.push(item)
      }
    })
    
    // Don't forget the last category
    if (currentHeader && categoryItems.length > 0) {
      filtered.push(currentHeader)
      filtered.push(...categoryItems)
    }
    
    return filtered
  }
  
  // Filter items based on search query AND texture availability
  const query = searchQuery.value.toLowerCase().trim()
  
  // If no headers, just filter items directly by name
  if (!hasHeaders) {
    return items.filter(item =>
      item.name.toLowerCase().includes(query) && shouldShowItem(item)
    )
  }
  
  // With headers, use the grouped filtering logic
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
    } else if (item.name.toLowerCase().includes(query) && shouldShowItem(item)) {
      // Add matching item to current category if it should be shown
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

// Function to create the selected object
const createObject = () => {
  if (!selectedItem.value) return
  
  // Check if spawning a camera - use viewport camera's position and rotation
  const isCameraType = selectedItem.value.type === 'perspective-camera' || selectedItem.value.type === 'orthographic-camera'
  let cameraPosition = { x: 0, y: 0, z: 0 }
  let cameraRotation = { x: 0, y: 0, z: 0 }
  
  if (isCameraType && viewportCamera?.value && viewportControls?.value) {
    cameraPosition = {
      x: viewportCamera.value.position.x,
      y: viewportCamera.value.position.y,
      z: viewportCamera.value.position.z
    }
    // Use yaw and pitch from controls for accurate rotation
    cameraRotation = {
      x: viewportControls.value.pitch,
      y: viewportControls.value.yaw,
      z: 0
    }
  }
  
  // Add object to scene
  const newObject = {
    id: Date.now().toString(),
    name: selectedItem.value.name,
    type: selectedItem.value.type,
    position: isCameraType ? cameraPosition : { x: 0, y: 0, z: 0 },
    rotation: isCameraType ? cameraRotation : { x: 0, y: 0, z: 0 },
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
  
  // Add itemPath if it's an item
  if (selectedItem.value.itemPath) {
    newObject.itemPath = selectedItem.value.itemPath
    newObject.useGenerated = selectedItem.value.useGenerated || false
    newObject.itemRenderMode = itemRenderMode.value // 'voxel' or 'plane'
    newObject.itemTextureSource = itemTextureSource.value // 'item' or 'block'
  }
  
  // Mark camera objects with centered pivot offset
  if (selectedItem.value.type === 'perspective-camera' || selectedItem.value.type === 'orthographic-camera') {
    // Camera-specific pivot offset (centered)
    newObject.pivotOffset = { x: 0, y: 0, z: 0 }
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
        <!-- Texture Source Selector (for Items category) -->
        <div v-if="selectedCategory === 'Items'" class="px-1.5 pb-1.5">
          <select
            v-model="itemTextureSource"
            class="w-full px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#3c3c3c] rounded text-[#aaa] focus:outline-none focus:border-[#3c8edb]"
          >
            <option value="item">Item Textures</option>
            <option value="block">Block Textures</option>
          </select>
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
        <template v-for="item in currentCategoryItems" :key="item.id || item.type">
          <!-- Subcategory Header -->
          <div
            v-if="item.isHeader"
            class="px-2 py-1 text-[10px] font-semibold text-[#888] uppercase tracking-wider mt-2 first:mt-0"
          >
            {{ item.name }}
          </div>
          <!-- Item Button with Texture (for items) - only show if texture loaded -->
          <button
            v-else-if="item.type === 'item' && itemTextures[item.id]"
            @click="selectItem(item)"
            :class="[
              'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded mb-0.5 transition-colors',
              (selectedItem?.id && selectedItem?.id === item.id)
                ? 'bg-[#3c8edb] text-white'
                : 'text-[#aaa] hover:bg-[#333]'
            ]"
          >
            <img
              :src="itemTextures[item.id]"
              :alt="item.name"
              class="w-4 h-4 pixelated"
              style="image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;"
            />
            <span>{{ item.name }}</span>
          </button>
          <!-- Regular Item Button (for blocks and other non-item objects) -->
          <button
            v-else-if="!item.isHeader && item.type !== 'item'"
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
          <select
            v-model="selectedState"
            class="w-full px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#3c3c3c] rounded text-[#aaa] focus:outline-none focus:border-[#3c8edb]"
          >
            <option
              v-for="state in selectedItem.states"
              :key="state.name"
              :value="state"
            >
              {{ state.name }}
            </option>
          </select>
        </div>
        <!-- Item Render Mode Selector (if selected item is an item) -->
        <div v-if="selectedItem?.type === 'item' && selectedCategory === 'Items'" class="p-1.5 border-t border-[#3c3c3c] bg-[#252525]">
          <div class="text-[10px] text-[#888] uppercase tracking-wider mb-1 font-semibold">Render Mode</div>
          <select
            v-model="itemRenderMode"
            class="w-full px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#3c3c3c] rounded text-[#aaa] focus:outline-none focus:border-[#3c8edb]"
          >
            <option value="voxel">3D Voxel</option>
            <option value="plane">Flat Plane</option>
          </select>
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
