<script setup>
import { ref, inject, onMounted, onUnmounted, watch } from 'vue'

// Inject scene state from App.vue
const sceneObjects = inject('sceneObjects')
const selectedObject = inject('selectedObject')
const currentFrame = inject('currentFrame')

const totalFrames = ref(250)
const isPlaying = ref(false)

// Timeline zoom state (1.0 = 100%, 2.0 = 200%, etc.)
const zoomLevel = ref(1.0)
const minZoom = 0.1
const maxZoom = 10.0

// Track expansion state for each object
const expandedObjects = ref({})

// Track which properties have collapsed axes (true = show individual x,y,z; false = show only xyz combined)
const expandedPropertyAxes = ref({})

// Selected keyframe state
const selectedKeyframes = ref([]) // Array of { obj, property, axis, frame }

// Dragging keyframe state
const draggingKeyframe = ref(null) // { obj, property, axis, originalFrame, startX }
const isDraggingKeyframe = ref(false)
const draggingKeyframes = ref([]) // Array of all keyframes being dragged: { obj, property, axis, originalFrame }

// Drag select state
const isDragSelecting = ref(false)
const dragSelectStart = ref({ x: 0, y: 0 })
const dragSelectCurrent = ref({ x: 0, y: 0 })

// Refs for scroll containers
const leftScrollContainer = ref(null)
const rightScrollContainer = ref(null)
const rulerContainer = ref(null)

// Sync scroll between left and right columns (vertical only)
const syncScrollLeft = (event) => {
  if (rightScrollContainer.value) {
    rightScrollContainer.value.scrollTop = event.target.scrollTop
  }
}

const syncScrollRight = (event) => {
  if (leftScrollContainer.value) {
    leftScrollContainer.value.scrollTop = event.target.scrollTop
  }
  // Sync horizontal scroll with ruler
  if (rulerContainer.value) {
    rulerContainer.value.scrollLeft = event.target.scrollLeft
  }
}

// Property tracks configuration
const propertyTracks = [
  { prop: 'position', label: 'Position', axis: ['x', 'y', 'z'], color: '#e74c3c' },
  { prop: 'rotation', label: 'Rotation', axis: ['x', 'y', 'z'], color: '#3498db' },
  { prop: 'scale', label: 'Scale', axis: ['x', 'y', 'z'], color: '#2ecc71' }
]

// Animation playback state
let playbackAnimationFrame = null
const framerate = 30 // 30 fps
const frameTime = 1000 / framerate // milliseconds per frame
let playbackStartTime = 0
let playbackStartFrame = 0

const play = () => {
  isPlaying.value = !isPlaying.value
  
  if (isPlaying.value) {
    // Start playback loop using requestAnimationFrame for smooth interpolation
    playbackStartTime = performance.now()
    playbackStartFrame = currentFrame.value
    
    const animate = (currentTime) => {
      if (!isPlaying.value) return
      
      const elapsed = currentTime - playbackStartTime
      const frameProgress = (elapsed / frameTime) + playbackStartFrame
      
      // Use fractional frame for smooth interpolation
      currentFrame.value = frameProgress
      
      // Loop back to start if we reach the end
      if (currentFrame.value > totalFrames.value) {
        playbackStartTime = currentTime
        playbackStartFrame = 0
        currentFrame.value = 0
      }
      
      playbackAnimationFrame = requestAnimationFrame(animate)
    }
    
    playbackAnimationFrame = requestAnimationFrame(animate)
  } else {
    // Stop playback
    if (playbackAnimationFrame) {
      cancelAnimationFrame(playbackAnimationFrame)
      playbackAnimationFrame = null
    }
    // Round to nearest frame when stopping
    currentFrame.value = Math.round(currentFrame.value)
  }
}

const stop = () => {
  isPlaying.value = false
  if (playbackAnimationFrame) {
    cancelAnimationFrame(playbackAnimationFrame)
    playbackAnimationFrame = null
  }
  currentFrame.value = 0
}

const goToStart = () => {
  currentFrame.value = 0
}

const goToEnd = () => {
  currentFrame.value = totalFrames.value
}

const toggleObjectExpand = (objId) => {
  expandedObjects.value[objId] = !expandedObjects.value[objId]
}

const isObjectExpanded = (objId) => {
  return expandedObjects.value[objId] || false
}

