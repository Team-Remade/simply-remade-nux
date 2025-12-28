<script setup>
import { inject, computed, ref } from 'vue'

// Inject from App.vue
const selectedObject = inject('selectedObject')
const projectSettings = inject('projectSettings')

// Active tab state
const activeTab = ref('project')

// Dropdown states
const mainSettingsExpanded = ref(true)
const backgroundSettingsExpanded = ref(true)

// Resolution preset
const resolutionPreset = ref('HD720')
const customWidth = ref(1280)
const customHeight = ref(720)

const resolutionPresets = {
  'Avatar': { width: 512, height: 512 },
  'VGA': { width: 640, height: 480 },
  'HD720': { width: 1280, height: 720 },
  'FHD1080': { width: 1920, height: 1080 },
  'QHD1440': { width: 2560, height: 1440 },
  '4K': { width: 3840, height: 2160 },
  'HD720 Cinematic': { width: 1680, height: 720 },
  'FHD1080 Cinematic': { width: 2560, height: 1080 },
  'QHD1440 Cinematic': { width: 3440, height: 1440 },
  'QHD+ 1600 Cinematic': { width: 3840, height: 1600 },
  'UW4K': { width: 4320, height: 1800 },
  'UW5K': { width: 5120, height: 2160 }
}

// Computed properties for transform values with two-way binding
// Position (1 meter = 16 arbitrary units - display in arbitrary units)
const positionX = computed({
  get: () => parseFloat(((selectedObject.value?.position?.x || 0) * 16).toFixed(2)),
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.position.x = parseFloat(val) / 16
    }
  }
})

const positionY = computed({
  get: () => parseFloat(((selectedObject.value?.position?.y || 0) * 16).toFixed(2)),
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.position.y = parseFloat(val) / 16
    }
  }
})

const positionZ = computed({
  get: () => parseFloat(((selectedObject.value?.position?.z || 0) * 16).toFixed(2)),
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.position.z = parseFloat(val) / 16
    }
  }
})

// Rotation (degrees to radians conversion)
const rotationX = computed({
  get: () => parseFloat(((selectedObject.value?.rotation?.x || 0) * 180 / Math.PI).toFixed(2)),
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.rotation.x = parseFloat(val) * Math.PI / 180
    }
  }
})

const rotationY = computed({
  get: () => parseFloat(((selectedObject.value?.rotation?.y || 0) * 180 / Math.PI).toFixed(2)),
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.rotation.y = parseFloat(val) * Math.PI / 180
    }
  }
})

const rotationZ = computed({
  get: () => parseFloat(((selectedObject.value?.rotation?.z || 0) * 180 / Math.PI).toFixed(2)),
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.rotation.z = parseFloat(val) * Math.PI / 180
    }
  }
})

// Scale (no conversion needed)
const scaleX = computed({
  get: () => selectedObject.value?.scale?.x || 1,
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.scale.x = parseFloat(val)
    }
  }
})

const scaleY = computed({
  get: () => selectedObject.value?.scale?.y || 1,
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.scale.y = parseFloat(val)
    }
  }
})

const scaleZ = computed({
  get: () => selectedObject.value?.scale?.z || 1,
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.scale.z = parseFloat(val)
    }
  }
})

// Opacity (0-100% display, stored as 0-1 internally)
const opacity = computed({
  get: () => {
    // Return default 100 if not set
    if (!selectedObject.value) return 100
    if (selectedObject.value.opacity === undefined) return 100
    return parseFloat(((selectedObject.value.opacity) * 100).toFixed(2))
  },
  set: (val) => {
    if (selectedObject.value) {
      // Convert percentage (0-100) to decimal (0-1)
      selectedObject.value.opacity = parseFloat(val) / 100
    }
  }
})

// Pivot Offset (same visual scaling as position - 1 meter = 16 arbitrary units)
const pivotOffsetX = computed({
  get: () => {
    const val = selectedObject.value?.pivotOffset?.x !== undefined
      ? selectedObject.value.pivotOffset.x
      : 0
    return parseFloat((val * 16).toFixed(2))
  },
  set: (val) => {
    if (selectedObject.value) {
      if (!selectedObject.value.pivotOffset) {
        selectedObject.value.pivotOffset = { x: 0, y: -0.5, z: 0 }
      }
      // Handle empty/NaN values by defaulting to 0
      const parsedVal = parseFloat(val)
      selectedObject.value.pivotOffset.x = isNaN(parsedVal) ? 0 : parsedVal / 16
    }
  }
})

