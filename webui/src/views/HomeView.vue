<template>
  <div class="market-page">
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#" aria-label="校园集市首页">
          <span class="brand-mark">闲</span>
          <span class="brand-text">校园集市</span>
        </a>

        <el-input
          v-model="searchKeyword"
          class="search-box"
          placeholder="搜索你感兴趣的商品"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #append>
            <el-button type="primary" @click="handleSearch">搜索</el-button>
          </template>
        </el-input>

        <el-button class="login-button" plain @click="handleLogin">
          <el-icon><User /></el-icon>
          登录
        </el-button>
      </div>
    </header>

    <main class="main-content">
      <section class="hero-banner">
        <div>
          <p class="eyebrow">校园闲置 · 轻松流转</p>
          <h1>让每件好物找到新主人</h1>
          <p class="hero-description">本校同学都在用的二手交易平台，安心、方便、离你更近。</p>
        </div>
        <div class="hero-decoration" aria-hidden="true">♧</div>
      </section>

      <section class="category-section" aria-label="商品分类">
        <div class="section-heading">
          <h2>发现好物</h2>
          <span>{{ filteredProducts.length }} 件商品</span>
        </div>
        <div class="category-list">
          <button
            v-for="category in categories"
            :key="category"
            class="category-tag"
            :class="{ active: activeCategory === category }"
            @click="activeCategory = category"
          >
            {{ category }}
          </button>
        </div>
      </section>

      <section class="product-section" aria-label="商品列表">
        <div v-if="filteredProducts.length" class="product-grid">
          <el-card v-for="product in pagedProducts" :key="product.id" class="product-card" shadow="hover">
            <div class="product-image-wrap">
              <img class="product-image" :src="product.image" :alt="product.title" />
              <span v-if="product.isNew" class="new-badge">近全新</span>
            </div>
            <div class="product-info">
              <h3 class="product-title" :title="product.title">{{ product.title }}</h3>
              <div class="product-meta">
                <span class="product-price">¥{{ product.price }}</span>
                <span class="product-seller">
                  <el-icon><UserFilled /></el-icon>
                  {{ product.seller }}
                </span>
              </div>
              <div class="product-location">
                <el-icon><Location /></el-icon>
                {{ product.location }} · {{ product.time }}
              </div>
            </div>
          </el-card>
        </div>
        <el-empty v-else description="没有找到相关商品，换个关键词试试吧" />
      </section>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="filteredProducts.length"
          @current-change="handlePageChange"
        />
      </div>
    </main>

    <footer class="footer">校园集市 · 让闲置物品流动起来</footer>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Location, Search, User, UserFilled } from '@element-plus/icons-vue'

const searchKeyword = ref('')
const activeCategory = ref('全部')
const currentPage = ref(1)
const pageSize = 8

const categories = ['全部', '数码', '图书', '生活用品', '服饰鞋包', '运动户外']