// Toggle property axes expansion (show/hide individual x,y,z)
const togglePropertyAxes = (objId, property) => {
  const key = `${objId}-${property}`
  expandedPropertyAxes.value[key] = !expandedPropertyAxes.value[key]
}

const arePropertyAxesExpanded = (objId, property) => {
  const key = `${objId}-${property}`
  return expandedPropertyAxes.value[key] || false
}

// Initialize keyframe structure if it doesn't exist
const ensureKeyframeStructure = (obj) => {
  if (!obj.keyframes) {
    obj.keyframes = {
      position: { x: [], y: [], z: [] },
      rotation: { x: [], y: [], z: [] },
      scale: { x: [], y: [], z: [] }
    }
  }
  if (!obj.keyframeValues) {
    obj.keyframeValues = {
      position: { x: {}, y: {}, z: {} },
      rotation: { x: {}, y: {}, z: {} },
      scale: { x: {}, y: {}, z: {} }
    }
  }
}

// Add keyframe for a specific property and axis
const addKeyframe = (obj, property, axis, frame) => {
  ensureKeyframeStructure(obj)
  
  if (!obj.keyframes[property][axis].includes(frame)) {
    obj.keyframes[property][axis].push(frame)
    obj.keyframes[property][axis].sort((a, b) => a - b)
    
    // Store the current value for this keyframe
    obj.keyframeValues[property][axis][frame] = obj[property][axis]
  }
}

// Remove keyframe
const removeKeyframe = (obj, property, axis, frame) => {
  if (obj.keyframes?.[property]?.[axis]) {
    const index = obj.keyframes[property][axis].indexOf(frame)
    if (index > -1) {
      obj.keyframes[property][axis].splice(index, 1)
      // Remove stored value
      if (obj.keyframeValues?.[property]?.[axis]?.[frame] !== undefined) {
        delete obj.keyframeValues[property][axis][frame]
      }
    }
  }
}

// Add keyframe at current frame for selected property/axis
const addKeyframeAtCurrentFrame = (obj, property, axis) => {
  addKeyframe(obj, property, axis, currentFrame.value)
}

// Check if keyframe exists at frame
const hasKeyframe = (obj, property, axis, frame) => {
  return obj.keyframes?.[property]?.[axis]?.includes(frame) || false
}

// Get all keyframes for a property/axis
const getKeyframes = (obj, property, axis) => {
  return obj.keyframes?.[property]?.[axis] || []
}

// Start dragging a keyframe
const startKeyframeDrag = (obj, property, axis, frame, event) => {
  event.preventDefault()
  event.stopPropagation()
  
  isDraggingKeyframe.value = true
  draggingKeyframe.value = {
    obj,
    property,
    axis,
    originalFrame: frame,
    startX: event.clientX
  }
  
  // If this keyframe is selected and we have multiple selections, drag them all
  const isSelected = isKeyframeSelected(obj, property, axis, frame)
  if (isSelected && selectedKeyframes.value.length > 1) {
    // Drag all selected keyframes
    draggingKeyframes.value = selectedKeyframes.value.map(kf => ({
      obj: kf.obj,
      property: kf.property,
      axis: kf.axis,
      originalFrame: kf.frame
    }))
  } else {
    // Drag only this keyframe
    draggingKeyframes.value = [{
      obj,
      property,
      axis,
      originalFrame: frame
    }]
  }
}

