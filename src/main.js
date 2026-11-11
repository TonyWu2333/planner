import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { initStore } from './lib/store.js';

initStore().then(() => createApp(App).mount('#app'));
