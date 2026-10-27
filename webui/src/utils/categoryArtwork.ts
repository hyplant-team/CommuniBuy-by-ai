import {
  Apple,
  Box,
  Brush,
  CoffeeCup,
  Cpu,
  Football,
  Notebook,
  Reading,
  ShoppingBag,
} from '@element-plus/icons-vue'

// Match the category name returned by the API, never an item/category ID.
// Unrecognised or not-yet-loaded categories use the neutral shopping bag.
const artwork = [
  { pattern: /水果|生鲜|蔬菜|食品|食物|零食|餐|烘焙/, icon: Apple, tone: 1, key: 'food' },
  { pattern: /饮|茶|咖啡|牛奶|乳品/, icon: CoffeeCup, tone: 1, key: 'drink' },
  { pattern: /文具|学习|办公|笔记/, icon: Notebook, tone: 3, key: 'stationery' },
  { pattern: /图书|阅读|书籍|教材/, icon: Reading, tone: 3, key: 'books' },
  { pattern: /运动|户外|健身|体育/, icon: Football, tone: 2, key: 'sport' },
  { pattern: /数码|电子|电脑|手机|配件/, icon: Cpu, tone: 2, key: 'digital' },
  { pattern: /个护|洗护|清洁|卫生|美妆/, icon: Brush, tone: 0, key: 'care' },
  { pattern: /宿舍|日用|家居|收纳|生活用品/, icon: Box, tone: 0, key: 'daily' },
]

export function categoryArtwork(name?: string) {
  return (
    artwork.find((entry) => entry.pattern.test(name?.trim() || '')) || {
      icon: ShoppingBag,
      tone: 0,
      key: 'general',
    }
  )
}