// Handle keyframe dragging
const handleKeyframeDragMove = (event) => {
  if (!isDraggingKeyframe.value || !draggingKeyframe.value) return
  
  const timeline = rightScrollContainer.value
  if (!timeline) return
  
  const rect = timeline.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  const newFrame = Math.round((x / rect.width) * totalFrames.value)
  
  const { originalFrame } = draggingKeyframe.value
  const frameDelta = newFrame - originalFrame
  
  // If no movement, return
  if (frameDelta === 0) return
  
  // Check if all moves are valid (no collisions)
  let allMovesValid = true
  const movesToMake = []
  
  for (const kf of draggingKeyframes.value) {
    const targetFrame = kf.originalFrame + frameDelta
    
    // Check bounds
    if (targetFrame < 0 || targetFrame > totalFrames.value) {
      allMovesValid = false
      break
    }
    
    const frameList = kf.obj.keyframes[kf.property][kf.axis]
    
    // Check if target frame is occupied by a non-dragging keyframe
    const targetFrameExists = frameList.includes(targetFrame) &&
      !draggingKeyframes.value.some(dkf =>
        dkf.obj === kf.obj &&
        dkf.property === kf.property &&
        dkf.axis === kf.axis &&
        dkf.originalFrame === targetFrame
      )
    
    if (targetFrameExists) {
      allMovesValid = false
      break
    }
    
    movesToMake.push({
      obj: kf.obj,
      property: kf.property,
      axis: kf.axis,
      originalFrame: kf.originalFrame,
      targetFrame: targetFrame
    })
  }
  
  // If all moves are valid, execute them
  if (allMovesValid && movesToMake.length > 0) {
    // Remove all keyframes from old positions first
    for (const move of movesToMake) {
      const frameList = move.obj.keyframes[move.property][move.axis]
      const index = frameList.indexOf(move.originalFrame)
      if (index > -1) {
        frameList.splice(index, 1)
      }
    }
    
    // Add all keyframes at new positions
    for (const move of movesToMake) {
      const frameList = move.obj.keyframes[move.property][move.axis]
      const value = move.obj.keyframeValues[move.property][move.axis][move.originalFrame]
      
      delete move.obj.keyframeValues[move.property][move.axis][move.originalFrame]
      
      frameList.push(move.targetFrame)
      frameList.sort((a, b) => a - b)
      move.obj.keyframeValues[move.property][move.axis][move.targetFrame] = value
    }
    
    // Update drag state
    draggingKeyframe.value.originalFrame = newFrame
    
    // Update all dragging keyframes' original frames
    for (let i = 0; i < draggingKeyframes.value.length; i++) {
      draggingKeyframes.value[i].originalFrame = movesToMake[i].targetFrame
    }
    
    // Update selection
    for (let i = 0; i < selectedKeyframes.value.length; i++) {
      const selected = selectedKeyframes.value[i]
      const move = movesToMake.find(m =>
        m.obj === selected.obj &&
        m.property === selected.property &&
        m.axis === selected.axis &&
        m.originalFrame === selected.frame
      )
      if (move) {
        selectedKeyframes.value[i].frame = move.targetFrame
      }
    }
  }
}

// Stop dragging keyframe
const stopKeyframeDrag = () => {
  isDraggingKeyframe.value = false
  draggingKeyframe.value = null
  draggingKeyframes.value = []
}

// Select a keyframe (support shift for multi-select)
const selectKeyframe = (obj, property, axis, frame, event) => {
  // Don't select if we just finished dragging
  if (isDraggingKeyframe.value) {
    return
  }
  
  const keyframeData = { obj, property, axis, frame }
  
  if (event?.shiftKey) {
    // Multi-select with shift
    const index = selectedKeyframes.value.findIndex(
      kf => kf.obj === obj && kf.property === property && kf.axis === axis && kf.frame === frame
    )
    if (index > -1) {
      // Deselect if already selected
      selectedKeyframes.value.splice(index, 1)
    } else {
      // Add to selection
      selectedKeyframes.value.push(keyframeData)
    }
  } else {
    // Single select
    selectedKeyframes.value = [keyframeData]
    // Jump to the keyframe's frame
    currentFrame.value = frame
  }
}

// Check if keyframe is selected
const isKeyframeSelected = (obj, property, axis, frame) => {
  return selectedKeyframes.value.some(
    kf => kf.obj === obj && kf.property === property && kf.axis === axis && kf.frame === frame
  )
}

// Delete selected keyframes
const deleteSelectedKeyframes = () => {
  if (selectedKeyframes.value.length > 0) {
    selectedKeyframes.value.forEach(({ obj, property, axis, frame }) => {
      removeKeyframe(obj, property, axis, frame)
    })
    selectedKeyframes.value = []
  }
}

// Start drag selection
const startDragSelect = (event) => {
  // Only start drag selection with Alt+Click or middle mouse button
  if (!event.altKey && event.button !== 1) return
  
  event.preventDefault()
  event.stopPropagation()
  
  const rect = rightScrollContainer.value.getBoundingClientRect()
  dragSelectStart.value = {
    x: event.clientX - rect.left + rightScrollContainer.value.scrollLeft,
    y: event.clientY - rect.top + rightScrollContainer.value.scrollTop
  }
  dragSelectCurrent.value = { ...dragSelectStart.value }
  isDragSelecting.value = true
  
  // Clear previous selection if not holding shift
  if (!event.shiftKey) {
    selectedKeyframes.value = []
  }
}

