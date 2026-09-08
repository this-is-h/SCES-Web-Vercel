const buildPayload = (base, input) => {
    if (typeof input === 'string') return { ...base, title: input }
    return { ...base, ...(input || {}) }
}

export const createAppToast = (toast) => {
    const add = (payload) => toast?.add?.(payload)

    return {
        success: (input) =>
            add(
                buildPayload(
                    { color: 'success', icon: 'i-lucide-check-circle-2' },
                    input,
                ),
            ),
        error: (input) => add(buildPayload({ color: 'error', icon: 'i-lucide-x-circle' }, input)),
        warning: (input) =>
            add(
                buildPayload(
                    { color: 'warning', icon: 'i-lucide-alert-triangle' },
                    input,
                ),
            ),
        info: (input) => add(buildPayload({ color: 'info', icon: 'i-lucide-info' }, input)),
    }
}

const CONTAINER_ID = 'app-fallback-toast-container'

const styleForType = (type) => {
    switch (type) {
        case 'success':
            return { bg: '#16a34a', border: '#14532d' }
        case 'warning':
            return { bg: '#f59e0b', border: '#92400e' }
        case 'info':
            return { bg: '#2563eb', border: '#1e3a8a' }
        case 'error':
        default:
            return { bg: '#dc2626', border: '#7f1d1d' }
    }
}

const ensureContainer = () => {
    if (typeof document === 'undefined') return null

    let el = document.getElementById(CONTAINER_ID)
    if (el) return el

    el = document.createElement('div')
    el.id = CONTAINER_ID
    Object.assign(el.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '2147483647',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: 'min(360px, calc(100vw - 32px))',
        pointerEvents: 'none',
    })
    document.body.appendChild(el)
    return el
}

export const showFallbackToast = ({
    title,
    message,
    type = 'error',
    duration = 4500,
} = {}) => {
    const container = ensureContainer()
    if (!container) return

    const { bg, border } = styleForType(type)
    const toast = document.createElement('div')
    Object.assign(toast.style, {
        pointerEvents: 'auto',
        color: '#fff',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '10px',
        padding: '12px 12px 10px',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
        fontSize: '14px',
        lineHeight: '20px',
    })
    toast.setAttribute('role', 'alert')
    toast.setAttribute('aria-live', 'polite')

    const topRow = document.createElement('div')
    Object.assign(topRow.style, {
        display: 'flex',
        alignItems: 'start',
        justifyContent: 'space-between',
        gap: '12px',
    })

    const content = document.createElement('div')
    Object.assign(content.style, { flex: '1 1 auto', minWidth: '0' })

    if (title) {
        const titleEl = document.createElement('div')
        titleEl.textContent = String(title)
        Object.assign(titleEl.style, {
            fontWeight: '700',
            marginBottom: message ? '2px' : '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        })
        content.appendChild(titleEl)
    }

    const msg = message ?? title ?? ''
    if (msg) {
        const msgEl = document.createElement('div')
        msgEl.textContent = String(msg)
        Object.assign(msgEl.style, {
            opacity: '0.95',
            wordBreak: 'break-word',
        })
        content.appendChild(msgEl)
    }

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', '关闭')
    closeBtn.textContent = '×'
    Object.assign(closeBtn.style, {
        flex: '0 0 auto',
        height: '22px',
        width: '22px',
        lineHeight: '18px',
        borderRadius: '999px',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        background: 'rgba(255, 255, 255, 0.12)',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '18px',
        padding: '0',
    })

    let removed = false
    const remove = () => {
        if (removed) return
        removed = true
        toast.remove()
    }
    closeBtn.addEventListener('click', remove)

    topRow.appendChild(content)
    topRow.appendChild(closeBtn)
    toast.appendChild(topRow)
    container.appendChild(toast)

    const timeoutMs = Number.isFinite(duration) ? duration : 4500
    if (timeoutMs > 0) window.setTimeout(remove, timeoutMs)
}
