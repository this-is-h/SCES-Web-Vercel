<script setup>
import { ref } from 'vue'
// 检测URL中的get参数
function getUrlParam(name) {
    const url = new URL(window.location.href)
    return url.searchParams.get(name)
}

// 检测pc参数，如果pc=true则引入touch-emulator
if (getUrlParam('pc') === 'true') {
    import('@vant/touch-emulator')
}

const onClickLeft = () => history.back();

import hImg from '@/assets/img/h.png'
import gzhLargeImg from '@/assets/img/gzh-large.png'
import karlImg from '@/assets/img/karl.jpg'
import yoloImg from '@/assets/img/yolo.jpg'
import yjrcImg from '@/assets/img/yjrc.jpg'

const dialogH = ref(false)
</script>

<template>
    <header>
        <van-nav-bar
            title="学生德育分管理系统"
            left-text="返回"
            left-arrow
            @click-left="onClickLeft"
        />
    </header>
    <div class="thanks">
        <h1>致谢名单</h1>
        <h2>特别鸣谢</h2>
        <van-cell-group inset>
            <van-cell title="H" label="This is H" center is-link @click="dialogH = true">
                <template #icon>
                    <van-image
                        round
                        width="24"
                        style="margin-right: 10px; width: 24px"
                        :src="hImg"
                    />
                </template>
            </van-cell>
            <van-dialog v-model:show="dialogH" title="关注我们">
                <van-image style="padding: 1em 0.5em" :src="gzhLargeImg" />
            </van-dialog>
            <van-cell title="Karl" label="Your Name Engraved Herein" center>
                <template #icon>
                    <van-image
                        round
                        width="24"
                        style="margin-right: 10px; width: 24px"
                        :src="karlImg"
                    />
                </template>
            </van-cell>
            <van-cell title="Yolo" label="Earth Needs Funny Jigsaw" center>
                <template #icon>
                    <van-image
                        round
                        width="24"
                        style="margin-right: 10px; width: 24px"
                        :src="yoloImg"
                    />
                </template>
            </van-cell>
            <van-cell title="邮寄日出🌅" label="风遇山止，船遇岸停" center>
                <template #icon>
                    <van-image
                        round
                        width="24"
                        style="margin-right: 10px; width: 24px"
                        :src="yjrcImg"
                    />
                </template>
            </van-cell>
        </van-cell-group>
        <h2>项目支持</h2>
        <van-cell-group inset>
            <van-cell
                title="Vue"
                label="一款用于构建用户界面的 JavaScript 框架"
                url="https://cn.vuejs.org/"
                center
                is-link
            >
                <template #icon>
                    <svg
                        style="margin-right: 10px"
                        class="logo"
                        viewBox="0 0 128 128"
                        width="24"
                        height="24"
                        data-v-35dc6318=""
                    >
                        <path
                            fill="#42b883"
                            d="M78.8,10L64,35.4L49.2,10H0l64,110l64-110C128,10,78.8,10,78.8,10z"
                            data-v-35dc6318=""
                        ></path>
                        <path
                            fill="#35495e"
                            d="M78.8,10L64,35.4L49.2,10H25.6L64,76l38.4-66H78.8z"
                            data-v-35dc6318=""
                        ></path>
                    </svg>
                </template>
            </van-cell>
            <van-cell
                title="Vant"
                label="一个轻量、可定制的移动端组件库"
                url="https://vant-ui.github.io/vant/#/zh-CN"
                center
                is-link
            >
                <template #icon>
                    <img
                        style="margin-right: 10px; width: 24px"
                        src="https://fastly.jsdelivr.net/npm/@vant/assets/logo.png"
                    />
                </template>
            </van-cell>
            <van-cell
                title="Github"
                label="GitHub is where people build software. More than 150 million people use GitHub to discover, fork, and contribute to over 420 million projects."
                url="https://github.com/"
                center
                is-link
            >
                <template #icon>
                    <svg data-v-18c72980="" data-v-e4738907="" width="24" height="24" viewBox="0 0 24 24" style="margin-right: 10px;--sx: 1; --sy: 1; --r: 0deg; color: grey;"><path data-v-18c72980="" d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"></path></svg>
                </template>
            </van-cell>
            <van-cell
                title="Vercel"
                label="Vercel provides the developer tools and cloud infrastructure to build, scale, and secure a faster, more personalized web."
                url="https://vercel.com/"
                center
                is-link
            >
                <template #icon>
                    <svg
                        style="margin-right: 10px"
                        aria-label="Vercel Logo"
                        fill="var(--van-doc-text-color-1)"
                        class="logo"
                        viewBox="0 0 96 96"
                        width="24"
                        height="24"
                    >
                        <path d="M37.59.25l36.95 64H.64l36.95-64z"></path>
                    </svg>
                </template>
            </van-cell>
            <van-cell
                title="Watt Toolkit"
                label="「Watt Toolkit」是一个开源跨平台的多功能 Steam 工具箱。"
                url="https://steampp.net/"
                center
                is-link
            >
                <template #icon>
                    <img
                        style="margin-right: 10px; width: 24px"
                        src="https://steampp.net/svg/logo.png"
                    />
                </template>
            </van-cell>
        </van-cell-group>
    </div>
</template>

<style scoped>
.thanks {
    width: 100%;
    height: calc(100% - 46px);
    overflow-y: auto;
    padding: 1em 0;
}

h1,
h2 {
    margin: 0 30px;
}

h1 {
    color: var(--van-doc-text-color-1);
    font-size: 20px;
    font-weight: bold;
}

h2 {
    color: var(--van-doc-text-color-4);
    font-size: 14px;
    font-weight: 400;
    padding: 0.7em 0;
}
</style>