// Handle drag selection move
const handleDragSelectMove = (event) => {
  if (!isDragSelecting.value) return
  
  const rect = rightScrollContainer.value.getBoundingClientRect()
  dragSelectCurrent.value = {
    x: event.clientX - rect.left + rightScrollContainer.value.scrollLeft,
    y: event.clientY - rect.top + rightScrollContainer.value.scrollTop
  }
  
  // Update selection based on current rectangle
  updateDragSelection()
}

// Stop drag selection
const stopDragSelect = () => {
  isDragSelecting.value = false
  dragSelectStart.value = { x: 0, y: 0 }
  dragSelectCurrent.value = { x: 0, y: 0 }
}

// Calculate selection rectangle bounds
const getDragSelectBounds = () => {
  const minX = Math.min(dragSelectStart.value.x, dragSelectCurrent.value.x)
  const maxX = Math.max(dragSelectStart.value.x, dragSelectCurrent.value.x)
  const minY = Math.min(dragSelectStart.value.y, dragSelectCurrent.value.y)
  const maxY = Math.max(dragSelectStart.value.y, dragSelectCurrent.value.y)
  
  return { minX, maxX, minY, maxY }
}

// Update selection based on drag rectangle
const updateDragSelection = () => {
  const bounds = getDragSelectBounds()
  const timelineWidth = rightScrollContainer.value.scrollWidth
  
  // Calculate which frames are in the selection
  const minFrame = Math.floor((bounds.minX / timelineWidth) * totalFrames.value)
  const maxFrame = Math.ceil((bounds.maxX / timelineWidth) * totalFrames.value)
  
  // Calculate visible y positions for each track
  let currentY = 0
  selectedKeyframes.value = []
  
  sceneObjects.value.forEach(obj => {
    // Object header row (32px)
    currentY += 32
    
    if (isObjectExpanded(obj.id)) {
      propertyTracks.forEach(track => {
        // Property header row (24px)
        currentY += 24
        
        // Only process individual axis tracks if expanded
        if (arePropertyAxesExpanded(obj.id, track.prop)) {
          // Each axis track (24px each)
          track.axis.forEach(axis => {
            const trackStartY = currentY
            const trackEndY = currentY + 24
            
            // Check if this track intersects with selection
            if (trackStartY < bounds.maxY && trackEndY > bounds.minY) {
              // Check each keyframe in this track
              const keyframes = getKeyframes(obj, track.prop, axis)
              keyframes.forEach(frame => {
                if (frame >= minFrame && frame <= maxFrame) {
                  // Check if not already selected
                  const alreadySelected = selectedKeyframes.value.some(
                    kf => kf.obj === obj && kf.property === track.prop && kf.axis === axis && kf.frame === frame
                  )
                  if (!alreadySelected) {
                    selectedKeyframes.value.push({ obj, property: track.prop, axis, frame })
                  }
                }
              })
            }
            
            currentY += 24
          })
        }
        
        // Combined XYZ track (24px) - only shown when collapsed
        if (!arePropertyAxesExpanded(obj.id, track.prop)) {
          currentY += 24
        }
      })
    }
  })
}

// Handle keyboard events
const handleKeyDown = (event) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedKeyframes.value.length > 0) {
      event.preventDefault()
      deleteSelectedKeyframes()
    }
  }
}

// Scrubbing state
const isScrubbing = ref(false)
const scrubbingElement = ref(null)

// Handle timeline click to move playhead
const handleTimelineClick = (event) => {
  const scrollContainer = event.currentTarget === rulerContainer.value ? rulerContainer.value : rightScrollContainer.value
  if (!scrollContainer) return
  
  const rect = scrollContainer.getBoundingClientRect()
  const x = event.clientX - rect.left + scrollContainer.scrollLeft
  const scrollWidth = scrollContainer.scrollWidth
  const percentage = Math.max(0, Math.min(1, x / scrollWidth))
  currentFrame.value = Math.round(percentage * totalFrames.value)
}

// Start scrubbing
const startScrubbing = (event) => {
  // Check if this is a drag selection initiation
  if (event.altKey || event.button === 1) {
    startDragSelect(event)
    return
  }
  
  isScrubbing.value = true
  scrubbingElement.value = event.currentTarget
  handleTimelineClick(event)
}

