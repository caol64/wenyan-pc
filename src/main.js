// import { resolveResource } from '@tauri-apps/api/path'
const { resolveResource } = window.__TAURI__.path;
// import { readTextFile } from '@tauri-apps/api/fs'
const { readTextFile, writeBinaryFile } = window.__TAURI__.fs;
// import { appWindow } from '@tauri-apps/api/window'
const { appWindow } = window.__TAURI__.window;

const { invoke } = window.__TAURI__.tauri;
const { save } = window.__TAURI__.dialog;
const { fetch: tauriFetch, ResponseType } = window.__TAURI__.http;

const builtinThemes = [
    {
        id: "gzh_default",
        name: "默认",
        author: ""
    },
    {
        id: "orangeheart",
        name: "Orange Heart",
        author: "evgo2017"
    },
    {
        id: "rainbow",
        name: "Rainbow",
        author: "thezbm"
    },
    {
        id: "lapis",
        name: "Lapis",
        author: "YiNN"
    },
    {
        id: "pie",
        name: "Pie",
        author: "kevinzhao2233"
    },
    {
        id: "maize",
        name: "Maize",
        author: "BEATREE"
    },
    {
        id: "purple",
        name: "Purple",
        author: "hliu202"
    }
];

// let greetInputEl;
// let greetMsgEl;
let selectedTheme = 'gzh_default';
let highlightStyle = 'highlight/styles/github.min.css';
let previewMode = 'style.css';
let content = '';
let isFootnotes = false;
let platform = 'gzh';
let leftReady = false;
let rightReady = false;
let customThemeContent = '';
let selectedCustomTheme = '';

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
        } else if (event.data.type === 'onReadyCss') {
            loadCustomTheme();
        } else if (event.data.type === 'onChangeCss') {
            customThemeContent = event.data.value;
            updateThemePreview();
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
                selectedTheme = gzhTheme;
                if (gzhTheme.startsWith("customTheme")) {
                    const id = gzhTheme.replace("customTheme", "");
                    customThemeContent = await getCustomThemeById(id);
                }
            }
            document.getElementById(selectedTheme).classList.add('selected');
            onUpdate();
        } catch (error) {
            console.error('Error reading file:', error);
        }
    }
}

