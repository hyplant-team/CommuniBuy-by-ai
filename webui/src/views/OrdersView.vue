<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { useAuth } from '../stores/auth'
import { useTask } from '../composables/useTask'
import { dateTime, money, orderLabels, pageCount } from '../utils/format'
import type { Order, Page } from '../types/api'
import ErrorNotice from '../components/ErrorNotice.vue'
import PageHeading from '../components/PageHeading.vue'
const route = useRoute()
const auth = useAuth()
const task = useTask()
const seller = computed(() => route.path.startsWith('/seller'))
const status = ref('')
const page = ref(1)
const result = ref<Page<Order> | null>(null)
async function load() {
  await task.run(async () => {
    result.value = await api.orders({
      [seller.value ? 'owner' : 'user']: auth.user!.id,
      page: page.value - 1,
      size: 10,
      status: status.value || undefined,
    })
  })
}
function search() {
  page.value = 1
  void load()
}
onMounted(load)
</script>
<template>
  <PageHeading
    :title="seller ? '我的销售订单' : '我的购买订单'"
    :description="
      seller ? '查看邻居的订单，及时安排履约。' : '从下单到收货，每一份好物都有迹可循。'
    "
    eyebrow="EVERY GOOD THING HAS A STORY"
    ><RouterLink :to="seller ? '/seller/refunds' : '/refunds'"
      ><el-button>{{ seller ? '售后管理' : '我的售后' }}</el-button></RouterLink
    ></PageHeading
  >
  <section class="panel">
    <div class="toolbar">
      <el-select
        v-model="status"
        placeholder="全部订单状态"
        clearable
        :disabled="task.busy.value"
        @change="search"
        ><el-option
          v-for="(label, value) in orderLabels"
          :key="value"
          :label="label"
          :value="value" /></el-select
      ><el-button :loading="task.busy.value" @click="load">刷新订单</el-button>
    </div>
    <ErrorNotice :message="task.error.value" @retry="load" /><el-table
      :data="result?.content || []"
      v-loading="task.busy.value"
      ><el-table-column label="订单 / 商品" min-width="240"
        ><template #default="{ row }"
          ><RouterLink :to="`/orders/${row.id}`">订单 {{ row.id }}</RouterLink>
          <p class="small muted">
            {{ row.itemName || '历史商品信息未留存' }} · 合计 {{ row.quantity }} 件
          </p></template
        ></el-table-column
      ><el-table-column :label="seller ? '买家' : '发起人'" width="130"
        ><template #default="{ row }">{{
          seller ? row.user : row.owner
        }}</template></el-table-column
      ><el-table-column label="订单总额" width="150"
        ><template #default="{ row }">¥{{ money(row.total) }}</template></el-table-column
      ><el-table-column label="状态" width="110"
        ><template #default="{ row }"
          ><el-tag :type="row.status === -1 ? 'info' : 'success'" effect="plain">{{
            orderLabels[row.status]
          }}</el-tag></template
        ></el-table-column
      ><el-table-column label="创建时间" min-width="170"
        ><template #default="{ row }">{{ dateTime(row.createTime) }}</template></el-table-column
      ><el-table-column label="操作" min-width="165"
        ><template #default="{ row }"
          ><div class="inline-actions">
            <RouterLink :to="`/orders/${row.id}`">查看详情 →</RouterLink>
            <RouterLink
              :to="{ path: seller ? '/seller/refunds' : '/refunds', query: { orderId: row.id } }"
              >查看售后</RouterLink
            >
          </div></template
        ></el-table-column
      ><template #empty>还没有相关订单</template></el-table
    >
    <div class="pagination" v-if="result">
      <el-pagination
        v-model:current-page="page"
        :total="pageCount(result.count)"
        :page-size="10"
        :disabled="task.busy.value"
        layout="prev,pager,next"
        @current-change="load"
      />
    </div>
  </section>
</template>