// Handle scrubbing move (window-level)
const handleWindowMouseMove = (event) => {
  // Handle drag selection
  if (isDragSelecting.value) {
    handleDragSelectMove(event)
    return
  }
  
  // Handle keyframe dragging
  if (isDraggingKeyframe.value) {
    handleKeyframeDragMove(event)
    return
  }
  
  // Handle timeline scrubbing
  if (isScrubbing.value && scrubbingElement.value) {
    const scrollContainer = scrubbingElement.value === rulerContainer.value ? rulerContainer.value : rightScrollContainer.value
    if (!scrollContainer) return
    
    const rect = scrollContainer.getBoundingClientRect()
    const x = event.clientX - rect.left + scrollContainer.scrollLeft
    const scrollWidth = scrollContainer.scrollWidth
    const percentage = Math.max(0, Math.min(1, x / scrollWidth))
    currentFrame.value = Math.round(percentage * totalFrames.value)
  }
}

// Stop scrubbing (window-level)
const handleWindowMouseUp = () => {
  // Handle drag selection end
  if (isDragSelecting.value) {
    stopDragSelect()
    return
  }
  
  // Handle keyframe drag end
  if (isDraggingKeyframe.value) {
    stopKeyframeDrag()
    return
  }
  
  // Handle timeline scrub end
  if (isScrubbing.value) {
    isScrubbing.value = false
    scrubbingElement.value = null
  }
}

// Handle wheel event for zooming
const handleWheel = (event) => {
  // Only zoom if Control key is pressed
  if (!event.ctrlKey) return
  
  event.preventDefault()
  
  // Determine zoom direction (negative deltaY = zoom in, positive = zoom out)
  const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1
  
  // Apply zoom
  const newZoom = zoomLevel.value * zoomDelta
  zoomLevel.value = Math.max(minZoom, Math.min(maxZoom, newZoom))
}

// Update object values based on current frame and keyframes
const updateObjectValues = () => {
  sceneObjects.value.forEach(obj => {
    if (!obj.keyframes || !obj.keyframeValues) return
    
    // For each property with keyframes, update the object's property
    propertyTracks.forEach(track => {
      track.axis.forEach(axis => {
        const keyframes = obj.keyframes[track.prop]?.[axis]
        const keyframeValues = obj.keyframeValues[track.prop]?.[axis]
        
        if (!keyframes || keyframes.length === 0) return
        
        // Find surrounding keyframes
        let prevFrame = null
        let nextFrame = null
        
        for (let i = 0; i < keyframes.length; i++) {
          if (keyframes[i] <= currentFrame.value) {
            prevFrame = keyframes[i]
          }
          if (keyframes[i] >= currentFrame.value && nextFrame === null) {
            nextFrame = keyframes[i]
          }
        }
        
        // If at exact keyframe, use that value
        if (prevFrame === currentFrame.value && keyframeValues[prevFrame] !== undefined) {
          obj[track.prop][axis] = keyframeValues[prevFrame]
        }
        // If between keyframes, interpolate
        else if (prevFrame !== null && nextFrame !== null && prevFrame !== nextFrame) {
          const prevValue = keyframeValues[prevFrame]
          const nextValue = keyframeValues[nextFrame]
          
          if (prevValue !== undefined && nextValue !== undefined) {
            // Linear interpolation
            const t = (currentFrame.value - prevFrame) / (nextFrame - prevFrame)
            obj[track.prop][axis] = prevValue + (nextValue - prevValue) * t
          }
        }
        // If before first keyframe or after last keyframe
        else if (prevFrame !== null && keyframeValues[prevFrame] !== undefined) {
          obj[track.prop][axis] = keyframeValues[prevFrame]
        }
      })
    })
  })
}

// Watch for frame changes and update values
watch(currentFrame, () => {
  updateObjectValues()
})

// Set up window-level mouse and keyboard events
onMounted(() => {
  window.addEventListener('mousemove', handleWindowMouseMove)
  window.addEventListener('mouseup', handleWindowMouseUp)
  window.addEventListener('keydown', handleKeyDown)
  
  // Add wheel event listener to the timeline for zooming
  if (rightScrollContainer.value) {
    rightScrollContainer.value.addEventListener('wheel', handleWheel, { passive: false })
  }
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleWindowMouseMove)
  window.removeEventListener('mouseup', handleWindowMouseUp)
  window.removeEventListener('keydown', handleKeyDown)
  
  // Remove wheel event listener
  if (rightScrollContainer.value) {
    rightScrollContainer.value.removeEventListener('wheel', handleWheel)
  }
  
  // Clean up playback animation frame
  if (playbackAnimationFrame) {
    cancelAnimationFrame(playbackAnimationFrame)
    playbackAnimationFrame = null
  }
})
</script>

