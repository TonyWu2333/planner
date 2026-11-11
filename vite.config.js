import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [vue()],
  // 页面里显示的版本号也来自 package.json（和安卓的 versionName 同源）
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
