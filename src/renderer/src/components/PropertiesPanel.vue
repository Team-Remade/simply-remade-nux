<script setup>
import { inject, computed } from 'vue'

// Inject selected object from App.vue
const selectedObject = inject('selectedObject')

// Computed properties for transform values with two-way binding
const position = computed({
  get: () => selectedObject.value?.position || { x: 0, y: 0, z: 0 },
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.position = val
    }
  }
})

const rotation = computed({
  get: () => selectedObject.value?.rotation || { x: 0, y: 0, z: 0 },
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.rotation = val
    }
  }
})

const scale = computed({
  get: () => selectedObject.value?.scale || { x: 1, y: 1, z: 1 },
  set: (val) => {
    if (selectedObject.value) {
      selectedObject.value.scale = val
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
            <input type="number" v-model.number="position.x" placeholder="X"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="position.y" placeholder="Y"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="position.z" placeholder="Z"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
          </div>
        </div>
        
        <div class="mb-3">
          <div class="text-[#aaa] text-xs mb-1">Rotation</div>
          <div class="grid grid-cols-3 gap-1">
            <input type="number" v-model.number="rotation.x" placeholder="X"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="rotation.y" placeholder="Y"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="rotation.z" placeholder="Z"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
          </div>
        </div>
        
        <div class="mb-3">
          <div class="text-[#aaa] text-xs mb-1">Scale</div>
          <div class="grid grid-cols-3 gap-1">
            <input type="number" v-model.number="scale.x" placeholder="X"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="scale.y" placeholder="Y"
              class="bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99] placeholder:text-[#666]" />
            <input type="number" v-model.number="scale.z" placeholder="Z"
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
