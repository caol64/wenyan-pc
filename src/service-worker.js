self.addEventListener('install', (event) => {
    console.log('Service Worker 安装成功');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker 激活');
});

self.addEventListener('fetch', (event) => {
    console.log('拦截请求:', event.request.url);
    const url = new URL(event.request.url);

    // 只拦截图片请求
    if (url.pathname.endsWith('.jpg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.gif')) {
        const newHeaders = new Headers(event.request.headers);
        newHeaders.set('Referer', 'https://mp.weixin.qq.com/'); // 添加自定义 Referer

        const newRequest = new Request(event.request, {
            headers: newHeaders
        });
        console.log("addEventListener", newHeaders)

        event.respondWith(fetch(newRequest));
    } else {
        // 其他请求直接放行
        event.respondWith(fetch(event.request));
    }
});
