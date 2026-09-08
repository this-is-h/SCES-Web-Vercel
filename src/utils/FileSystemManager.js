import localforage from 'localforage'
import { createLogger } from '@/utils/logger'

const log = createLogger('fs')

/**
 * FileSystemManager
 * 封装 File System Access API，提供文件/文件夹的授权、读写及持久化能力。
 */
class FileSystemManager {
    constructor() {
        this.directoryHandle = null
        this.handleKey = 'directoryHandle'
    }

    /**
     * 检测浏览器是否支持 File System Access API
     * @returns {boolean}
     */
    isSupported() {
        return typeof window !== 'undefined' && 'showDirectoryPicker' in window
    }

    /**
     * 从本地存储恢复文件夹句柄
     * @returns {Promise<{handle: FileSystemDirectoryHandle|null, authorized: boolean}>}
     */
    async restoreHandle() {
        try {
            const handle = await localforage.getItem(this.handleKey)
            if (handle) {
                this.directoryHandle = handle
                // 查询权限
                const options = { mode: 'readwrite' }
                const permission = await handle.queryPermission(options)
                return {
                    handle,
                    authorized: permission === 'granted',
                }
            }
        } catch (e) {
            log.error('restoreHandle 失败', e)
        }
        return { handle: null, authorized: false }
    }

    /**
     * 请求用户授权文件夹
     * @param {boolean} forceNew 是否强制重新选择文件夹
     * @returns {Promise<FileSystemDirectoryHandle>}
     */
    async authorize(forceNew = false) {
        if (!this.isSupported()) {
            throw new Error('BROWSER_NOT_SUPPORTED')
        }

        try {
            let handle = this.directoryHandle

            // 如果已有句柄且不是强制新选，尝试请求权限
            if (handle && !forceNew) {
                const options = { mode: 'readwrite' }
                const permission = await handle.requestPermission(options)
                if (permission !== 'granted') {
                    throw new Error('PERMISSION_DENIED')
                }
            } else {
                // 打开文件夹选择器
                handle = await window.showDirectoryPicker({ mode: 'readwrite' })
                this.directoryHandle = handle
                // 持久化句柄
                await localforage.setItem(this.handleKey, handle)
            }

            // 初始化目录结构说明
            await this.initializeProjectStructure(handle)

            return handle
        } catch (e) {
            if (e.name === 'AbortError') {
                throw e // 用户取消
            }
            log.error('authorize 失败', e)
            throw e
        }
    }

    /**
     * 撤销授权（清除本地存储的句柄）
     */
    async revoke() {
        await localforage.removeItem(this.handleKey)
        this.directoryHandle = null
    }

    /**
     * 初始化项目目录结构说明文件
     * @param {FileSystemDirectoryHandle} rootHandle
     */
    async initializeProjectStructure(rootHandle) {
        const readmeContent = `# 学生德育分管理系统 - 数据目录说明

本目录存储系统的所有配置与学生数据。为了确保系统正常运行，请严格遵守以下目录规范。

## 📁 目录结构规范

\`\`\`text
root/
├── class/                      # [目录] 班级端数据分区
│   ├── config.json             # [文件] 班级端本地配置（含私钥等）
│   └── semesters/              # [目录] 班级端所有学期数据
│       ├── 2025-1/             # [目录] 具体学期 (格式：年份-学期)
│       │   └── students/       # [目录] 该学期所有学生数据
│       │       ├── 张三_2023001/
│       │       │   ├── info.json
│       │       │   └── evidence/
│       │       └── ...
│       └── ...
├── grade/                      # [目录] 年级端数据分区
│   ├── config.json             # [文件] 年级端本地配置（含私钥等）
│   └── semesters/              # [目录] 年级端所有学期数据
│       ├── 2025-1/
│       │   └── students/
│       └── ...
└── README.md                   # [文件] 本说明文档
\`\`\`

## ⚠️ 注意事项

1. **不要随意重命名**：系统依赖特定的文件名和目录层级来读取数据，随意修改可能导致数据无法加载。
2. **数据备份**：建议定期备份整个 \`root\` 文件夹。
3. **手动编辑**：虽然支持手动修改 JSON 文件，但请确保格式正确（标准 JSON 格式），否则系统可能报错。

---
*自动生成于：${new Date().toLocaleString()}*
`
        try {
            const fileHandle = await rootHandle.getFileHandle('README.md', { create: true })
            const writable = await fileHandle.createWritable()
            await writable.write(readmeContent)
            await writable.close()
        } catch (e) {
            log.warn('initializeProjectStructure 写入 README.md 失败', e)
        }
    }

