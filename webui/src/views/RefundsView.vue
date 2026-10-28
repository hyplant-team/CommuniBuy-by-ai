<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { useTask } from '../composables/useTask'
import { dateTime, money, pageCount, refundLabels } from '../utils/format'
import { numericId } from '../utils/json'
import type { Page, RefundEntry, RefundScope } from '../types/api'
import ErrorNotice from '../components/ErrorNotice.vue'
import PageHeading from '../components/PageHeading.vue'

const route = useRoute()
const scope: RefundScope = route.path.startsWith('/admin')
  ? 'all'
  : route.path.startsWith('/seller')
    ? 'seller'
    : 'buyer'
const title = { buyer: '我的售后', seller: '售后管理', all: '全部售后' }[scope]
const ordersPath = { buyer: '/orders', seller: '/seller/orders', all: '/admin/orders' }[scope]
const task = useTask()
const orderId = ref(typeof route.query.orderId === 'string' ? route.query.orderId : '')
const status = ref(scope === 'buyer' || orderId.value ? '' : 'REQUESTED')
const page = ref(1)
const result = ref<Page<RefundEntry> | null>(null)

async function load() {
  await task.run(async () => {
    result.value = null
    const filter = orderId.value.trim()
    if (filter) numericId(filter)
    result.value = await api.refunds({
      scope,
      status: status.value || undefined,
      orderId: filter || undefined,
      page: page.value - 1,
      size: 20,
    })
  })
}
function search() {
  page.value = 1
  void load()
}
function statusType(value: string) {
  if (value === 'SUCCEEDED') return 'success'
  if (value === 'FAILED') return 'danger'
  if (value === 'REQUESTED' || value === 'APPROVED') return 'warning'
  return 'info'
}
onMounted(load)
</script>

<template>
  <PageHeading
    :title="title"
    :description="
      scope === 'buyer'
        ? '查看已提交的售后申请和处理进度。'
        : scope === 'seller'
          ? '查看销售订单的售后申请，进入详情审核和处理。'
          : '在管理员权限范围内查看平台售后记录。'
    "
    eyebrow="AFTER-SALES"
  >
    <RouterLink :to="ordersPath"><el-button>查看订单</el-button></RouterLink>
    <el-button type="primary" :loading="task.busy.value" @click="load">刷新售后</el-button>
  </PageHeading>
  <section class="panel">
    <form class="toolbar" @submit.prevent="search">
      <el-select
        v-model="status"
        aria-label="售后状态"
        placeholder="全部售后状态"
        clearable
        :disabled="task.busy.value"
        @change="search"
      >
        <el-option
          v-for="(label, value) in refundLabels"
          :key="value"
          :label="label"
          :value="value"
        />
      </el-select>
      <el-input
        v-model="orderId"
        aria-label="筛选订单编号"
        placeholder="按订单编号筛选"
        clearable
        :disabled="task.busy.value"
      />
      <el-button native-type="submit" :disabled="task.busy.value">查询售后</el-button>
    </form>
    <ErrorNotice :message="task.error.value" @retry="load" />
    <el-table :data="result?.content || []" v-loading="task.busy.value" row-key="id">
      <el-table-column label="售后 / 订单" min-width="245">
        <template #default="{ row }">
          <RouterLink :to="`/refunds/${row.id}`">售后 {{ row.id }}</RouterLink>
          <p class="small muted">
            <RouterLink :to="`/orders/${row.orderId}`">订单 {{ row.orderId }}</RouterLink>
          </p>
        </template>
      </el-table-column>
      <el-table-column v-if="scope !== 'buyer'" prop="buyer" label="买家" min-width="110" />
      <el-table-column v-if="scope !== 'seller'" prop="seller" label="卖家" min-width="110" />
      <el-table-column label="退款金额" min-width="140">
        <template #default="{ row }">¥{{ money(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="reason" label="申请原因" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="130">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" effect="plain">
            {{ refundLabels[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" min-width="175">
        <template #default="{ row }">{{ dateTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="140">
        <template #default="{ row }">
          <RouterLink :to="`/refunds/${row.id}`">
            {{ scope === 'buyer' ? '查看进度 →' : '查看 / 处理售后 →' }}
          </RouterLink>
        </template>
      </el-table-column>
      <template #empty>{{
        task.error.value
          ? '售后记录加载失败，请重试'
          : task.busy.value
            ? '正在加载售后记录…'
            : '暂无符合条件的售后申请'
      }}</template>
    </el-table>
    <div v-if="result" class="pagination">
      <el-pagination
        v-model:current-page="page"
        :total="pageCount(result.count)"
        :page-size="20"
        :disabled="task.busy.value"
        layout="total,prev,pager,next"
        @current-change="load"
      />
    </div>
    <p class="muted small">进入页面或刷新后获取最新申请与状态，当前不提供实时推送。</p>
  </section>
</template>
