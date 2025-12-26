import { inject } from 'vue'

export function useKeyframes() {
  const currentFrame = inject('currentFrame')
  
  // Initialize keyframe structure if it doesn't exist
  const ensureKeyframeStructure = (obj) => {
    if (!obj.keyframes) {
      obj.keyframes = {
        position: { x: [], y: [], z: [] },
        rotation: { x: [], y: [], z: [] },
        scale: { x: [], y: [], z: [] },
        opacity: []
      }
    }
    if (!obj.keyframeValues) {
      obj.keyframeValues = {
        position: { x: {}, y: {}, z: {} },
        rotation: { x: {}, y: {}, z: {} },
        scale: { x: {}, y: {}, z: {} },
        opacity: {}
      }
    }
  }
  
  // Add keyframe for a specific property and axis (or single-value property)
  const addKeyframe = (obj, property, axis, frame, value) => {
    ensureKeyframeStructure(obj)
    
    // Handle single-value properties (like opacity)
    if (axis === null || axis === undefined) {
      if (!obj.keyframes[property].includes(frame)) {
        obj.keyframes[property].push(frame)
        obj.keyframes[property].sort((a, b) => a - b)
      }
      obj.keyframeValues[property][frame] = value
    } else {
      // Handle multi-axis properties (like position, rotation, scale)
      if (!obj.keyframes[property][axis].includes(frame)) {
        obj.keyframes[property][axis].push(frame)
        obj.keyframes[property][axis].sort((a, b) => a - b)
      }
      obj.keyframeValues[property][axis][frame] = value
    }
  }
  
  // Add keyframe at current frame
  const addKeyframeAtCurrentFrame = (obj, property, axis) => {
    if (currentFrame && currentFrame.value !== undefined) {
      // Handle single-value properties (like opacity)
      if (axis === null || axis === undefined) {
        addKeyframe(obj, property, null, currentFrame.value, obj[property])
      } else {
        // Handle multi-axis properties
        addKeyframe(obj, property, axis, currentFrame.value, obj[property][axis])
      }
    }
  }
  
  return {
    addKeyframe,
    addKeyframeAtCurrentFrame
  }
}
