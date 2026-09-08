<script setup>
import '@vant/touch-emulator'
</script>

<template>
    <div class="thanks-layout">
        <iframe class="thanks-mobile-layout" src="/thanks/mobile?pc=true"></iframe>
    </div>
</template>

<style scoped>
.thanks-layout {
    width: 100%;
    height: 100%;
    background-color: var(--van-doc-gray-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.thanks-mobile-layout {
    width: 380px;
    height: 98%;
    overflow: hidden;
    border-radius: 15px;
}
</style>
