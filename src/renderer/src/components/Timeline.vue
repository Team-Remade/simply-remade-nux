<script setup>
import { ref } from 'vue'

const currentFrame = ref(0)
const totalFrames = ref(250)
const isPlaying = ref(false)

const play = () => {
  isPlaying.value = !isPlaying.value
}

const stop = () => {
  isPlaying.value = false
  currentFrame.value = 0
}

const goToStart = () => {
  currentFrame.value = 0
}

const goToEnd = () => {
  currentFrame.value = totalFrames.value
}
</script>

<template>
  <div class="flex flex-col bg-[#252525] border border-[#2c2c2c] h-full">
    <div class="bg-[#2c2c2c] text-[#aaa] px-3 py-1 text-xs border-b border-[#1a1a1a]">
      <span>Timeline</span>
    </div>
    <div class="flex items-center gap-2 px-3 py-2 bg-[#2c2c2c] border-b border-[#1a1a1a]">
      <button @click="goToStart" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        ⏮
      </button>
      <button @click="play" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button @click="stop" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        ⏹
      </button>
      <button @click="goToEnd" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        ⏭
      </button>
      <div class="flex items-center gap-2 ml-auto text-[#aaa] text-xs">
        <span>Frame:</span>
        <input type="number" v-model="currentFrame" min="0" :max="totalFrames" 
          class="w-[60px] bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99]" />
        <span>/ {{ totalFrames }}</span>
      </div>
    </div>
    <div class="relative flex-1 bg-[#1a1a1a] min-h-[60px] overflow-hidden">
      <div class="relative w-full h-full">
        <div
          v-for="frame in Math.floor(totalFrames / 10) + 1"
          :key="frame"
          v-show="frame * 10 <= totalFrames"
          class="absolute top-0 h-full"
          :style="{ left: `${(frame * 10) / totalFrames * 100}%` }"
        >
          <div class="w-px h-3 bg-[#4c4c4c] -ml-px"></div>
          <div class="text-[#666] text-[10px] mt-0.5 -translate-x-1/2 whitespace-nowrap">{{ frame * 10 }}</div>
        </div>
      </div>
      <div class="absolute top-0 h-full pointer-events-none" :style="{ left: `${(currentFrame / totalFrames) * 100}%` }">
        <div class="w-0.5 h-full bg-[#ff4444] shadow-[0_0_4px_rgba(255,68,68,0.5)]"></div>
      </div>
    </div>
  </div>
</template>
