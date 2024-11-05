// import { resolveResource } from '@tauri-apps/api/path'
const { resolveResource } = window.__TAURI__.path;
// import { readTextFile } from '@tauri-apps/api/fs'
const { readTextFile, writeBinaryFile } = window.__TAURI__.fs;
// import { appWindow } from '@tauri-apps/api/window'
const { appWindow } = window.__TAURI__.window;

const { invoke } = window.__TAURI__.tauri;
const { save } = window.__TAURI__.dialog;
const { fetch, ResponseType } = window.__TAURI__.http;

// let greetInputEl;
// let greetMsgEl;
let theme = 'gzh_default';
let highlightStyle = 'highlight/styles/github.min.css';
let previewMode = 'style.css';
let content = '';
let isFootnotes = false;
let platform = 'gzh';
let leftReady = false;
let rightReady = false;

window.addEventListener('message', async (event) => {
    if (event.data) {
        if (event.data.type === 'onReady') {
            leftReady = true;
            load();
        } else if (event.data.type === 'onChange') {
            content = event.data.value;
            localStorage.setItem('lastArticle', content);
            onUpdate();
        } else if (event.data.type === 'onRightReady') {
            rightReady = true;
            load();
        } else if (event.data.type === 'leftScroll') {
            const iframe = document.getElementById('rightFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.scroll(event.data.value.y0);
        } else if (event.data.type === 'rightScroll') {
            const iframe = document.getElementById('leftFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.scroll(event.data.value.y0);
        } else if (event.data.clicked) {
            hideThemeOverlay();
            hideMenu();
        }
    }
});

async function load() {
    if (leftReady && rightReady) {
        try {
            let lastArticle = localStorage.getItem('lastArticle');
            if (!lastArticle) {
                const resourcePath = await resolveResource('resources/example.md');
                lastArticle = await readTextFile(resourcePath);
            }
            content = lastArticle;
            const iframe = document.getElementById('leftFrame');
            if (iframe) {
                const message = {
                    type: 'onUpdate',
                    value: content
                };
                iframe.contentWindow.postMessage(message, '*');
            }
            let gzhTheme = localStorage.getItem('gzhTheme');
            if (gzhTheme) {
                theme = gzhTheme;
            }
            document.getElementById(theme).classList.add('selected');
            onUpdate();
        } catch (error) {
            console.error('Error reading file:', error);
        }
    }
}

function onUpdate() {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onUpdate',
            content: content,
            theme: theme,
            highlightStyle: highlightStyle,
            previewMode: previewMode
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

function onContentChange() {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onContentChange',
            content: content
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

function onPeviewModeChange(button) {
    const useElement = button.querySelector('use');
    if (previewMode === 'style.css') {
        previewMode = 'desktop_style.css';
        useElement.setAttribute('href', '#mobileIcon');
    } else {
        previewMode = 'style.css';
        useElement.setAttribute('href', '#desktopIcon');
    }
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onPeviewModeChange',
            previewMode: previewMode
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

function onFootnoteChange(button) {
    isFootnotes = !isFootnotes;
    const useElement = button.querySelector('use');
    if (isFootnotes) {
        useElement.setAttribute('href', '#footnoteIcon');
        const iframe = document.getElementById('rightFrame');
        if (iframe) {
            const message = {
                type: 'onFootnoteChange'
            };
            iframe.contentWindow.postMessage(message, '*');
        }
    } else {
        useElement.setAttribute('href', '#footnoteIcon');
        onContentChange();
    }
}

function changePlatform(selectedPlatform) {
    hideThemeOverlay();
    if (selectedPlatform !== 'gzh') {
        document.getElementById('gzhThemeButton').style.display = 'none';
    } else {
        if (document.getElementById('gzhThemeButton').style.display === 'none') {
            document.getElementById('gzhThemeButton').style.display = '';
        }
    }
    platform = selectedPlatform;
    let selectedTheme = platform + '_default';
    if (platform === 'gzh') {
        let gzhTheme = localStorage.getItem('gzhTheme');
        if (gzhTheme) {
            selectedTheme = gzhTheme;
        }
    }
    changeTheme(selectedTheme);
}

async function onCopy(button) {
    const iframe = document.getElementById('rightFrame');
    const iframeWindow = iframe.contentWindow;
    let htmlValue = '';
    if (platform === 'gzh') {
        htmlValue = iframeWindow.getContentForGzh();
        const themeResponse = await fetch(`themes/${theme}.css`);
        const themeValue = await themeResponse.text();
        const resolvedTheme = replaceCSSVariables(themeValue);
        const hightlightPathResponse = await fetch(highlightStyle);
        const hightlightValue = await hightlightPathResponse.text();
        htmlValue = `${htmlValue}<style>${resolvedTheme}${hightlightValue}</style>`;
    } else if (platform === 'zhihu') {
        htmlValue = iframeWindow.getContentWithMathImg();
    } else if (platform === 'juejin') {
        htmlValue = iframeWindow.getPostprocessMarkdown();
    } else if (platform === 'medium') {
        htmlValue = iframeWindow.getContentForMedium();
    } else {
        htmlValue = iframeWindow.getContent();
    }
    if (platform === 'juejin') {
        await invoke('write_text_to_clipboard', { text: htmlValue });
    } else {
        await invoke('write_html_to_clipboard', { text: htmlValue });
    }
    const useElement = button.querySelector('use');
    useElement.setAttribute('href', '#checkIcon');
    setTimeout(() => {
        useElement.setAttribute('href', '#clipboardIcon');
    }, 1000);
}

function displayThemeOverlay() {
    const themeOverlay = document.getElementById('themeOverlay');
    themeOverlay.style.display = 'block';
}

function hideThemeOverlay() {
    const themeOverlay = document.getElementById('themeOverlay');
    themeOverlay.style.display = 'none';
}

function hideMenu() {
    const themeOverlay = document.getElementById('dropdown');
    themeOverlay.style.display = 'none';
}

function changeTheme(selectedTheme) {
    theme = selectedTheme;
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'setTheme',
            highlightStyle: highlightStyle,
            theme: theme
        };
        if (platform == 'zhihu') {
            delete message.highlightStyle;
        }
        iframe.contentWindow.postMessage(message, '*');
    }
    if (platform === 'gzh') {
        localStorage.setItem('gzhTheme', selectedTheme);
    }
}

function replaceCSSVariables(css) {
    // 正则表达式用于匹配变量定义，例如 --sans-serif-font: ...
    const variablePattern = /--([a-zA-Z0-9\-]+):\s*([^;]+);/g;
    // 正则表达式用于匹配使用 var() 的地方
    const varPattern = /var\(--([a-zA-Z0-9\-]+)\)/g;

    const cssVariables = {};

    // 1. 提取变量定义并存入字典
    let match;
    while ((match = variablePattern.exec(css)) !== null) {
        const variableName = match[1];
        const variableValue = match[2].trim();

        // 将变量存入字典
        cssVariables[variableName] = variableValue;
    }

    // 2. 递归解析 var() 引用为字典中对应的值
    function resolveVariable(value, variables, resolved = new Set()) {
        // 如果已经解析过这个值，则返回原始值以避免死循环
        if (resolved.has(value)) return value;

        resolved.add(value);
        let resolvedValue = value;

        // 解析变量
        let match;
        while ((match = varPattern.exec(resolvedValue)) !== null) {
            const varName = match[1];

            // 查找对应的变量值，如果变量引用另一个变量，递归解析
            if (variables[varName]) {
                const resolvedVar = resolveVariable(variables[varName], variables, resolved);
                resolvedValue = resolvedValue.replace(match[0], resolvedVar);
            }
        }
        return resolvedValue;
    }

    // 3. 替换所有变量引用
    for (const key in cssVariables) {
        const resolvedValue = resolveVariable(cssVariables[key], cssVariables);
        cssVariables[key] = resolvedValue;
    }

    // 4. 替换 CSS 中的 var() 引用
    let modifiedCSS = css;
    while ((match = varPattern.exec(css)) !== null) {
        const varName = match[1];

        // 查找对应的变量值
        if (cssVariables[varName]) {
            modifiedCSS = modifiedCSS.replace(match[0], cssVariables[varName]);
        }
    }

    return modifiedCSS;
}
function showMoreMenu() {
    const dropdown = document.getElementById('dropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function openAbout() {
    appWindow.emit('open-about');
}

async function exportLongImage(button) {
    const iframe = document.getElementById('rightFrame');
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    const clonedWenyan = iframeDocument.getElementById("wenyan").cloneNode(true);
    const images = clonedWenyan.querySelectorAll('img');
    const promises = Array.from(images).map(async (img, index) => {
        try {
            // 获取图片二进制数据
            const response = await fetch(img.src, {
                method: 'GET',
                responseType: ResponseType.Binary
            });
            const arrayBuffer = await response.data;

            // 将 ArrayBuffer 转换为 Base64 字符串
            const base64String = arrayBufferToBase64(arrayBuffer);
            const mimeType = response.headers['content-type'] || 'image/png'; // 获取 MIME 类型

            // 替换 img.src
            img.src = `data:${mimeType};base64,${base64String}`;
            // console.log(img.src);
            
        } catch (error) {
            console.error(`Failed to process image ${index}:`, error);
        }
    });
    Promise.all(promises).then(() => {
        clonedWenyan.classList.add("invisible");
        // console.log(clonedWenyan.outerHTML);
        iframeDocument.body.appendChild(clonedWenyan);
        html2canvas(clonedWenyan).then(canvas => {
            // 将 Canvas 转换为 JPEG 图像数据
            canvas.toBlob(async blob => {
                const filePath = await save({
                    filters: [{
                        name: 'Image',
                        extensions: ['jpeg']
                    }]
                });
                if (filePath) {
                    blob.arrayBuffer().then(async arrayBuffer => {
                        // console.log(arrayBuffer); // ArrayBuffer 内容
                        await writeBinaryFile(filePath, arrayBuffer);
                    });
                }
            }, 'image/jpeg', 0.9); // 0.9 表示 JPEG 压缩系数
            iframeDocument.body.removeChild(clonedWenyan);
        }).catch(error => {
            console.error('Error capturing with html2canvas:', error);
            iframeDocument.body.removeChild(clonedWenyan);
        });
    }).catch((error) => {
        console.error('An error occurred during the image processing:', error);
    });
    
}

// 将 ArrayBuffer 转换为 Base64 字符串的辅助函数
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createTheme() {}
