<template>
    <div class="home-container">
        <h1 class="title">学生德育分管理系统</h1>
        <p class="description">欢迎使用学生管理系统，请选择您的身份：</p>

        <div class="buttons-container">
            <RouterLink to="/student" class="nav-button"> 学生个人 </RouterLink>
            <RouterLink to="/class" class="nav-button"> 班级评定组 </RouterLink>
            <RouterLink to="/grade" class="nav-button"> 年级管理 </RouterLink>
            <RouterLink to="/thanks" class="nav-button"> 致谢名单 </RouterLink>
        </div>

        <p class="tips">本系统不会联网上传您的任何数据，您可以在页面加载完成后断网使用。</p>
    </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.home-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 2rem;
    box-sizing: border-box;
}

.title {
    font-size: 2.5rem;
    margin-bottom: 1rem;
}

.description {
    font-size: 1.2rem;
    margin-bottom: 1.5rem;
    color: var(--van-doc-text-color-4);
    max-width: 600px;
}

.buttons-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    align-items: center;
}

.nav-button {
    display: inline-block;
    padding: 1rem 2rem;
    font-size: 1.2rem;
    font-weight: bold;
    color: white;
    background-color: var(--van-doc-blue);
    border: none;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.3s ease;
    min-width: 200px;
    text-align: center;
}

.nav-button:hover {
    background-color: var(--van-doc-blockquote-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.nav-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.tips {
    font-size: 1rem;
    margin-top: 1.5rem;
    color: var(--van-doc-text-color-4);
    max-width: 600px;
}
</style>
