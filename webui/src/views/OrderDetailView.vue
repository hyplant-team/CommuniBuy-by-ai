<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { useAuth } from '../stores/auth'
import { useTask } from '../composables/useTask'
import { useClock } from '../composables/useClock'
import { confirmAction } from '../utils/confirm'
import { money, dateTime, orderLabels, refundLabels, requireText } from '../utils/format'
import { numericId } from '../utils/json'
import { orderPermissions } from '../utils/permissions'
import type { DetailedOrder, Refund } from '../types/api'
import PageHeading from '../components/PageHeading.vue'
import ErrorNotice from '../components/ErrorNotice.vue'
import OrderLines from '../components/OrderLines.vue'
const route = useRoute()
const router = useRouter()
const auth = useAuth()
const now = useClock()
const id = String(route.params.id)
const task = useTask()
const refundTask = useTask()
const write = useTask()
const detail = ref<DetailedOrder | null>(null)
const existingRefund = ref<Refund | null>(null)
const refundKnown = ref(false)
const address = ref('')
const reason = ref('')
const reviewItem = ref('')
const rating = ref(5)
const comment = ref('')
const ordersPath = computed(() =>
  auth.isAdmin
    ? '/admin/orders'
    : detail.value?.order.owner === auth.user?.id
      ? '/seller/orders'
      : '/orders'
)
const refundsPath = computed(() =>
  auth.isAdmin
    ? '/admin/refunds'
    : detail.value?.order.owner === auth.user?.id
      ? '/seller/refunds'
      : '/refunds'
)
const permissions = computed(() =>
  detail.value ? orderPermissions(detail.value.order, auth.user!, now.value) : null
)
const remaining = computed(() =>
  detail.value ? Math.max(0, detail.value.order.expiresAt - now.value) : 0
)
async function load() {
  await task.run(async () => {
    numericId(id)
    detail.value = await api.order(id)
    address.value = detail.value.order.address || ''
    reviewItem.value ||= detail.value.lines[0]?.itemId || ''
    await loadRefund()
  })
}
async function loadRefund() {
  refundKnown.value = false
  await refundTask.run(async () => {
    existingRefund.value = await api.orderRefund(id)
    refundKnown.value = true
  })
}
async function action(name: string) {
  if (
    !(await confirmAction(
      name === 'cancel'
        ? detail.value?.order.status === 1
          ? '确认取消订单并全额模拟退款？退款结果以服务端状态为准。'
          : '确认取消这笔订单？'
        : name === 'receive'
          ? '请确认已收到商品。确认后订单将完成。'
          : '确认本订单已发货？'
    ))
  )
    return
  await write.run(async () => {
    const result = await api.orderAction(id, name)
    await load()
    const target = { cancel: -1, receive: 3, ship: 2 }[name]
    if (result.status !== target)
      throw new Error('操作尚未达到目标状态，请核对退款/订单最新状态后再处理')
  }, '订单状态已更新')
}
async function pay() {
  await write.run(async () => {
    const payment = await api.startPayment(numericId(id))
    await router.push(`/payments/${payment.id}`)
  })
}
async function saveAddress() {
  await write.run(async () => {
    requireText(address.value, '收货地址', 255, false)
    await api.address(id, address.value)
    await load()
  }, '本订单地址已更新')
}
async function refund() {
  await write.run(async () => {
    requireText(reason.value, '售后原因', 255, false)
    const result = await api.requestRefund(id, reason.value)
    await router.push(`/refunds/${result.id}`)
  })
}
async function review() {
  await write.run(async () => {
    requireText(comment.value, '评价', 1000)
    await api.review(id, {
      itemId: numericId(reviewItem.value),
      rating: rating.value,
      comment: comment.value,
    })
    comment.value = ''
  }, '评价已提交，每笔订单的同一商品只能评价一次')
}
onMounted(load)
</script>
<template>
  <RouterLink :to="ordersPath" class="back-link">← 返回订单</RouterLink
  ><PageHeading :title="`订单 ${id}`" description="订单中的商品信息与金额以成交快照为准。"
    ><el-button :loading="task.busy.value" @click="load">刷新状态</el-button></PageHeading
  ><ErrorNotice :message="task.error.value" @retry="load" /><ErrorNotice
    :message="write.error.value"
  /><el-skeleton v-if="task.busy.value && !detail" class="panel" :rows="6" animated /><template
    v-if="detail && permissions"
    ><div class="split-layout">
      <div>
        <section class="panel">
          <div class="summary-row">
            <h2>订单明细</h2>
            <el-tag effect="plain" :type="detail.order.status === -1 ? 'info' : 'success'">{{
              orderLabels[detail.order.status]
            }}</el-tag>
          </div>
          <OrderLines :lines="detail.lines" />
          <div class="summary-row total">
            <span>订单总额</span
            ><strong class="price"><small>¥</small>{{ money(detail.order.total) }}</strong>
          </div>
          <div v-if="BigInt(detail.order.refundedTotal) > 0n" class="summary-row">
            <span>已退款</span><strong>¥{{ money(detail.order.refundedTotal) }}</strong>
          </div>
        </section>
        <section class="panel">
          <h2>履约信息</h2>
          <p class="muted small">
            买家：{{ detail.order.user }} · 发起人：{{ detail.order.owner }}
          </p>
          <p class="body-text">{{ detail.order.address || '支付后发起人可查看履约地址' }}</p>
          <el-form v-if="permissions.address" label-position="top" @submit.prevent="saveAddress"
            ><el-form-item label="修改本订单收货地址"
              ><el-input
                v-model="address"
                :maxlength="255"
                type="textarea"
                :rows="2" /></el-form-item
            ><el-button native-type="submit" :loading="write.busy.value"
              >保存订单地址</el-button
            ></el-form
          >
        </section>
        <section v-if="permissions.review" class="panel">
          <h2>分享你的体验</h2>
          <p class="muted small">每笔订单的每种商品可以评价一次，售后处理中暂不可评价。</p>
          <el-form label-position="top" @submit.prevent="review"
            ><el-form-item label="选择商品"
              ><el-select v-model="reviewItem"
                ><el-option
                  v-for="line in detail.lines"
                  :key="line.itemId"
                  :label="line.itemName || `商品 ${line.itemId}`"
                  :value="line.itemId" /></el-select></el-form-item
            ><el-form-item label="评分"><el-rate v-model="rating" /></el-form-item
            ><el-form-item label="评价内容"
              ><el-input
                v-model="comment"
                type="textarea"
                :rows="3"
                :maxlength="1000" /></el-form-item
            ><el-button type="primary" native-type="submit" :loading="write.busy.value"
              >提交评价</el-button
            ></el-form
          >
        </section>
      </div>
      <div>
        <section class="panel">
          <h2>订单进度</h2>
          <el-timeline
            ><el-timeline-item :timestamp="dateTime(detail.order.createTime)" type="primary"
              >创建订单</el-timeline-item
            ><el-timeline-item
              v-if="detail.order.payTime"
              :timestamp="dateTime(detail.order.payTime)"
              type="primary"
              >已支付</el-timeline-item
            ><el-timeline-item
              v-if="detail.order.shipTime"
              :timestamp="dateTime(detail.order.shipTime)"
              type="primary"
              >已发货</el-timeline-item
            ><el-timeline-item
              v-if="detail.order.receiptTime"
              :timestamp="dateTime(detail.order.receiptTime)"
              type="primary"
              >已收货</el-timeline-item
            ><el-timeline-item
              v-if="detail.order.status === -1"
              :timestamp="dateTime(detail.order.closeTime)"
              >已关闭</el-timeline-item
            ></el-timeline
          >
          <p v-if="detail.order.status === 0" class="plain-note">
            {{
              remaining
                ? `剩余支付时间：${Math.floor(remaining / 60)} 分 ${remaining % 60} 秒`
                : '支付时间已到，请刷新查询最终状态'
            }}
          </p>
          <div class="inline-actions">
            <el-button
              v-if="permissions.pay"
              type="primary"
              :loading="write.busy.value"
              @click="pay"
              >前往模拟支付</el-button
            ><el-button
              v-if="permissions.ship"
              type="primary"
              :loading="write.busy.value"
              @click="action('ship')"
              >确认发货</el-button
            ><el-button
              v-if="permissions.receive"
              type="primary"
              :loading="write.busy.value"
              @click="action('receive')"
              >确认收货</el-button
            ><el-button
              v-if="permissions.cancel"
              :loading="write.busy.value"
              @click="action('cancel')"
              >取消订单</el-button
            >
          </div>
          <p class="muted small" style="margin: 18px 0 0">
            售后处理中可能暂不可发货或收货，请以最新处理结果为准。
          </p>
        </section>
        <section v-if="permissions.refund && refundKnown && !existingRefund" class="panel">
          <h2>申请全额售后</h2>
          <p class="muted small">每单仅支持一次全额申请；同一原因重试会返回原申请。</p>
          <el-input
            v-model="reason"
            type="textarea"
            :rows="3"
            :maxlength="255"
            placeholder="请填写售后原因"
          /><el-button style="margin-top: 15px" :loading="write.busy.value" @click="refund"
            >提交售后申请</el-button
          >
        </section>
        <section class="panel">
          <h3>订单售后</h3>
          <ErrorNotice :message="refundTask.error.value" @retry="loadRefund" />
          <p v-if="refundTask.busy.value" class="muted small">正在查询售后申请…</p>
          <template v-else-if="refundKnown && existingRefund">
            <el-tag effect="plain">{{
              refundLabels[existingRefund.status] || existingRefund.status
            }}</el-tag>
            <p class="body-text">{{ existingRefund.reason }}</p>
            <RouterLink :to="`/refunds/${existingRefund.id}`">
              <el-button type="primary">查看 / 处理售后</el-button>
            </RouterLink>
          </template>
          <p v-else-if="refundKnown" class="muted small">该订单暂未申请售后。</p>
          <p style="margin: 16px 0 0">
            <RouterLink :to="refundsPath">查看售后列表 →</RouterLink>
          </p>
        </section>
      </div>
    </div></template
  >
</template>
