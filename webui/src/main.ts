import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import router from './router'
import { createPinia } from 'pinia'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import './styles/main.css'
import { useAuth } from './stores/auth'

const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus, { locale: zhCn })
app.use(router)
window.addEventListener('communibuy:unauthorized', () => {
  useAuth().clear()
  const path = router.currentRoute.value.fullPath
  if (!router.currentRoute.value.meta.public)
    void router.replace({ path: '/login', query: { return: path, expired: '1' } })
})
void router
  .isReady()
  .then(() => {
    app.mount('#app')
    window.dispatchEvent(new Event('communibuy:ready'))
  })
  .catch(() => {
    window.dispatchEvent(new Event('communibuy:startup-error'))
  })