async function onUpdate() {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onUpdate',
            content: content,
            theme: selectedTheme,
            highlightStyle: highlightStyle,
            previewMode: previewMode,
            themeValue: customThemeContent,
            themeType: selectedTheme.startsWith("customTheme") ? "custom" : "builtin"
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

async function onContentChange() {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onContentChange',
            content: content
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}

async function onPeviewModeChange(button) {
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

async function onFootnoteChange(button) {
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

async function changePlatform(selectedPlatform) {
    hideThemeOverlay();
    if (selectedPlatform !== 'gzh') {
        document.getElementById('gzhThemeButton').style.display = 'none';
        document.getElementById('exportImageButton').style.display = 'none';
    } else {
        if (document.getElementById('gzhThemeButton').style.display === 'none') {
            document.getElementById('gzhThemeButton').style.display = '';
        }
        if (document.getElementById('exportImageButton').style.display === 'none') {
            document.getElementById('exportImageButton').style.display = '';
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
        let themeValue = '';
        if (selectedTheme.startsWith("customTheme")) {
            themeValue = customThemeContent;
        } else {
            const themeResponse = await fetch(`themes/${selectedTheme}.css`);
            themeValue = await themeResponse.text();
        }
        const resolvedTheme = replaceCSSVariables(themeValue);
        const hightlightPathResponse = await fetch(highlightStyle);
        const hightlightValue = await hightlightPathResponse.text();
        htmlValue = `${htmlValue}<style>${removeComments(resolvedTheme)}${removeComments(hightlightValue)}</style>`;
    } else if (platform === 'zhihu') {
        htmlValue = iframeWindow.getContentWithMathImg();
    } else if (platform === 'juejin') {
        htmlValue = iframeWindow.getPostprocessMarkdown();
    } else if (platform === 'medium') {
        htmlValue = iframeWindow.getContentForMedium();
    } else {
        htmlValue = iframeWindow.getContent();
    }
    // console.log(htmlValue);
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

async function changeTheme(theme) {
    selectedTheme = theme;
    if (selectedTheme.startsWith("customTheme")) {
        const id = selectedTheme.replace("customTheme", "");
        customThemeContent = await getCustomThemeById(id);
    }
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const message = {
            type: 'onUpdate',
            highlightStyle: highlightStyle,
            theme: selectedTheme,
            themeValue: customThemeContent,
            themeType: selectedTheme.startsWith("customTheme") ? "custom" : "builtin"
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

async function openAbout() {
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
            const response = await tauriFetch(img.src, {
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
    let elements = clonedWenyan.querySelectorAll("mjx-container");
    elements.forEach(element => {
        const svg = element.querySelector('svg');
        svg.style.width = svg.getAttribute("width");
        svg.style.height = svg.getAttribute("height");
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        const parent = element.parentElement;
        element.remove();
        parent.appendChild(svg);
        if (parent.classList.contains('block-equation')) {
            parent.setAttribute("style", "text-align: center; margin-bottom: 1rem;");
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

async function showCssEditor(customTheme) {
    const element = document.getElementById('btnDeleteTheme');
    if (element) {
        element.remove();
    }
    selectedCustomTheme = customTheme ? customTheme : '';
    const iframe = document.getElementById('cssLeftFrame');
    iframe.src = '/css_left.html';
    if (selectedCustomTheme) {
        const footer = document.getElementById('modalFooter');
        const btn = document.createElement("button");
        btn.setAttribute("id", "btnDeleteTheme");
        btn.classList.add("modal__btn", "modal__btn-delete");
        btn.addEventListener('click', () => deleteCustomTheme());
        btn.innerHTML = "删除";
        footer.insertBefore(btn, footer.firstChild);
    }
    MicroModal.show('modal-1');
    hideThemeOverlay();
}

async function loadCustomThemes() {
    const ul = document.getElementById('gzhThemeSelector');
    if (ul) {
        ul.innerHTML = '';
        builtinThemes.forEach(i => {
            const li = document.createElement("li");
            li.setAttribute("id", i.id);
            const span1 = document.createElement("span");
            span1.innerHTML = i.name;
            const span2 = document.createElement("span");
            span2.innerHTML = i.author;
            li.appendChild(span1);
            li.appendChild(span2);
            ul.appendChild(li);
        });
        await invoke('plugin:sql|load', {
            db: 'sqlite:data.db'
        });
        await invoke('plugin:sql|execute', {
            db: 'sqlite:data.db',
            query: `CREATE TABLE IF NOT EXISTS CustomTheme (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );
        `,
            values: []
        });
        const customThemes = await invoke('plugin:sql|select', {
            db: 'sqlite:data.db',
            query: 'SELECT * FROM CustomTheme',
            values: []
        });
        // console.log(customThemes);
        if (customThemes && customThemes.length > 0) {
            customThemes.forEach(i => {
                const li = document.createElement("li");
                li.setAttribute("id", `customTheme${i.id}`);
                const span1 = document.createElement("span");
                span1.innerHTML = `${i.name}`;
                const span2 = document.createElement("span");
                span2.innerHTML = `<svg width="12" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><use href="#editIcon"></use></svg>`;
                span2.addEventListener('click', () => showCssEditor(`${i.id}`));
                li.appendChild(span1);
                li.appendChild(span2);
                ul.appendChild(li);
            });
        }
        const listItems = ul.querySelectorAll('li');
        listItems.forEach(item => {
            item.addEventListener('click', function () {
                listItems.forEach(li => li.classList.remove('selected'));
                this.classList.add('selected');
                changeTheme(item.id);
            });
        });
        if (customThemes && customThemes.length < 3) {
            const li = document.createElement("li");
            li.setAttribute("id", "create-theme");
            li.classList.add("border-li");
            const span1 = document.createElement("span");
            span1.innerHTML = "创建新主题";
            const span2 = document.createElement("span");
            span2.innerHTML = `<svg width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><use href="#plusIcon"></use></svg>`;
            span2.addEventListener('click', () => showCssEditor());
            li.appendChild(span1);
            li.appendChild(span2);
            ul.appendChild(li);
        }
    }
}

async function saveCustomTheme() {
    if (selectedCustomTheme) {
        await invoke('plugin:sql|execute', {
            db: 'sqlite:data.db',
            query: 'UPDATE CustomTheme SET content = ?, createdAt = ? WHERE id = ?;',
            values: [customThemeContent, new Date().toISOString(), selectedCustomTheme]
        });
    } else {
        await invoke('plugin:sql|execute', {
            db: 'sqlite:data.db',
            query: 'INSERT INTO CustomTheme (name, content, createdAt) VALUES (?, ?, ?);',
            values: ['自定义主题', customThemeContent, new Date().toISOString()]
        });
    }
    MicroModal.close('modal-1');
    await loadCustomThemes();
    document.getElementById(selectedTheme).classList.add('selected');
    changeTheme(selectedTheme);
}

async function deleteCustomTheme() {
    if (selectedCustomTheme) {
        await invoke('plugin:sql|execute', {
            db: 'sqlite:data.db',
            query: 'DELETE FROM CustomTheme WHERE id = ?;',
            values: [selectedCustomTheme]
        });
    }
    MicroModal.close('modal-1');
    await loadCustomThemes();
    selectedTheme = "gzh_default";
    document.getElementById(selectedTheme).classList.add('selected');
    changeTheme(selectedTheme);
}

async function loadCustomTheme() {
    if (!selectedCustomTheme) {
        const theme = 'gzh_default';
        const themeResponse = await fetch(`themes/${theme}.css`);
        customThemeContent = await themeResponse.text();
    }
    
    const iframe = document.getElementById('cssLeftFrame');
    const iframeWindow = iframe.contentWindow;
    iframeWindow.setContent(customThemeContent);
}

async function getCustomThemeById(id) {
    const customTheme = await invoke('plugin:sql|select', {
        db: 'sqlite:data.db',
        query: 'SELECT * FROM CustomTheme WHERE id = ?;',
        values: [id]
    });
    if (customTheme && customTheme.length > 0) {
        return customTheme[0].content;
    }
    return null;
}

function removeComments(input) {
    // 正则表达式：匹配单行和多行注释
    const pattern = /(\/\/.*?$)|\/\*[\s\S]*?\*\//gm;

    // 使用正则表达式替换匹配的注释部分为空字符串
    const output = input.replace(pattern, '');

    // 返回去除了注释的字符串
    return output;
}

async function updateThemePreview() {
    const iframe = document.getElementById('cssRightFrame');
    const iframeWindow = iframe.contentWindow;
    iframeWindow.setCss(customThemeContent);
}