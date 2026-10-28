import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = createRouter({
  history:
    __SINGLE_FILE__ || import.meta.env.VITE_ROUTER_MODE === 'hash'
      ? createWebHashHistory()
      : createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/HomeView.vue'),
    },
    { path: '/login', component: () => import('../views/AuthView.vue'), meta: { public: true } },
    { path: '/register', component: () => import('../views/AuthView.vue'), meta: { public: true } },
    { path: '/items/:id', component: () => import('../views/ItemDetailView.vue') },
    { path: '/item/:id', redirect: (to) => `/items/${to.params.id}` },
    { path: '/seller/items', component: () => import('../views/ItemsManageView.vue') },
    { path: '/seller/items/new', component: () => import('../views/ItemEditView.vue') },
    { path: '/seller/items/:id/edit', component: () => import('../views/ItemEditView.vue') },
    { path: '/orders', component: () => import('../views/OrdersView.vue') },
    { path: '/seller/orders', component: () => import('../views/OrdersView.vue') },
    { path: '/orders/:id', component: () => import('../views/OrderDetailView.vue') },
    { path: '/cart', component: () => import('../views/CartView.vue') },
    { path: '/checkouts/:id', component: () => import('../views/CheckoutView.vue') },
    { path: '/payments/:id', component: () => import('../views/PaymentView.vue') },
    { path: '/refunds', component: () => import('../views/RefundsView.vue') },
    { path: '/seller/refunds', component: () => import('../views/RefundsView.vue') },
    {
      path: '/admin/refunds',
      component: () => import('../views/RefundsView.vue'),
      meta: { admin: true },
    },
    { path: '/refunds/:id', component: () => import('../views/RefundView.vue') },
    { path: '/settlements/:id?', component: () => import('../views/SettlementView.vue') },
    { path: '/profile', component: () => import('../views/ProfileView.vue') },
    {
      path: '/admin/:section?',
      component: () => import('../views/AdminView.vue'),
      meta: { admin: true },
    },
    { path: '/403', component: () => import('../views/StatusView.vue'), meta: { public: true } },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('../views/StatusView.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const auth = useAuth()
  try {
    await auth.restore()
  } catch {
    return { path: '/login', query: { return: to.fullPath, offline: '1' } }
  }
  if (!auth.user) return { path: '/login', query: { return: to.fullPath } }
  if (to.meta.admin && !auth.isAdmin) return '/403'
  return true
})

export default router
