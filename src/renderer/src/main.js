import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import PreviewWindow from './PreviewWindow.vue'

// Check if this is a preview window based on URL parameters
const urlParams = new URLSearchParams(window.location.search)
const isPreview = urlParams.get('preview') === 'true'

// Create and mount the appropriate component
const component = isPreview ? PreviewWindow : App
createApp(component).mount('#app')
