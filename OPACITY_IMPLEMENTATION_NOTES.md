# Opacity Property Implementation

## Changes Made

### 1. [`useKeyframes.js`](src/renderer/src/composables/useKeyframes.js)
- Added [`opacity`](src/renderer/src/composables/useKeyframes.js:14) to keyframe structure
- Modified [`addKeyframe()`](src/renderer/src/composables/useKeyframes.js:24) to handle single-value properties
- Modified [`addKeyframeAtCurrentFrame()`](src/renderer/src/composables/useKeyframes.js:42) to handle single-value properties

### 2. [`PropertiesPanel.vue`](src/renderer/src/components/PropertiesPanel.vue)
- Added [`opacity`](src/renderer/src/components/PropertiesPanel.vue:146) computed property (0-100% display, 0-1 internal)
- Added opacity input field in Material section

### 3. [`Viewport.vue`](src/renderer/src/components/Viewport.vue)
- Initialize [`opacity = 1`](src/renderer/src/components/Viewport.vue:405) when creating objects
- Set material [`transparent: true, opacity: obj.opacity`](src/renderer/src/components/Viewport.vue:410-411)
- Update material opacity in animation loop

### 4. [`Timeline.vue`](src/renderer/src/components/Timeline.vue)
- Added [`opacity`](src/renderer/src/components/Timeline.vue:63) to propertyTracks with color #f39c12
- Modified keyframe functions to handle single-value properties
- Added opacity tracks in template (left and right panels)
- Added opacity interpolation in [`updateObjectValues()`](src/renderer/src/components/Timeline.vue:656)

## Usage

1. Select an object in the viewport
2. In Properties Panel > Object > Material, adjust the Opacity slider (0-100%)
3. In Timeline, expand the object properties to see Opacity track
4. Click the "+" button on Opacity track to add keyframe at current frame
5. Move playhead and change opacity, then add another keyframe
6. Play animation to see opacity interpolation

## Note

The Timeline template still needs manual updating for the keyframe visualization. The right panel (keyframe area) should check `track.axis === null` similar to the left panel implementation.