<template>
  <div class="flex flex-col bg-[#252525] border border-[#2c2c2c] h-full">
    <div class="bg-[#2c2c2c] text-[#aaa] px-3 py-1 text-xs border-b border-[#1a1a1a]">
      <span>Timeline</span>
    </div>
    <div class="flex items-center gap-2 px-3 py-2 bg-[#2c2c2c] border-b border-[#1a1a1a]">
      <button @click="goToStart" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        <i class="bi bi-chevron-bar-left"></i>
      </button>
      <button @click="play" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        <i v-if="isPlaying" class="bi bi-pause"></i>
        <i v-else class="bi bi-play"></i>
      </button>
      <button @click="stop" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        <i class="bi bi-stop"></i>
      </button>
      <button @click="goToEnd" class="bg-[#3c3c3c] border border-[#4c4c4c] text-white px-3 py-1 cursor-pointer rounded text-sm hover:bg-[#4c4c4c] active:bg-[#2c2c2c]">
        <i class="bi bi-chevron-bar-right"></i>
      </button>
      <div class="flex items-center gap-2 ml-auto text-[#aaa] text-xs">
        <span>Frame:</span>
        <input type="number" v-model="currentFrame" min="0" :max="totalFrames"
          class="w-[60px] bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99]" />
        <span>/</span>
        <input type="number" v-model.number="totalFrames" min="1" max="10000"
          class="w-[60px] bg-[#1a1a1a] border border-[#3c3c3c] text-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-[#3c5a99]"
          title="Total frames" />
      </div>
    </div>
    
    <!-- Column Layout: Object Names + Keyframe Area -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left Column: Object Names -->
      <div class="w-[180px] bg-[#252525] border-r border-[#1a1a1a] flex-shrink-0 flex flex-col">
        <div class="h-8 bg-[#2c2c2c] border-b border-[#1a1a1a] flex items-center px-3 text-[#aaa] text-xs flex-shrink-0">
          Objects
        </div>
        <div ref="leftScrollContainer" @scroll="syncScrollLeft" class="flex-1 overflow-y-scroll overflow-x-hidden scrollbar-hidden">
          <!-- Only show selected object -->
          <template v-if="selectedObject">
            <!-- Object row -->
            <div
              class="h-8 flex items-center px-3 text-[#ccc] text-xs border-b border-[#1a1a1a] bg-[#3c5a99] text-white"
            >
              <button
                @click.stop="toggleObjectExpand(selectedObject.id)"
                class="w-4 h-4 flex items-center justify-center mr-1 hover:bg-[#4c4c4c] rounded"
              >
                <i :class="isObjectExpanded(selectedObject.id) ? 'bi bi-chevron-down' : 'bi bi-chevron-right'" class="text-[10px]"></i>
              </button>
              <i class="bi bi-cube text-[#888] mr-2 text-[10px]"></i>
              <span>{{ selectedObject.name }}</span>
            </div>
            
            <!-- Property tracks (when expanded) -->
            <template v-if="isObjectExpanded(selectedObject.id)">
              <div v-for="track in propertyTracks" :key="`${selectedObject.id}-${track.prop}`">
                <div
                  class="h-6 flex items-center pl-8 pr-3 text-[#999] text-[11px] border-b border-[#1a1a1a] bg-[#202020]"
                >
                  <button
                    @click.stop="togglePropertyAxes(selectedObject.id, track.prop)"
                    class="w-4 h-4 flex items-center justify-center mr-1 hover:bg-[#3c3c3c] rounded"
                    :title="arePropertyAxesExpanded(selectedObject.id, track.prop) ? 'Collapse to XYZ' : 'Expand to X, Y, Z'"
                  >
                    <i :class="arePropertyAxesExpanded(selectedObject.id, track.prop) ? 'bi bi-chevron-down' : 'bi bi-chevron-right'" class="text-[8px]"></i>
                  </button>
                  <span :style="{ color: track.color }">{{ track.label }}</span>
                </div>
                <!-- Individual axis tracks (only shown when expanded) -->
                <template v-if="arePropertyAxesExpanded(selectedObject.id, track.prop)">
                  <div
                    v-for="axis in track.axis"
                    :key="`${selectedObject.id}-${track.prop}-${axis}`"
                    class="h-6 flex items-center pl-12 pr-3 text-[#888] text-[10px] border-b border-[#1a1a1a] bg-[#1a1a1a] hover:bg-[#252525] cursor-pointer group"
                    @click.stop
                  >
                    <span class="uppercase">{{ axis }}</span>
                    <button
                      @click="addKeyframeAtCurrentFrame(selectedObject, track.prop, axis)"
                      class="ml-auto px-2 py-0.5 text-[9px] bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Add keyframe at current frame"
                    >
                      <i class="bi bi-plus-circle"></i>
                    </button>
                  </div>
                </template>
                <!-- Combined axis option (only shown when collapsed) -->
                <div
                  v-if="!arePropertyAxesExpanded(selectedObject.id, track.prop)"
                  class="h-6 flex items-center pl-12 pr-3 text-[#888] text-[10px] border-b border-[#1a1a1a] bg-[#1a1a1a] hover:bg-[#252525] cursor-pointer group"
                  @click.stop
                >
                  <span class="uppercase">XYZ</span>
                  <button
                    @click="['x', 'y', 'z'].forEach(a => addKeyframeAtCurrentFrame(selectedObject, track.prop, a))"
                    class="ml-auto px-2 py-0.5 text-[9px] bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Add keyframe for all axes"
                  >
                    <i class="bi bi-plus-circle"></i>
                  </button>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- Right Column: Keyframe Area -->
      <div class="flex-1 flex flex-col bg-[#1a1a1a] overflow-hidden">
        <!-- Timeline Ruler -->
        <div
          ref="rulerContainer"
          class="relative h-8 bg-[#2c2c2c] border-b border-[#1a1a1a] overflow-x-auto overflow-y-hidden cursor-pointer select-none"
          style="scrollbar-width: none;"
          @mousedown="startScrubbing"
        >
          <div class="relative h-full pointer-events-none" :style="{ width: `${zoomLevel * 100}%` }">
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
        </div>

        <!-- Keyframe Tracks -->
        <div
          ref="rightScrollContainer"
          @scroll="syncScrollRight"
          @mousedown="startScrubbing"
          class="relative flex-1 bg-[#1a1a1a] overflow-auto cursor-pointer select-none"
          style="position: relative;"
        >
          <div :style="{ width: `${zoomLevel * 100}%`, position: 'relative', minHeight: '100%' }">
          <!-- Drag Selection Rectangle -->
          <div
            v-if="isDragSelecting"
            class="absolute pointer-events-none z-50"
            :style="{
              left: Math.min(dragSelectStart.x, dragSelectCurrent.x) + 'px',
              top: Math.min(dragSelectStart.y, dragSelectCurrent.y) + 'px',
              width: Math.abs(dragSelectCurrent.x - dragSelectStart.x) + 'px',
              height: Math.abs(dragSelectCurrent.y - dragSelectStart.y) + 'px',
              border: '1px dashed #3c5a99',
              backgroundColor: 'rgba(60, 90, 153, 0.15)'
            }"
          ></div>
          <!-- Only show selected object -->
          <template v-if="selectedObject">
            <!-- Object row track -->
            <div class="relative h-8 border-b border-[#1a1a1a] bg-[#2a2a2a]"></div>
            
            <!-- Property tracks (when expanded) -->
            <template v-if="isObjectExpanded(selectedObject.id)">
              <div v-for="track in propertyTracks" :key="`${selectedObject.id}-${track.prop}-track`">
                <!-- Property header row -->
                <div class="relative h-6 border-b border-[#1a1a1a] bg-[#202020]"></div>
                
                <!-- Individual axis tracks (only shown when expanded) -->
                <template v-if="arePropertyAxesExpanded(selectedObject.id, track.prop)">
                  <div
                    v-for="axis in track.axis"
                    :key="`${selectedObject.id}-${track.prop}-${axis}-track`"
                    class="relative h-6 border-b border-[#1a1a1a] bg-[#1a1a1a]"
                  >
                    <!-- Keyframe markers -->
                    <i
                      v-for="(keyframe, idx) in getKeyframes(selectedObject, track.prop, axis)"
                      :key="idx"
                      :class="[
                        'bi',
                        isKeyframeSelected(selectedObject, track.prop, axis, keyframe) ? 'bi-diamond' : 'bi-diamond-fill',
                        'keyframe-marker absolute top-1/2 -translate-y-1/2 cursor-pointer transition-transform'
                      ]"
                      :style="{
                        left: `${(keyframe / totalFrames) * 100}%`,
                        marginLeft: '-6px',
                        color: track.color,
                        fontSize: '12px'
                      }"
                      :title="`${track.label}.${axis.toUpperCase()} @ Frame ${keyframe} - Drag to move, Click to select, Shift+Click to multi-select, Delete to remove`"
                      @mousedown.stop="(e) => { if (e.button === 0) startKeyframeDrag(selectedObject, track.prop, axis, keyframe, e) }"
                      @click.stop="(e) => selectKeyframe(selectedObject, track.prop, axis, keyframe, e)"
                    ></i>
                  </div>
                </template>
                
                <!-- Combined axis track (only shown when collapsed) -->
                <div v-if="!arePropertyAxesExpanded(selectedObject.id, track.prop)" class="relative h-6 border-b border-[#1a1a1a] bg-[#1a1a1a]">
                  <!-- Show keyframes when ANY axis has a keyframe -->
                  <template v-if="selectedObject.keyframes?.[track.prop]">
                    <i
                      v-for="frame in [...new Set([
                        ...getKeyframes(selectedObject, track.prop, 'x'),
                        ...getKeyframes(selectedObject, track.prop, 'y'),
                        ...getKeyframes(selectedObject, track.prop, 'z')
                      ])]"
                      :key="frame"
                      :class="[
                        'bi',
                        (isKeyframeSelected(selectedObject, track.prop, 'x', frame) ||
                         isKeyframeSelected(selectedObject, track.prop, 'y', frame) ||
                         isKeyframeSelected(selectedObject, track.prop, 'z', frame)) ? 'bi-diamond' : 'bi-diamond-fill',
                        'keyframe-marker absolute top-1/2 -translate-y-1/2 cursor-pointer transition-transform'
                      ]"
                      :style="{
                        left: `${(frame / totalFrames) * 100}%`,
                        marginLeft: '-6px',
                        color: track.color,
                        fontSize: hasKeyframe(selectedObject, track.prop, 'x', frame) && hasKeyframe(selectedObject, track.prop, 'y', frame) && hasKeyframe(selectedObject, track.prop, 'z', frame) ? '14px' : '12px',
                        fontWeight: hasKeyframe(selectedObject, track.prop, 'x', frame) && hasKeyframe(selectedObject, track.prop, 'y', frame) && hasKeyframe(selectedObject, track.prop, 'z', frame) ? 'bold' : 'normal'
                      }"
                      :title="`${track.label} @ Frame ${frame} - ${[
                        hasKeyframe(selectedObject, track.prop, 'x', frame) ? 'X' : null,
                        hasKeyframe(selectedObject, track.prop, 'y', frame) ? 'Y' : null,
                        hasKeyframe(selectedObject, track.prop, 'z', frame) ? 'Z' : null
                      ].filter(Boolean).join(', ')}`"
                      @mousedown.stop="(e) => { if (e.button === 0) { const firstAxis = hasKeyframe(selectedObject, track.prop, 'x', frame) ? 'x' : hasKeyframe(selectedObject, track.prop, 'y', frame) ? 'y' : 'z'; startKeyframeDrag(selectedObject, track.prop, firstAxis, frame, e) } }"
                      @click.stop="(e) => { const firstAxis = hasKeyframe(selectedObject, track.prop, 'x', frame) ? 'x' : hasKeyframe(selectedObject, track.prop, 'y', frame) ? 'y' : 'z'; selectKeyframe(selectedObject, track.prop, firstAxis, frame, e) }"
                    ></i>
                  </template>
                </div>
              </div>
            </template>
          </template>

            <!-- Playhead -->
            <div class="absolute top-0 h-full pointer-events-none" :style="{ left: `${(currentFrame / totalFrames) * 100}%` }">
              <div class="w-0.5 h-full bg-[#ff4444] shadow-[0_0_4px_rgba(255,68,68,0.5)]"></div>
            </div>
          </div>
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

/* Hide scrollbar for ruler */
div[ref="rulerContainer"]::-webkit-scrollbar {
  display: none;
}

.scrollbar-hidden::-webkit-scrollbar {
  display: none;
}

.scrollbar-hidden {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Keyframe marker hover effect */
.keyframe-marker.bi-diamond-fill:hover::before {
  content: "\f3bf"; /* bi-diamond outline */
}

.keyframe-marker.bi-diamond-fill:hover {
  font-family: 'bootstrap-icons';
}
</style>
