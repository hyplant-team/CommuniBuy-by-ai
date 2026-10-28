<script setup lang="ts">
defineProps<{ message: string; onRetry?: () => void }>()
</script>
<template>
  <el-alert
    v-if="message"
    :title="message"
    type="error"
    show-icon
    :closable="false"
    class="error-notice"
    ><template v-if="onRetry" #default
      ><el-button size="small" @click="onRetry">重新加载</el-button></template
    ></el-alert
  >
</template>
