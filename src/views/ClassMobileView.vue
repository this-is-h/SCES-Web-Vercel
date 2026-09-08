<script setup></script>

<template>
    <main>
        <van-empty style="width: 100%; height: 100%" description="移动端建设中，请使用PC端访问...">
            <template #image>
                <svg width="160" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" class="nc-icon-wrapper">
                        <path
                            d="M14.5489 8H9.4513L9.08052 19.9253C9.0382 21.0584 9.94529 22 11.0791 22H12.921C14.0549 22 14.962 21.0584 14.9197 19.9254L14.5489 8Z"
                            fill="url(#hammer_existing_0)"
                            data-glass="origin"
                            mask="url(#hammer_mask)"
                        />
                        <path
                            d="M14.5489 8H9.4513L9.08052 19.9253C9.0382 21.0584 9.94529 22 11.0791 22H12.921C14.0549 22 14.962 21.0584 14.9197 19.9254L14.5489 8Z"
                            fill="url(#hammer_existing_0)"
                            data-glass="clone"
                            filter="url(#hammer_filter)"
                            clip-path="url(#hammer_clipPath)"
                        />
                        <path
                            d="M3 9V5C3 3.34315 4.34315 2 6 2H14.7393C15.4739 2 16.1833 2.26975 16.7324 2.75781L19.9932 5.65625C20.6335 6.22554 21 7.04162 21 7.89844V9.5C21 10.8807 19.8807 12 18.5 12H6C4.34315 12 3 10.6569 3 9Z"
                            fill="url(#hammer_existing_1)"
                            data-glass="blur"
                        />
                        <path
                            d="M3 9V5C3 3.34315 4.34315 2 6 2H14.7393C15.4739 2 16.1833 2.26975 16.7324 2.75781L19.9932 5.65625C20.6335 6.22554 21 7.04162 21 7.89844V9.5C21 10.8807 19.8807 12 18.5 12V11.25C19.4665 11.25 20.25 10.4665 20.25 9.5V7.89844C20.25 7.33628 20.0393 6.79772 19.665 6.38574L19.4951 6.2168L16.2344 3.31836C15.8225 2.95228 15.2902 2.75 14.7393 2.75H6C4.75736 2.75 3.75 3.75736 3.75 5V9C3.75 10.2426 4.75736 11.25 6 11.25V12C4.34315 12 3 10.6569 3 9ZM18.5 11.25V12H6V11.25H18.5Z"
                            fill="url(#hammer_existing_2)"
                        />
                        <defs>
                            <linearGradient
                                id="hammer_existing_0"
                                x1="12"
                                y1="8"
                                x2="12"
                                y2="22"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop stop-color="rgba(87, 87, 87, 1)" data-glass-11="on" />
                                <stop
                                    offset="1"
                                    stop-color="rgba(21, 21, 21, 1)"
                                    data-glass-12="on"
                                />
                            </linearGradient>
                            <linearGradient
                                id="hammer_existing_1"
                                x1="12"
                                y1="2"
                                x2="12"
                                y2="12"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop stop-color="rgba(227, 227, 229, 0.6)" data-glass-21="on" />
                                <stop
                                    offset="1"
                                    stop-color="rgba(187, 187, 192, 0.6)"
                                    data-glass-22="on"
                                />
                            </linearGradient>
                            <linearGradient
                                id="hammer_existing_2"
                                x1="12"
                                y1="2"
                                x2="12"
                                y2="7.791"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop stop-color="rgba(255, 255, 255, 1)" data-glass-light="on" />
                                <stop
                                    offset="1"
                                    stop-color="rgba(255, 255, 255, 1)"
                                    stop-opacity="0"
                                    data-glass-light="on"
                                />
                            </linearGradient>
                            <filter
                                id="hammer_filter"
                                x="-100%"
                                y="-100%"
                                width="400%"
                                height="400%"
                                filterUnits="objectBoundingBox"
                                primitiveUnits="userSpaceOnUse"
                            >
                                <feGaussianBlur
                                    stdDeviation="2"
                                    x="0%"
                                    y="0%"
                                    width="100%"
                                    height="100%"
                                    in="SourceGraphic"
                                    edgeMode="none"
                                    result="blur"
                                />
                            </filter>
                            <clipPath id="hammer_clipPath">
                                <path
                                    d="M3 9V5C3 3.34315 4.34315 2 6 2H14.7393C15.4739 2 16.1833 2.26975 16.7324 2.75781L19.9932 5.65625C20.6335 6.22554 21 7.04162 21 7.89844V9.5C21 10.8807 19.8807 12 18.5 12H6C4.34315 12 3 10.6569 3 9Z"
                                    fill="url(#hammer_existing_1)"
                                />
                            </clipPath>
                            <mask id="hammer_mask">
                                <rect width="100%" height="100%" fill="#FFF" />
                                <path
                                    d="M3 9V5C3 3.34315 4.34315 2 6 2H14.7393C15.4739 2 16.1833 2.26975 16.7324 2.75781L19.9932 5.65625C20.6335 6.22554 21 7.04162 21 7.89844V9.5C21 10.8807 19.8807 12 18.5 12H6C4.34315 12 3 10.6569 3 9Z"
                                    fill="#000"
                                />
                            </mask>
                        </defs>
                    </g>
                </svg>
            </template>
        </van-empty>
    </main>
</template>

<style scoped>
main {
    width: 100%;
    height: 100%;
}
</style>
