<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { useAuth } from '../stores/auth'
import { useTask } from '../composables/useTask'
import { money, pageCount, saleState } from '../utils/format'
import { confirmAction } from '../utils/confirm'
import type { Item, Page } from '../types/api'
import ErrorNotice from '../components/ErrorNotice.vue'
import PageHeading from '../components/PageHeading.vue'
const auth = useAuth()
const task = useTask()
const write = useTask()
const page = ref(1)
const keyword = ref('')
const result = ref<Page<Item> | null>(null)
async function load() {
  await task.run(async () => {
    result.value = await api.items({
      owner: auth.user!.id,
      page: page.value - 1,
      size: 10,
      keyword: keyword.value || undefined,
    })
  })
}
async function change(item: Item) {
  if (
    !(await confirmAction(
      item.status === 0
        ? '下架后停止新的购买，但不取消已有订单。确认下架？'
        : '确认重新上架这个团购？'
    ))
  )
    return
  await write.run(async () => {
    await api.editItem(item.id, { status: item.status === 0 ? -1 : 0 })
    await load()
  }, '销售状态已更新')
}
function search() {
  page.value = 1
  void load()
}
onMounted(load)
</script>
<template>
  <PageHeading
    title="我发起的团购"
    description="把你发现的好物，分享给身边的邻居。"
    eyebrow="YOUR GOOD THINGS"
    ><RouterLink to="/seller/orders"><el-button size="large">销售订单</el-button></RouterLink
    ><RouterLink to="/seller/refunds"><el-button size="large">售后管理</el-button></RouterLink
    ><RouterLink to="/seller/items/new"
      ><el-button type="primary" size="large">＋ 发起团购</el-button></RouterLink
    ></PageHeading
  >
  <section class="panel">
    <form class="toolbar" @submit.prevent="search">
      <el-input
        v-model="keyword"
        placeholder="搜索我发起的团购"
        aria-label="搜索我发起的团购"
        clearable
      /><el-button native-type="submit" :disabled="task.busy.value">搜索</el-button>
    </form>
    <ErrorNotice :message="task.error.value" @retry="load" /><ErrorNotice
      :message="write.error.value"
    /><el-table v-loading="task.busy.value" :data="result?.content || []"
      ><el-table-column label="团购名称" min-width="220"
        ><template #default="{ row }"
          ><RouterLink :to="`/items/${row.id}`">{{ row.name }}</RouterLink></template
        ></el-table-column
      ><el-table-column label="单价" width="130"
        ><template #default="{ row }">¥{{ money(row.price) }}</template></el-table-column
      ><el-table-column prop="stock" label="剩余库存" width="100" /><el-table-column
        label="销售状态"
        width="110"
        ><template #default="{ row }">{{ saleState(row) }}</template></el-table-column
      ><el-table-column label="操作" width="180"
        ><template #default="{ row }"
          ><RouterLink :to="`/seller/items/${row.id}/edit`"
            ><el-button link type="primary">编辑</el-button></RouterLink
          ><el-button link :disabled="write.busy.value" @click="change(row)">{{
            row.status === 0 ? '下架' : '上架'
          }}</el-button></template
        ></el-table-column
      ><template #empty>还没有团购，点击“发起团购”开始</template></el-table
    >
    <div class="pagination" v-if="result">
      <el-pagination
        v-model:current-page="page"
        :total="pageCount(result.count)"
        :page-size="10"
        layout="prev,pager,next"
        @current-change="load"
      />
    </div>
  </section>
</template>
