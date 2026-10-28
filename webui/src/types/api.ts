export type Id = string
export type Cents = string
export interface Envelope<T> {
  success: boolean
  code: string
  message: string
  data: T
  traceId: string
}
export interface Page<T> {
  content: T[]
  count: string
  page: number
  size: number
}
export interface User {
  id: string
  nickname: string | null
  description: string | null
  address: string | null
  role: -1 | 0 | 1
}
export interface Token {
  token: string
  tokenType: string
  expiresAt: number
}
export interface Category {
  id: Id
  name: string
}
export interface Item {
  id: Id
  name: string
  description: string | null
  price: Cents
  stock: number
  status: -1 | 0
  owner: string
  startTime: number
  endTime: number | null
  shipmentCount: number
  version: Id
  categoryId: Id | null
}
export interface ItemInput {
  name: string
  description: string
  price: number
  stock: number
  status: number
  startTime?: number
  endTime?: number
  version?: bigint
}
export interface Order {
  id: Id
  itemId: Id
  user: string
  owner: string
  quantity: number
  price: Cents
  total: Cents
  address: string | null
  status: -1 | 0 | 1 | 2 | 3
  createTime: number
  payTime: number | null
  shipTime: number | null
  receiptTime: number | null
  closeTime: number | null
  expiresAt: number
  refundStatus: string
  itemName: string | null
  itemDescription: string | null
  snapshotSource: string
  refundedTotal: Cents
}
export interface OrderLine {
  itemId: Id
  quantity: number
  price: Cents
  total: Cents
  itemName: string | null
  itemDescription: string | null
  snapshotSource: string
}
export interface DetailedOrder {
  order: Order
  lines: OrderLine[]
}
export interface CartLine {
  itemId: Id
  quantity: number
  selected: boolean
  name: string
  price: Cents
  stock: number
  status: number
  startTime: number
  endTime: number | null
}
export interface Cart {
  version: Id
  lines: CartLine[]
}
export interface Checkout {
  id: string
  total: Cents
  orders: DetailedOrder[]
}
export interface Payment {
  id: string
  orderId: Id
  amount: Cents
  merchant: string
  channel: string
  status: string
  providerReference: string | null
  createTime: number
  updateTime: number
}
export interface Refund {
  id: string
  orderId: Id
  paymentId: string
  amount: Cents
  reason: string
  status: string
  attempts: number
  providerReference: string | null
  createTime: number
  updateTime: number
}
export type RefundScope = 'seller' | 'buyer' | 'all'
export interface RefundEntry {
  id: string
  orderId: Id
  buyer: string
  seller: string
  amount: Cents
  reason: string
  status: string
  attempts: number
  createTime: number
  updateTime: number
}
export interface Settlement {
  id: string
  seller: string
  netAmount: Cents
  createTime: number
  entries: { id: Id; orderId: Id; refundId: string | null; kind: string; amount: Cents }[]
}
export interface Review {
  id: Id
  orderId: Id
  itemId: Id
  user: string
  rating: number
  comment: string
  createTime: number
}
export interface Audit {
  id: Id
  createTime: number
  traceId: string
  actorHash: string
  action: string
  resourceHash: string
  outcome: string
  httpStatus: number
}
export interface Stats {
  userCount: string
  itemCount: string
  orderCount: string
  ongoingItemCount: string
  totalRevenue: Cents
  grossPaidAmount: Cents
  refundAmount: Cents
  netPaidAmount: Cents
  unreconciledPaidOrderCount: string
}
