<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShoppingBag, ShoppingCart, ArrowRight, User as UserIcon } from '@element-plus/icons-vue'
import { useAuth } from './stores/auth'
import { api } from './api'
import { useTask } from './composables/useTask'
import ErrorNotice from './components/ErrorNotice.vue'
import { confirmAction } from './utils/confirm'
const route = useRoute()
const router = useRouter()
const auth = useAuth()
const { busy, error, run } = useTask()
const isAuthPage = computed(() => ['/login', '/register'].includes(route.path))
async function logout() {
  const prefix = `communibuy.intent:${auth.user?.id}:`
  const pending = Array.from({ length: sessionStorage.length }, (_, index) =>
    sessionStorage.key(index)
  ).some((key) => key?.startsWith(prefix))
  if (
    pending &&
    !(await confirmAction(
      '存在待确认的购买或结算请求。退出将清理本机重试缓存，请重新登录后先核对订单。确认退出？'
    ))
  )
    return
  await run(async () => {
    let failed = false
    try {
      await api.logout()
    } catch {
      failed = true
    }
    auth.clear(true)
    await router.push('/login')
    if (failed) throw new Error('本机已退出，但服务端注销尚未确认。请稍后登录检查账号会话。')
  })
}
</script>

<template>
  <div class="app-shell">
    <div class="utility-bar">
      <span>CommuniBuy · 社区好物，邻居共享</span
      ><span>一起买，共享好生活 <span aria-hidden="true">↗</span></span>
    </div>
    <header class="site-header">
      <div class="header-inner">
        <RouterLink to="/" class="brand" aria-label="社区团购平台首页"
          ><span class="brand-icon"
            ><el-icon><ShoppingBag /></el-icon></span
          ><span
            >社区<span class="brand-light">团购平台</span><small>COMMUNIBUY</small></span
          ></RouterLink
        >
        <nav v-if="auth.user" class="main-nav" aria-label="主导航">
          <RouterLink to="/" :class="{ active: route.path === '/' }">发现团购</RouterLink>
          <RouterLink to="/orders" :class="{ active: route.path.startsWith('/orders') }"
            >我的订单</RouterLink
          >
          <RouterLink to="/refunds" :class="{ active: route.path.startsWith('/refunds') }"
            >我的售后</RouterLink
          >
          <RouterLink to="/seller/items" :class="{ active: route.path.startsWith('/seller') }"
            >团购工作台</RouterLink
          >
          <RouterLink
            v-if="auth.isAdmin"
            to="/admin"
            :class="{ active: route.path.startsWith('/admin') }"
            >管理后台</RouterLink
          >
        </nav>
        <div class="header-actions" v-if="auth.user">
          <RouterLink to="/cart" class="icon-link" aria-label="购物车"
            ><el-icon><ShoppingCart /></el-icon
          ></RouterLink>
          <RouterLink to="/profile" class="account-link"
            ><span class="avatar">{{ (auth.user.nickname || auth.user.id).slice(0, 1) }}</span
            ><span>{{ auth.user.nickname || auth.user.id }}</span></RouterLink
          >
          <el-button text :loading="busy" @click="logout">退出</el-button>
        </div>
        <span v-else class="header-caption"
          ><el-icon><UserIcon /></el-icon> 欢迎来到社区团购平台</span
        >
      </div>
    </header>
    <div v-if="auth.user && route.path.startsWith('/seller')" class="subnav">
      <RouterLink to="/seller/items">我发起的团购</RouterLink
      ><RouterLink to="/seller/orders">销售订单</RouterLink
      ><RouterLink to="/seller/refunds">售后管理</RouterLink
      ><RouterLink to="/settlements">内部结算</RouterLink>
    </div>
    <div v-if="auth.user && route.path.startsWith('/admin')" class="subnav">
      <RouterLink to="/admin">平台概览</RouterLink
      ><RouterLink to="/admin/users">用户管理</RouterLink
      ><RouterLink to="/admin/categories">分类管理</RouterLink
      ><RouterLink to="/admin/items">全部团购</RouterLink
      ><RouterLink to="/admin/orders">全部订单</RouterLink
      ><RouterLink to="/admin/refunds">全部售后</RouterLink
      ><RouterLink to="/admin/audit">操作审计</RouterLink>
    </div>
    <main :class="isAuthPage ? 'auth-main' : 'page-main'">
      <ErrorNotice :message="error" /><RouterView :key="route.path" />
    </main>
    <footer class="site-footer">
      <div><strong>社区团购平台</strong><span>社区好物，一起分享。</span></div>
      <span
        >CommuniBuy <el-icon><ArrowRight /></el-icon> 一起买好日常</span
      >
    </footer>
  </div>
</template>