    /**
     * 获取文件句柄（支持路径，如 'semesters/2025-1/config.json'）
     * @param {string} path 相对路径
     * @param {boolean} create 是否自动创建
     */
    async getFileHandle(path, create = false) {
        if (!this.directoryHandle) throw new Error('NO_ROOT_HANDLE')

        const parts = path.split('/').filter((p) => p)
        const fileName = parts.pop()
        let currentDir = this.directoryHandle

        for (const part of parts) {
            currentDir = await currentDir.getDirectoryHandle(part, { create })
        }

        return await currentDir.getFileHandle(fileName, { create })
    }

    /**
     * 写入文件内容
     * @param {string} path 文件路径
     * @param {string|Blob|BufferSource} content 内容
     */
    async writeFile(path, content) {
        const fileHandle = await this.getFileHandle(path, true)
        const writable = await fileHandle.createWritable()
        await writable.write(content)
        await writable.close()
    }

    /**
     * 检查文件是否存在
     * @param {string} path 文件路径
     * @returns {Promise<boolean>}
     */
    async exists(path) {
        try {
            await this.getFileHandle(path)
            return true
        } catch (e) {
            log.debug('exists 检查失败', { path, error: e })
            return false
        }
    }

    /**
     * 读取文件内容 (文本)
     * @param {string} path
     */
    async readFile(path) {
        try {
            const fileHandle = await this.getFileHandle(path)
            const file = await fileHandle.getFile()
            return await file.text()
        } catch (e) {
            // 仅记录 debug 日志，不抛出警告
            log.debug('readFile 失败', { path, error: e })
            return null
        }
    }

    /**
     * 递归读取目录结构
     * @param {string} path 相对路径，默认为根目录
     * @param {number|null} depth 读取深度，null 或 undefined 表示无限深度
     * @param {number} currentDepth 当前递归深度（内部使用）
     * @returns {Promise<Array<{name: string, kind: 'file'|'directory', path: string, children?: Array}>>}
     */
    async readDirectoryStructure(path = '', depth = null, currentDepth = 0) {
        if (!this.directoryHandle) throw new Error('NO_ROOT_HANDLE')

        // 深度限制检查
        if (depth !== null && currentDepth >= depth) {
            return []
        }

        let currentDir = this.directoryHandle
        if (path) {
            const parts = path.split('/').filter((p) => p)
            try {
                for (const part of parts) {
                    currentDir = await currentDir.getDirectoryHandle(part)
                }
            } catch (e) {
                log.warn('readDirectoryStructure 路径不可用', {
                    path,
                    error: e,
                })
                return []
            }
        }

        const entries = []
        for await (const entry of currentDir.values()) {
            const entryPath = path ? `${path}/${entry.name}` : entry.name
            const item = {
                name: entry.name,
                kind: entry.kind,
                path: entryPath,
            }

            if (entry.kind === 'directory') {
                // 只有当未达到深度限制时才递归
                if (depth === null || currentDepth + 1 < depth) {
                    item.children = await this.readDirectoryStructure(
                        entryPath,
                        depth,
                        currentDepth + 1,
                    )
                } else {
                    item.children = [] // 达到深度限制，不再读取子目录内容
                }
            }

            entries.push(item)
        }

        // 排序：文件夹在前，文件在后
        return entries.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name)
            return a.kind === 'directory' ? -1 : 1
        })
    }

    /**
     * 删除文件或目录
     * @param {string} path 相对路径
     * @param {{ recursive?: boolean }} options
     */
    async deleteEntry(path, options = {}) {
        if (!this.directoryHandle) throw new Error('NO_ROOT_HANDLE')
        const normalized = String(path || '')
            .split('/')
            .filter((p) => p)
        if (!normalized.length) throw new Error('INVALID_PATH')

        const name = normalized.pop()
        let parent = this.directoryHandle
        for (const part of normalized) {
            parent = await parent.getDirectoryHandle(part)
        }

        await parent.removeEntry(name, { recursive: Boolean(options?.recursive) })
    }
}

export const fileSystemManager = new FileSystemManager()
export default FileSystemManager
