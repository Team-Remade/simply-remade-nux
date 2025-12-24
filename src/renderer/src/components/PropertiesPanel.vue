<script setup>
import { inject, computed } from 'vue'

// Inject selected object from App.vue
const selectedObject = inject('selectedObject')

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
</script>

<template>
  <div class="flex flex-col bg-[#252525] border border-[#2c2c2c] h-full overflow-hidden">
    <div class="bg-[#2c2c2c] text-white px-3 py-2 text-sm font-medium border-b border-[#1a1a1a]">
      Properties
    </div>
    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="selectedObject" class="mb-4">
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
        
        <div class="mb-3">
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
      </div>
      <div v-else class="text-[#666] text-sm text-center mt-8">
        No object selected
      </div>
    </div>
  </div>
</template>
