import { request } from './http'
import type {
  Audit,
  Cart,
  Category,
  Checkout,
  DetailedOrder,
  Item,
  ItemInput,
  Order,
  Page,
  Payment,
  Refund,
  RefundEntry,
  Review,
  Settlement,
  Stats,
  Token,
  User,
} from '../types/api'
export const api = {
  login: (user: string, password: string) => request<Token>('POST', '/auth', { user, password }),
  register: (user: string, password: string) =>
    request<User>('POST', '/auth/register', { user, password }),
  me: () => request<User>('GET', '/auth'),
  logout: () => request<null>('POST', '/auth/logout'),
  reset: (oldPassword: string, newPassword: string) =>
    request<null>('POST', '/auth/reset', { oldPassword, newPassword }),
  profile: (id: string, data: object) =>
    request<User>('POST', `/user/${encodeURIComponent(id)}`, data),
  users: (params: object) => request<Page<string>>('GET', '/user', undefined, params),
  user: (id: string) => request<User>('GET', `/user/${encodeURIComponent(id)}`),
  createUser: (user: string, password: string) =>
    request<User>('POST', '/user', { user, password }),
  role: (id: string, role: number) =>
    request<User>('POST', `/user/${encodeURIComponent(id)}/role`, { role }),
  items: (params: object) => request<Page<Item>>('GET', '/item', undefined, params),
  item: (id: string) => request<Item>('GET', `/item/${id}`),
  createItem: (data: ItemInput) => request<Item>('POST', '/item', data),
  editItem: (id: string, data: Partial<ItemInput>) => request<Item>('POST', `/item/${id}`, data),
  categories: (params: object = { page: 0, size: 100 }) =>
    request<Page<Category>>('GET', '/categories', undefined, params),
  createCategory: (name: string) => request<Category>('POST', '/categories', { name }),
  assignCategory: (id: string, categoryId: bigint) =>
    request<Item>('PUT', `/item/${id}/category`, { categoryId }),
  orders: (params: object) => request<Page<Order>>('GET', '/order', undefined, params),
  order: (id: string) => request<DetailedOrder>('GET', `/order/${id}/details`),
  buy: (data: object, key: string) => request<Order>('POST', '/order', data, undefined, key),
  orderAction: (id: string, action: string) => request<Order>('POST', `/order/${id}/${action}`),
  address: (id: string, address: string) =>
    request<Order>('POST', `/order/${id}/address`, { address }),
  cart: () => request<Cart>('GET', '/cart'),
  cartChange: (id: string, quantity: number, selected: boolean) =>
    request<Cart>('PUT', `/cart/${id}`, { quantity, selected }),
  cartDelete: (id: string) => request<Cart>('DELETE', `/cart/${id}`),
  checkout: (data: object, key: string) =>
    request<Checkout>('POST', '/checkout', data, undefined, key),
  checkoutResult: (id: string) => request<Checkout>('GET', `/checkout/${id}`),
  startPayment: (orderId: bigint) => request<Payment>('POST', '/payments', { orderId }),
  payment: (id: string) => request<Payment>('GET', `/payments/${id}`),
  paymentAction: (id: string, action: 'simulate' | 'query') =>
    request<Payment>('POST', `/payments/${id}/${action}`),
  requestRefund: (id: string, reason: string) =>
    request<Refund>('POST', `/order/${id}/refunds`, { reason }),
  refund: (id: string) => request<Refund>('GET', `/refunds/${id}`),
  refunds: (params: object) => request<Page<RefundEntry>>('GET', '/refunds', undefined, params),
  orderRefund: (id: string) => request<Refund | null>('GET', `/order/${id}/refunds`),
  refundAction: (id: string, action: string) => request<Refund>('POST', `/refunds/${id}/${action}`),
  reviews: (id: string, page = 0) =>
    request<Page<Review>>('GET', `/item/${id}/reviews`, undefined, { page, size: 10 }),
  review: (id: string, data: object) => request<Review>('POST', `/order/${id}/reviews`, data),
  settle: (data: object, key: string) =>
    request<Settlement>('POST', '/settlements', data, undefined, key),
  settlement: (id: string) => request<Settlement>('GET', `/settlements/${id}`),
  stats: () => request<Stats>('GET', '/stats'),
  audit: (page = 0) => request<Page<Audit>>('GET', '/audit', undefined, { page, size: 20 }),
}
