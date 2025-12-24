import { inject } from 'vue'

export function useKeyframes() {
  const currentFrame = inject('currentFrame')
  
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
  const addKeyframe = (obj, property, axis, frame, value) => {
    ensureKeyframeStructure(obj)
    
    if (!obj.keyframes[property][axis].includes(frame)) {
      obj.keyframes[property][axis].push(frame)
      obj.keyframes[property][axis].sort((a, b) => a - b)
    }
    
    // Store the value for this keyframe
    obj.keyframeValues[property][axis][frame] = value
  }
  
  // Add keyframe at current frame
  const addKeyframeAtCurrentFrame = (obj, property, axis) => {
    if (currentFrame && currentFrame.value !== undefined) {
      addKeyframe(obj, property, axis, currentFrame.value, obj[property][axis])
    }
  }
  
  return {
    addKeyframe,
    addKeyframeAtCurrentFrame
  }
}
