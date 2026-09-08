import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { createLogger } from '@/utils/logger'
import { createAppToast, showFallbackToast } from '@/utils/toast'
import { reportError } from '@/utils/error'

const app = createApp(App)
const pinia = createPinia()
const log = createLogger('main')

const showUserError = ({ title, message, type = 'error' }) => {
    try {
        const toast = globalThis?.useToast?.()
        if (toast?.add) {
            const appToast = createAppToast(toast)
            const payload = { title, description: message }
            if (type === 'success') appToast.success(payload)
            else if (type === 'warning') appToast.warning(payload)
            else if (type === 'info') appToast.info(payload)
            else appToast.error(payload)
            return
        }
    } catch {
        // ignore
    }

    showFallbackToast({ title, message, type })
}

// 设备检测函数
function isMobile() {
    // 可以根据屏幕宽度判断
    const screenWidth =
        window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
    return screenWidth < 768
}

const shouldNotifyUser = (detail) => {
    if (!detail) return false
    return detail.chunkLoad === true || detail.userFacing === true
}

const buildUserMessage = (detail) => {
    if (!detail) return '发生错误，请稍后重试或刷新页面'
    if (detail.chunkLoad) return '资源加载失败，请检查网络后刷新页面'
    return detail.userMessage || detail.message || '发生错误，请稍后重试或刷新页面'
}

const notifyDedupe = new Map()
const canNotifyNow = (detail) => {
    const key = `${detail?.chunkLoad ? 'chunk' : 'err'}|${String(detail?.message || '')}`
    const now = Date.now()
    const last = notifyDedupe.get(key) || 0
    if (now - last < 8000) return false
    notifyDedupe.set(key, now)
    return true
}

// 全局错误捕获：
// - 记录完整上下文，减少“未知错误”
// - 对动态加载失败（chunk 404/断网）给出可恢复提示
app.config.errorHandler = (err, instance, info) => {
    reportError(err, {
        source: 'vue',
        info,
        component: instance?.type?.name || instance?.type || 'unknown',
    })
}

router.onError((err) => {
    const e = reportError(err, { source: 'router' })
    if (String(e?.message || '').includes('Failed to fetch dynamically imported module')) {
        log.warn('检测到路由懒加载失败，建议刷新重试')
    }
})

window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    const msg = String(reason?.message || reason || '')
    if (!reason) return
    if (reason?.name === 'AbortError' || msg.includes('AbortError')) return
    reportError(reason, { source: 'unhandledrejection' })
})

window.addEventListener('error', (event) => {
    if (!(event instanceof ErrorEvent)) return
    // 忽略 ResizeObserver 循环限制错误
    if (
        event?.message === 'ResizeObserver loop limit exceeded' ||
        event?.message === 'ResizeObserver loop completed with undelivered notifications.'
    ) {
        event.stopImmediatePropagation()
        return
    }

    reportError(event?.error || event?.message, {
        source: 'window.error',
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
    })
})

window.addEventListener('app:error', async (event) => {
    const detail = event?.detail || {}

    // 在移动端优先用 Vant Notify；PC 端则优先用原生 alert（避免在此处强依赖 UI 库注入）
    if (!shouldNotifyUser(detail) || !canNotifyNow(detail)) return

    if (isMobile()) {
        try {
            const { showNotify } = await import('vant')
            showNotify({
                message: buildUserMessage(detail),
                duration: 4000,
                position: 'top',
                type: 'danger',
            })
            return
        } catch {
            // fallback below
        }
    }

    if (detail.chunkLoad) {
        showUserError({
            title: '资源加载失败',
            message: '请检查网络后刷新页面',
            type: 'error',
        })
        return
    }

    if (detail.userFacing) {
        showUserError({
            title: detail.title || '操作失败',
            message: buildUserMessage(detail),
            type: 'error',
        })
    }
})

const mobile = isMobile()
log.info('系统初始化', { platform: mobile ? 'mobile' : 'pc' })

if (mobile) {
    // 移动端：只引入 Vant
    import('vant')
        .then((Vant) => {
            import('vant/lib/index.css')
            import('./assets/vant.css')
            app.use(Vant)
            app.use(pinia)
            app.use(router)
            app.mount('#app')
        })
        .catch((e) => {
            reportError(e, { source: 'dynamic-import', target: 'vant' })
            log.error('依赖加载失败: vant')
            showFallbackToast({
                title: '依赖加载失败',
                message: '请刷新页面重试',
                type: 'error',
            })
        })
} else {
    // PC端：只引入 Element Plus 和 Nuxt UI
    import('element-plus')
        .then((ElementPlus) => {
            import('element-plus/dist/index.css')
            return import('@nuxt/ui/vue-plugin').then((ui) => {
                app.use(ElementPlus)
                app.use(ui.default)
                app.use(pinia)
                app.use(router)
                app.mount('#app')
            })
        })
        .catch((e) => {
            reportError(e, { source: 'dynamic-import', target: 'element-plus/@nuxt/ui' })
            log.error('依赖加载失败: element-plus/@nuxt/ui')
            showFallbackToast({
                title: '依赖加载失败',
                message: '请刷新页面重试',
                type: 'error',
            })
        })
}