const products = [
  { id: 1, title: 'iPad Air 5 平板电脑 64G', price: '2,899', seller: '橘子汽水', location: '东区宿舍', time: '刚刚', category: '数码', isNew: true, image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=700&q=85' },
  { id: 2, title: '高等数学同济第七版教材', price: '18', seller: '小周同学', location: '图书馆', time: '10分钟前', category: '图书', isNew: false, image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=700&q=85' },
  { id: 3, title: '宿舍小风扇 静音 USB充电', price: '35', seller: '风一样的我', location: '南区宿舍', time: '20分钟前', category: '生活用品', isNew: true, image: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=700&q=85' },
  { id: 4, title: '索尼 WH-1000XM4 降噪耳机', price: '899', seller: '林间小鹿', location: '校门口', time: '35分钟前', category: '数码', isNew: false, image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=700&q=85' },
  { id: 5, title: '考研英语真题资料合集', price: '25', seller: '上岸学姐', location: '西区宿舍', time: '1小时前', category: '图书', isNew: false, image: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=700&q=85' },
  { id: 6, title: '宜家桌面收纳盒 两件套', price: '22', seller: '小满', location: '东区宿舍', time: '2小时前', category: '生活用品', isNew: true, image: 'https://images.unsplash.com/photo-1616627561839-074385245ff6?auto=format&fit=crop&w=700&q=85' },
  { id: 7, title: 'Nike 运动鞋 轻便透气 42码', price: '169', seller: '奔跑吧同学', location: '体育馆', time: '3小时前', category: '运动户外', isNew: false, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85' },
  { id: 8, title: '春秋款宽松卫衣 米白色', price: '49', seller: '今天也要早睡', location: '北区宿舍', time: '昨天', category: '服饰鞋包', isNew: false, image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=700&q=85' },
  { id: 9, title: '机械键盘 青轴 有线背光', price: '128', seller: '代码搬运工', location: '实验楼', time: '昨天', category: '数码', isNew: false, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=700&q=85' },
  { id: 10, title: '世界名著经典读本 6册', price: '46', seller: '书香校园', location: '图书馆', time: '昨天', category: '图书', isNew: true, image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=85' }
]

const filteredProducts = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return products.filter((product) => {
    const matchCategory = activeCategory.value === '全部' || product.category === activeCategory.value
    const matchKeyword = !keyword || `${product.title}${product.seller}`.toLowerCase().includes(keyword)
    return matchCategory && matchKeyword
  })
})

const pagedProducts = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredProducts.value.slice(start, start + pageSize)
})

watch([activeCategory, searchKeyword], () => {
  currentPage.value = 1
})

function handleSearch() {
  currentPage.value = 1
  ElMessage.success(searchKeyword.value.trim() ? `正在为你查找“${searchKeyword.value.trim()}”` : '已展示全部商品')
}

function handleLogin() {
  ElMessage.info('登录功能即将开放，欢迎关注校园集市')
}

function handlePageChange(page) {
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) { margin: 0; background: #f6f8fb; color: #1f2937; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; }
.market-page { min-height: 100vh; }
.topbar { position: sticky; top: 0; z-index: 10; background: rgba(255, 255, 255, .94); border-bottom: 1px solid #e9edf3; backdrop-filter: blur(14px); }
.topbar-inner { display: flex; align-items: center; gap: 28px; max-width: 1180px; height: 72px; margin: 0 auto; padding: 0 24px; }
.brand { display: flex; align-items: center; gap: 9px; color: #172033; text-decoration: none; white-space: nowrap; }
.brand-mark { display: grid; place-items: center; width: 35px; height: 35px; border-radius: 11px; color: #fff; background: linear-gradient(135deg, #5b6cff, #8290ff); font-size: 20px; font-weight: 700; }
.brand-text { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
.search-box { max-width: 580px; margin: 0 auto; }
.search-box :deep(.el-input__wrapper) { border-radius: 12px 0 0 12px; box-shadow: 0 0 0 1px #e4e8f0 inset; }
.search-box :deep(.el-input-group__append) { border-radius: 0 12px 12px 0; overflow: hidden; padding: 0; }
.search-box :deep(.el-input-group__append .el-button) { height: 40px; padding: 0 23px; margin: 0; border: 0; }
.login-button { border-color: #dce2ee; border-radius: 10px; color: #475569; }
.main-content { max-width: 1180px; margin: 0 auto; padding: 30px 24px 70px; }
.hero-banner { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 190px; margin-bottom: 32px; padding: 34px 48px; overflow: hidden; border-radius: 20px; background: linear-gradient(110deg, #eef1ff 0%, #e9f7ff 100%); }
.hero-banner::after { position: absolute; right: -80px; bottom: -130px; width: 360px; height: 260px; border-radius: 50%; background: rgba(129, 144, 255, .17); content: ""; }
.eyebrow { margin: 0 0 12px; color: #6876e9; font-size: 14px; font-weight: 700; letter-spacing: 2px; }
.hero-banner h1 { margin: 0 0 10px; color: #18233d; font-size: 32px; letter-spacing: 1px; }
.hero-description { margin: 0; color: #68758b; font-size: 15px; }
.hero-decoration { position: relative; z-index: 1; margin-right: 45px; color: #8793f4; font-size: 118px; line-height: 1; transform: rotate(-25deg); opacity: .66; }
.section-heading { display: flex; align-items: baseline; gap: 12px; margin-bottom: 17px; }
.section-heading h2 { margin: 0; color: #202b3e; font-size: 22px; }
.section-heading span { color: #98a2b3; font-size: 13px; }
.category-list { display: flex; gap: 12px; margin-bottom: 25px; overflow-x: auto; }
.category-tag { padding: 9px 20px; border: 1px solid #e2e7ef; border-radius: 10px; color: #64748b; background: #fff; cursor: pointer; font-size: 14px; transition: .2s; }
.category-tag:hover, .category-tag.active { border-color: #6877ee; color: #fff; background: #6877ee; box-shadow: 0 5px 15px rgba(104, 119, 238, .2); }
.product-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.product-card { border: 1px solid #edf0f5; border-radius: 14px; overflow: hidden; }
.product-card :deep(.el-card__body) { padding: 0; }
.product-image-wrap { position: relative; height: 185px; overflow: hidden; background: #f1f4f8; }
.product-image { width: 100%; height: 100%; object-fit: cover; transition: transform .35s; }
.product-card:hover .product-image { transform: scale(1.05); }
.new-badge { position: absolute; top: 12px; left: 12px; padding: 4px 8px; border-radius: 6px; color: #fff; background: #5c75e9; font-size: 11px; }
.product-info { padding: 15px 16px 16px; }
.product-title { overflow: hidden; margin: 0 0 14px; color: #27344a; font-size: 15px; font-weight: 600; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.product-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.product-price { color: #f05c55; font-size: 20px; font-weight: 700; }
.product-seller, .product-location { display: flex; align-items: center; gap: 4px; color: #95a0b2; font-size: 12px; }
.product-location { margin-top: 12px; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 34px; }
.footer { padding: 24px; color: #9aa4b4; background: #fff; text-align: center; font-size: 13px; }
@media (max-width: 900px) { .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .hero-decoration { margin-right: 0; } }
@media (max-width: 680px) { .topbar-inner { gap: 12px; height: auto; flex-wrap: wrap; padding-top: 13px; padding-bottom: 13px; } .brand { flex: 1; } .search-box { order: 3; width: 100%; max-width: none; } .main-content { padding: 20px 16px 50px; } .hero-banner { min-height: 175px; padding: 26px; } .hero-banner h1 { font-size: 25px; } .hero-decoration { display: none; } .product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } .product-image-wrap { height: 145px; } .product-info { padding: 13px; } .product-price { font-size: 18px; } }
@media (max-width: 390px) { .product-grid { grid-template-columns: 1fr; } }
</style>
