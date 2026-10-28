<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { useAuth } from '../stores/auth'
import { useTask } from '../composables/useTask'
import { confirmAction } from '../utils/confirm'
import { money, dateTime } from '../utils/format'
import type { Refund } from '../types/api'
import PageHeading from '../components/PageHeading.vue'
import ErrorNotice from '../components/ErrorNotice.vue'
const id = String(useRoute().params.id)
const auth = useAuth()
const task = useTask()
const write = useTask()
const refund = ref<Refund | null>(null)
const seller = ref('')
const canReview = computed(() => auth.isAdmin || auth.user?.id === seller.value)
const listPath = computed(() =>
  auth.isAdmin ? '/admin/refunds' : auth.user?.id === seller.value ? '/seller/refunds' : '/refunds'
)
const labels: Record<string, string> = {
  REQUESTED: '等待审核',
  APPROVED: '已批准，等待处理结果',
  FAILED: '退款失败，可重试',
  SUCCEEDED: '退款成功',
  REJECTED: '申请已拒绝',
}
async function load() {
  await task.run(async () => {
    refund.value = await api.refund(id)
    seller.value = (await api.order(refund.value.orderId)).order.owner
  })
}
async function action(name: string) {
  if (
    !(await confirmAction(
      name === 'approve'
        ? '批准后将执行全额模拟退款。确认批准？'
        : name === 'retry'
          ? '将重试同一笔模拟退款，确认继续？'
          : '拒绝后本版不支持再次申请，确认拒绝？'
    ))
  )
    return
  await write.run(async () => {
    refund.value = await api.refundAction(id, name)
  })
}
onMounted(load)
</script>
<template>
  <PageHeading
    title="售后申请详情"
    description="全额售后，每一笔处理都有独立记录。"
    eyebrow="AFTER-SALES"
    ><RouterLink :to="listPath"><el-button>返回售后列表</el-button></RouterLink
    ><el-button :loading="task.busy.value" @click="load">刷新进度</el-button></PageHeading
  ><ErrorNotice :message="task.error.value" @retry="load" /><ErrorNotice
    :message="write.error.value"
  />
  <section v-if="refund" class="panel form-width">
    <span class="badge">{{ labels[refund.status] || refund.status }}</span>
    <h2 style="margin-top: 22px">全额退款 ¥{{ money(refund.amount) }}</h2>
    <p class="muted small">售后编号 {{ refund.id }}</p>
    <el-descriptions :column="1"
      ><el-descriptions-item label="关联订单"
        ><RouterLink :to="`/orders/${refund.orderId}`">{{
          refund.orderId
        }}</RouterLink></el-descriptions-item
      ><el-descriptions-item label="申请原因">{{ refund.reason }}</el-descriptions-item
      ><el-descriptions-item label="处理尝试次数">{{ refund.attempts }}</el-descriptions-item
      ><el-descriptions-item label="更新时间">{{
        dateTime(refund.updateTime)
      }}</el-descriptions-item></el-descriptions
    >
    <div class="inline-actions" style="margin-top: 22px">
      <template v-if="canReview && refund.status === 'REQUESTED'"
        ><el-button type="primary" :loading="write.busy.value" @click="action('approve')"
          >批准退款</el-button
        ><el-button :loading="write.busy.value" @click="action('reject')"
          >拒绝申请</el-button
        ></template
      ><el-button
        v-if="canReview && refund.status === 'FAILED'"
        type="primary"
        :loading="write.busy.value"
        @click="action('retry')"
        >重试这笔退款</el-button
      ><RouterLink :to="`/orders/${refund.orderId}`"><el-button>查看订单</el-button></RouterLink>
    </div>
    <p class="plain-note" style="margin-top: 24px">
      可从“我的售后”或“售后管理”再次查看本申请。仅“退款成功”表示处理完成；当前均为模拟资金流程。
    </p>
  </section>
</template>
