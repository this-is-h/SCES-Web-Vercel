<script setup>
import '@vant/touch-emulator'
</script>

<template>
    <div class="student-layout">
        <iframe class="student-mobile-layout" src="/student/mobile?pc=true"></iframe>
    </div>
</template>

<style scoped>
.student-layout {
    width: 100%;
    height: 100%;
    background-color: var(--van-doc-gray-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.student-mobile-layout {
    width: 380px;
    height: 98%;
    overflow: hidden;
    border-radius: 15px;
}
</style>
