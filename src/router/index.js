import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { createLogger } from '@/utils/logger'

// 设备检测函数
function isMobile() {
    // 可以根据屏幕宽度判断
    const screenWidth =
        window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
    return screenWidth < 768
}

// 路由配置
const routes = [
    {
        path: '/',
        name: 'home',
        component: HomeView,
    },
    // 学生管理路由
    {
        path: '/student',
        name: 'student',
        component: () => import('../views/StudentView.vue'),
        beforeEnter: (to, from, next) => {
            if (isMobile()) {
                next({ path: '/student/mobile' })
            } else {
                next()
            }
        },
    },
    {
        path: '/student/mobile',
        name: 'studentMobile',
        component: () => import('../views/StudentMobileView.vue'),
        beforeEnter: (to, from, next) => {
            if (!isMobile()) {
                next({ path: '/student' })
            } else {
                next()
            }
        },
    },
    // 班级管理路由
    {
        path: '/class',
        name: 'class',
        component: () => import('../views/ClassView.vue'),
        beforeEnter: (to, from, next) => {
            if (isMobile()) {
                next({ path: '/class/mobile' })
            } else {
                next()
            }
        },
        children: [
            {
                path: '',
                name: 'classOverview',
                redirect: { name: 'classOverviewIndex' },
            },
            {
                path: 'index',
                name: 'classOverviewIndex',
                component: () => import('../views/class/ClassOverview.vue'),
            },
            {
                path: 'student',
                name: 'classStudent',
                component: () => import('../views/class/ClassStudent.vue'),
                redirect: { name: 'studentOverview' },
                children: [
                    {
                        path: 'overview',
                        name: 'studentOverview',
                        component: () => import('../views/class/student/StudentOverview.vue'),
                    },
                    {
                        path: 'preview',
                        name: 'studentPreview',
                        component: () => import('../views/class/student/StudentPreview.vue'),
                    },
                ],
            },

            {
                path: 'settings',
                name: 'classSettings',
                component: () => import('../views/class/ClassSettings.vue'),
            },
        ],
    },
    {
        path: '/class/mobile',
        name: 'classMobile',
        component: () => import('../views/ClassMobileView.vue'),
        beforeEnter: (to, from, next) => {
            if (!isMobile()) {
                next({ path: '/class' })
            } else {
                next()
            }
        },
    },
    // 年级管理路由
    {
        path: '/grade',
        name: 'grade',
        component: () => import('../views/GradeView.vue'),
        beforeEnter: (to, from, next) => {
            if (isMobile()) {
                next({ path: '/grade/mobile' })
            } else {
                next()
            }
        },
        children: [
            {
                path: '',
                name: 'gradeOverview',
                redirect: { name: 'gradeOverviewIndex' },
            },
            {
                path: 'index',
                name: 'gradeOverviewIndex',
                component: () => import('../views/grade/GradeOverview.vue'),
            },
            {
                path: 'student',
                name: 'gradeStudent',
                component: () => import('../views/grade/GradeStudent.vue'),
                redirect: { name: 'gradeStudentOverview' },
                children: [
                    {
                        path: 'overview',
                        name: 'gradeStudentOverview',
                        component: () => import('../views/grade/student/StudentOverview.vue'),
                    },
                    {
                        path: 'preview',
                        name: 'gradeStudentPreview',
                        component: () => import('../views/grade/student/StudentPreview.vue'),
                    },
                ],
            },
            {
                path: 'settings',
                name: 'gradeSettings',
                component: () => import('../views/grade/GradeSettings.vue'),
            },
        ],
    },
    {
        path: '/grade/mobile',
        name: 'gradeMobile',
        component: () => import('../views/GradeMobileView.vue'),
        beforeEnter: (to, from, next) => {
            if (!isMobile()) {
                next({ path: '/grade' })
            } else {
                next()
            }
        },
    },
    // 致谢路由
    {
        path: '/thanks',
        name: 'thanks',
        component: () => import('../views/ThanksView.vue'),
        beforeEnter: (to, from, next) => {
            if (isMobile()) {
                next({ path: '/thanks/mobile' })
            } else {
                next()
            }
        },
    },
    {
        path: '/thanks/mobile',
        name: 'thanksMobile',
        component: () => import('../views/ThanksMobileView.vue'),
        beforeEnter: (to, from, next) => {
            if (!isMobile()) {
                next({ path: '/thanks' })
            } else {
                next()
            }
        },
    },
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

const log = createLogger('router')

router.afterEach((to) => {
    if (import.meta.env.DEV) {
        log.debug('navigate', { name: to.name, path: to.fullPath })
    }
})

export default router