const pivotOffsetY = computed({
  get: () => {
    const val = selectedObject.value?.pivotOffset?.y !== undefined
      ? selectedObject.value.pivotOffset.y
      : -0.5
    return parseFloat((val * 16).toFixed(2))
  },
  set: (val) => {
    if (selectedObject.value) {
      if (!selectedObject.value.pivotOffset) {
        selectedObject.value.pivotOffset = { x: 0, y: -0.5, z: 0 }
      }
      // Handle empty/NaN values by defaulting to 0
      const parsedVal = parseFloat(val)
      selectedObject.value.pivotOffset.y = isNaN(parsedVal) ? 0 : parsedVal / 16
    }
  }
})

const pivotOffsetZ = computed({
  get: () => {
    const val = selectedObject.value?.pivotOffset?.z !== undefined
      ? selectedObject.value.pivotOffset.z
      : 0
    return parseFloat((val * 16).toFixed(2))
  },
  set: (val) => {
    if (selectedObject.value) {
      if (!selectedObject.value.pivotOffset) {
        selectedObject.value.pivotOffset = { x: 0, y: -0.5, z: 0 }
      }
      // Handle empty/NaN values by defaulting to 0
      const parsedVal = parseFloat(val)
      selectedObject.value.pivotOffset.z = isNaN(parsedVal) ? 0 : parsedVal / 16
    }
  }
})

// Handle background image file selection
const handleBackgroundImageChange = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      projectSettings.value.backgroundImage = e.target.result
    }
    reader.readAsDataURL(file)
  }
}
</script>

<template>
  <div class="flex flex-col bg-[#252525] border border-[#2c2c2c] h-full overflow-hidden">
    <div class="bg-[#2c2c2c] text-white px-2 py-1.5 text-xs font-medium border-b border-[#1a1a1a]">
      Properties
    </div>
    
    <!-- Tabs -->
    <div class="flex bg-[#1a1a1a] border-b border-[#2c2c2c]">
      <button
        @click="activeTab = 'project'"
        :class="[
          'px-2 py-1.5 text-xs font-medium transition-colors',
          activeTab === 'project'
            ? 'bg-[#252525] text-white border-b-2 border-[#3c5a99]'
            : 'text-[#aaa] hover:text-white hover:bg-[#2c2c2c]'
        ]"
      >
        Project
      </button>
      <button
        v-if="selectedObject"
        @click="activeTab = 'object'"
        :class="[
          'px-2 py-1.5 text-xs font-medium transition-colors',
          activeTab === 'object'
            ? 'bg-[#252525] text-white border-b-2 border-[#3c5a99]'
            : 'text-[#aaa] hover:text-white hover:bg-[#2c2c2c]'
        ]"
      >
        Object
      </button>
    </div>
    
    <!-- Tab Content -->
    <div class="flex-1 overflow-y-auto p-2">
      <!-- Project Properties Tab -->
      <div v-if="activeTab === 'project'">
        <!-- Main Project Settings Dropdown -->
        <div class="mb-3">
          <button
            @click="mainSettingsExpanded = !mainSettingsExpanded"
            class="w-full flex items-center justify-between text-white text-[13px] font-medium py-2 px-2 hover:bg-[#2c2c2c] rounded transition-colors"
          >
            <span>Main Project Settings</span>
            <svg
              :class="['w-4 h-4 transition-transform', mainSettingsExpanded ? 'rotate-90' : '']"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div v-if="mainSettingsExpanded" class="mt-2 pl-2 space-y-3">
            <div>
              <label class="text-[#aaa] text-xs mb-1 block">Project Name</label>
              <input
                type="text"
                placeholder="Untitled Project"
                class="w-full bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]"
              />
            </div>
            <div>
              <label class="text-[#aaa] text-xs mb-1 block">Resolution</label>
              <select
                v-model="resolutionPreset"
                class="w-full bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] mb-2"
              >
                <option value="Avatar">Avatar 512x512</option>
                <option value="VGA">VGA 640x480</option>
                <option value="HD720">HD720 1280x720</option>
                <option value="FHD1080">FHD1080 1920x1080</option>
                <option value="QHD1440">QHD1440 2560x1440</option>
                <option value="4K">4K 3840x2160</option>
                <option value="HD720 Cinematic">HD720 Cinematic 1680x720</option>
                <option value="FHD1080 Cinematic">FHD1080 Cinematic 2560x1080</option>
                <option value="QHD1440 Cinematic">QHD1440 Cinematic 3440x1440</option>
                <option value="QHD+ 1600 Cinematic">QHD+ 1600 Cinematic 3840x1600</option>
                <option value="UW4K">UW4K 4320x1800</option>
                <option value="UW5K">UW5K 5120x2160</option>
                <option value="Custom">Custom</option>
              </select>
              <div v-if="resolutionPreset === 'Custom'" class="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  v-model.number="customWidth"
                  placeholder="Width"
                  class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]"
                />
                <input
                  type="number"
                  v-model.number="customHeight"
                  placeholder="Height"
                  class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]"
                />
              </div>
              <div v-else class="text-[#666] text-xs">
                {{ resolutionPresets[resolutionPreset]?.width }} x {{ resolutionPresets[resolutionPreset]?.height }}
              </div>
            </div>
            <div>
              <label class="text-[#aaa] text-xs mb-1 block">Frame Rate</label>
              <input
                type="number"
                placeholder="60"
                class="w-full bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]"
              />
            </div>
          </div>
        </div>

        <!-- Background Settings Dropdown -->
        <div class="mb-3">
          <button
            @click="backgroundSettingsExpanded = !backgroundSettingsExpanded"
            class="w-full flex items-center justify-between text-white text-[13px] font-medium py-2 px-2 hover:bg-[#2c2c2c] rounded transition-colors"
          >
            <span>Background Settings</span>
            <svg
              :class="['w-4 h-4 transition-transform', backgroundSettingsExpanded ? 'rotate-90' : '']"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div v-if="backgroundSettingsExpanded" class="mt-2 pl-2 space-y-3">
            <div>
              <label class="text-[#aaa] text-xs mb-1 block">Background Color</label>
              <div class="flex gap-2 mb-2">
                <input
                  type="color"
                  v-model="projectSettings.backgroundColor"
                  class="w-10 h-7 bg-[#1a1a1a] border border-[#3c3c3c] rounded-sm cursor-pointer"
                />
                <input
                  type="text"
                  v-model="projectSettings.backgroundColor"
                  placeholder="#000000"
                  class="flex-1 bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]"
                />
              </div>
              <div class="grid grid-cols-3 gap-1">
                <button
                  @click="projectSettings.backgroundColor = '#9393FF'"
                  class="px-2 py-1 text-[10px] bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                  title="Sky Blue"
                >
                  <span class="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style="background-color: #9393FF"></span>
                  Sky
                </button>
                <button
                  @click="projectSettings.backgroundColor = '#FFA500'"
                  class="px-2 py-1 text-[10px] bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                  title="Sunset"
                >
                  <span class="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style="background-color: #FFA500"></span>
                  Sunset
                </button>
                <button
                  @click="projectSettings.backgroundColor = '#FFC0CB'"
                  class="px-2 py-1 text-[10px] bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                  title="Dawn"
                >
                  <span class="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style="background-color: #FFC0CB"></span>
                  Dawn
                </button>
                <button
                  @click="projectSettings.backgroundColor = '#666680'"
                  class="px-2 py-1 text-[10px] bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                  title="Storm"
                >
                  <span class="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style="background-color: #666680"></span>
                  Storm
                </button>
                <button
                  @click="projectSettings.backgroundColor = '#1A1A33'"
                  class="px-2 py-1 text-[10px] bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                  title="Night"
                >
                  <span class="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style="background-color: #1A1A33"></span>
                  Night
                </button>
                <button
                  @click="projectSettings.backgroundColor = '#000000'"
                  class="px-2 py-1 text-[10px] bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                  title="Black"
                >
                  <span class="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style="background-color: #000000"></span>
                  Black
                </button>
              </div>
            </div>
            <div>
              <label class="text-[#aaa] text-xs mb-1 block">Background Image</label>
              <div class="flex gap-1">
                <input
                  type="file"
                  accept="image/*"
                  @change="handleBackgroundImageChange"
                  class="hidden"
                  ref="fileInput"
                />
                <button
                  @click="$refs.fileInput.click()"
                  class="flex-1 px-2 py-1 text-xs bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                >
                  {{ projectSettings.backgroundImage ? 'Change Image' : 'Load Image' }}
                </button>
                <button
                  v-if="projectSettings.backgroundImage"
                  @click="projectSettings.backgroundImage = null"
                  class="px-2 py-1 text-xs bg-[#1a1a1a] border border-[#3c3c3c] text-white rounded-sm hover:bg-[#2c2c2c] transition-colors"
                  title="Clear Image"
                >
                  Clear
                </button>
              </div>
              <div v-if="projectSettings.backgroundImage" class="text-[#666] text-[10px] mt-1">
                Image loaded
              </div>
            </div>
            <div v-if="projectSettings.backgroundImage">
              <label class="flex items-center gap-2 cursor-pointer text-[#aaa] text-xs hover:text-white transition-colors">
                <input
                  type="checkbox"
                  v-model="projectSettings.backgroundStretchToFit"
                  class="w-3.5 h-3.5 bg-[#1a1a1a] border border-[#3c3c3c] rounded-sm cursor-pointer accent-[#3c8edb]"
                />
                <span>Stretch to Fit</span>
              </label>
              <div class="text-[#666] text-[10px] mt-0.5 ml-5">
                When unchecked, image renders at original resolution
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Object Properties Tab -->
      <div v-if="activeTab === 'object' && selectedObject" class="mb-4">
        <div class="text-white text-[13px] font-medium mb-2">
          {{ selectedObject.name }}
        </div>
        <div class="text-[#aaa] text-xs mb-3">{{ selectedObject.type }}</div>
        
        <div class="text-white text-[13px] font-medium mb-3 pb-1 border-b border-[#3c3c3c]">
          Transform
        </div>
        
        <div class="mb-3">
          <div class="text-[#aaa] text-xs mb-1">Position</div>
          <div class="grid grid-cols-3 gap-1">
            <input type="number" v-model.number="positionX" placeholder="X"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="positionY" placeholder="Y"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="positionZ" placeholder="Z"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
          </div>
        </div>
        
        <div class="mb-3">
          <div class="text-[#aaa] text-xs mb-1">Rotation</div>
          <div class="grid grid-cols-3 gap-1">
            <input type="number" v-model.number="rotationX" placeholder="X"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="rotationY" placeholder="Y"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="rotationZ" placeholder="Z"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
          </div>
        </div>
        
        <div v-if="selectedObject.type !== 'perspective-camera' && selectedObject.type !== 'orthographic-camera'" class="mb-3">
          <div class="text-[#aaa] text-xs mb-1">Scale</div>
          <div class="grid grid-cols-3 gap-1">
            <input type="number" v-model.number="scaleX" placeholder="X"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="scaleY" placeholder="Y"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="scaleZ" placeholder="Z"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
          </div>
        </div>
        
        <div class="mb-3">
          <div class="text-[#aaa] text-xs mb-1 flex items-center gap-1">
            <span>Pivot Offset</span>
            <span class="text-[#666] text-[10px]">(non-keyframable)</span>
          </div>
          <div class="grid grid-cols-3 gap-1">
            <input type="number" v-model.number="pivotOffsetX" placeholder="X"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="pivotOffsetY" placeholder="Y"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="pivotOffsetZ" placeholder="Z"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
          </div>
        </div>
        
        <div class="text-white text-[13px] font-medium mb-3 pb-1 border-b border-[#3c3c3c]">
          Material
        </div>
        
        <div class="mb-3">
          <div class="text-[#aaa] text-xs mb-1">Opacity (%)</div>
          <input type="number" v-model.number="opacity" placeholder="100" min="0" max="100" step="1"
            class="w-full bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
        </div>
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
