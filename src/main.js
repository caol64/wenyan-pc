/*
 * Copyright 2024 Lei Cao
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { resolveResource } = window.__TAURI__.path;
const { getCurrentWindow } = window.__TAURI__.window;
const { save, open, message } = window.__TAURI__.dialog;
const { writeHtml, writeText } = window.__TAURI__.clipboardManager;

const builtinThemes = [
    {
        id: 'gzh_default',
        name: '默认',
        author: ''
    },
    {
        id: 'orangeheart',
        name: 'Orange Heart',
        author: 'evgo2017'
    },
    {
        id: 'rainbow',
        name: 'Rainbow',
        author: 'thezbm'
    },
    {
        id: 'lapis',
        name: 'Lapis',
        author: 'YiNN'
    },
    {
        id: 'pie',
        name: 'Pie',
        author: 'kevinzhao2233'
    },
    {
        id: 'maize',
        name: 'Maize',
        author: 'BEATREE'
    },
    {
        id: 'purple',
        name: 'Purple',
        author: 'hliu202'
    },
    {
        id: 'phycat',
        name: '物理猫-薄荷',
        author: 'sumruler'
    }
];

// let greetInputEl;
// let greetMsgEl;
let selectedTheme = 'gzh_default';
let codeblockSettings = getCodeblockSettings();
let paragraphSettings = getParagraphSettings();
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
        } else if (event.data.type === 'onRightReady') {
            rightReady = true;
            load();
        } else if (event.data.type === 'onChange') {
            content = event.data.value;
            setLastArticle(content);
            onContentChange();
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
        } else if (event.data.type === 'onError') {
            await message(event.data.value);
        } else if (event.data.type === 'onHighlightChange') {
            codeblockSettings = event.data.value;
            onUpdate();
        } else if (event.data.type === 'onParagraphSettingsChange') {
            paragraphSettings = event.data.value;
            onUpdate();
        }
    }
});

async function load() {
    if (leftReady && rightReady) {
        try {
            let lastArticle = localStorage.getItem('lastArticle');
            if (!lastArticle) {
                const resourcePath = await resolveResource('resources/example.md');
                lastArticle = await readAsText(resourcePath);
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
                if (gzhTheme.startsWith('customTheme')) {
                    const id = gzhTheme.replace('customTheme', '');
                    customThemeContent = await getCustomThemeById(id);
                } else {
                    const themeResponse = await fetch(`themes/${selectedTheme}.css`);
                    customThemeContent = await themeResponse.text();
                }
            } else {
                const themeResponse = await fetch(`themes/${selectedTheme}.css`);
                customThemeContent = await themeResponse.text();
            }
            document.getElementById(selectedTheme).classList.add('selected');
            onUpdate();
        } catch (error) {
            console.error('Error reading file:', error);
            await message(`${error}`, 'Error reading file');
        }
    }
}

async function onUpdate() {
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const highlightResponse = await fetch(`highlight/styles/${codeblockSettings.hightlightTheme}.min.css`);
        const highlightCss = await highlightResponse.text();
        const message = {
            type: 'onUpdate',
            // content: content,
            highlightCss: highlightCss,
            previewMode: previewMode,
            themeValue: customThemeContent,
            codeblockSettings: codeblockSettings,
            paragraphSettings: platform === 'gzh' ? paragraphSettings : null
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

async function onAppearanceChange(button) {
    
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
    hideMenu();
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
        htmlValue = await iframeWindow.getContentForGzh();
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
        await writeText(htmlValue);
    } else {
        await writeHtml(htmlValue);
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
    const mainMenu = document.getElementById('mainMenu');
    mainMenu.style.display = 'none';
}

async function changeTheme(theme) {
    selectedTheme = theme;
    if (selectedTheme.startsWith('customTheme')) {
        const id = selectedTheme.replace('customTheme', '');
        customThemeContent = await getCustomThemeById(id);
    } else {
        const themeResponse = await fetch(`themes/${selectedTheme}.css`);
        customThemeContent = await themeResponse.text();
    }
    const iframe = document.getElementById('rightFrame');
    if (iframe) {
        const highlightThemePath = platform === 'gzh' ? `highlight/styles/${codeblockSettings.hightlightTheme}.min.css` : 'highlight/styles/github.min.css'
        const highlightResponse = await fetch(highlightThemePath);
        const highlightCss = await highlightResponse.text();
        const message = {
            type: 'onUpdate',
            highlightCss: highlightCss,
            themeValue: customThemeContent,
            codeblockSettings: platform === 'gzh' ? codeblockSettings : defaultCodeblockSettings,
            paragraphSettings: platform === 'gzh' ? paragraphSettings : null
        };
        iframe.contentWindow.postMessage(message, '*');
    }
    if (platform === 'gzh') {
        localStorage.setItem('gzhTheme', selectedTheme);
    }
}

function showMoreMenu() {
    const dropdown = document.getElementById('dropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    hideThemeOverlay()
}

function showMainMenu() {
    const dropdown = document.getElementById('mainMenu');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

async function openAbout() {
    getCurrentWindow().emit('open-about');
}

async function openSettings() {
    MicroModal.show('modal-settings');
    hideMenu()
}

async function exportLongImage() {
    const iframe = document.getElementById('rightFrame');
    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    const clonedWenyan = iframeDocument.getElementById('wenyan').cloneNode(true);
    const images = clonedWenyan.querySelectorAll('img');
    const promises = Array.from(images).map(async (img, index) => {
        try {
            if (!img.src.startsWith('data:')) {
                // 替换 img.src
                img.src = await downloadImage(img.src);
            }
        } catch (error) {
            console.error(`Failed to process image ${index}:`, error);
            await message(`${error}`, 'Error exporting image.');
        }
    });
    let elements = clonedWenyan.querySelectorAll('mjx-container');
    elements.forEach((element) => {
        const svg = element.querySelector('svg');
        svg.style.width = svg.getAttribute('width');
        svg.style.height = svg.getAttribute('height');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        const parent = element.parentElement;
        element.remove();
        parent.appendChild(svg);
        if (parent.classList.contains('block-equation')) {
            parent.setAttribute('style', 'text-align: center; margin-bottom: 1rem;');
        }
    });
    Promise.all(promises)
        .then(() => {
            clonedWenyan.classList.add('invisible');
            // console.log(clonedWenyan.outerHTML);
            iframeDocument.body.appendChild(clonedWenyan);
            html2canvas(clonedWenyan, {
                logging: false
            })
            .then((canvas) => {
                // 将 Canvas 转换为 JPEG 图像数据
                canvas.toBlob(
                    async (blob) => {
                        const filePath = await save({
                            filters: [
                                {
                                    name: 'Image',
                                    extensions: ['jpeg']
                                }
                            ]
                        });
                        if (filePath) {
                            blob.arrayBuffer().then(async (arrayBuffer) => {
                                // console.log(arrayBuffer); // ArrayBuffer 内容
                                await writeAsBinary(filePath, arrayBuffer);
                            });
                        }
                    },
                    'image/jpeg',
                    0.9
                ); // 0.9 表示 JPEG 压缩系数
                iframeDocument.body.removeChild(clonedWenyan);
            })
            .catch((error) => {
                console.error('Error capturing with html2canvas:', error);
                iframeDocument.body.removeChild(clonedWenyan);
                message(`${error}`, 'Error capturing with image');
            });
        })
        .catch((error) => {
            console.error('An error occurred during the image processing:', error);
            message(`${error}`, 'Error during the image processing');
        });
}

async function showCssEditor(customTheme) {
    const element = document.getElementById('btnDeleteTheme');
    if (element) {
        element.remove();
    }
    selectedCustomTheme = customTheme ? customTheme : '';
    const iframe = document.getElementById('cssLeftFrame');
    iframe.src = '/css_editor.html';
    if (selectedCustomTheme) {
        const footer = document.getElementById('footerButtonContainer');
        const btn = document.createElement('button');
        btn.setAttribute('id', 'btnDeleteTheme');
        btn.classList.add('modal__btn', 'modal__btn-delete');
        btn.addEventListener('click', () => deleteCustomTheme());
        btn.innerHTML = '删除';
        footer.insertBefore(btn, footer.firstChild);
    }
    MicroModal.show('modal-css-editor');
    hideThemeOverlay();
}

async function loadCustomThemes() {
    const ul = document.getElementById('gzhThemeSelector');
    if (ul) {
        ul.innerHTML = '';
        builtinThemes.forEach((i) => {
            const li = document.createElement('li');
            li.setAttribute('id', i.id);
            const span1 = document.createElement('span');
            span1.innerHTML = i.name;
            const span2 = document.createElement('span');
            span2.innerHTML = i.author;
            li.appendChild(span1);
            li.appendChild(span2);
            ul.appendChild(li);
        });
        await executeSql(`CREATE TABLE IF NOT EXISTS CustomTheme (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );
        `);
        const customThemes = await querySql('SELECT * FROM CustomTheme');
        // console.log(customThemes);
        if (customThemes && customThemes.length > 0) {
            customThemes.forEach((i, index) => {
                const li = document.createElement('li');
                li.setAttribute('id', `customTheme${i.id}`);
                const span1 = document.createElement('span');
                span1.innerHTML = `${i.name}`;
                const span2 = document.createElement('span');
                span2.innerHTML = `<svg width="12" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><use href="#editIcon"></use></svg>`;
                span2.addEventListener('click', () => showCssEditor(`${i.id}`));
                li.appendChild(span1);
                li.appendChild(span2);
                if (index === 0) {
                    li.classList.add('border-li');
                }
                ul.appendChild(li);
            });
            const height = calcHeight(customThemes.length);
            document.getElementById('themeOverlay').setAttribute("style", `height: ${height}px;`);
        } else {
            document.getElementById('themeOverlay').removeAttribute("style");
        }
        const listItems = ul.querySelectorAll('li');
        listItems.forEach((item) => {
            item.addEventListener('click', function () {
                listItems.forEach((li) => li.classList.remove('selected'));
                this.classList.add('selected');
                changeTheme(item.id);
            });
        });
        if (customThemes && customThemes.length < 3) {
            const li = document.createElement('li');
            li.setAttribute('id', 'create-theme');
            li.classList.add('border-li');
            const span1 = document.createElement('span');
            span1.innerHTML = '创建新主题';
            const span2 = document.createElement('span');
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
        await executeSql('UPDATE CustomTheme SET content = $1, createdAt = $2 WHERE id = $3;',
            [customThemeContent, new Date().toISOString(), selectedCustomTheme]
        );
    } else {
        await executeSql('INSERT INTO CustomTheme (name, content, createdAt) VALUES ($1, $2, $3);',
            ['自定义主题', customThemeContent, new Date().toISOString()]
        );
    }
    MicroModal.close('modal-css-editor');
    await loadCustomThemes();
    document.getElementById(selectedTheme).classList.add('selected');
    changeTheme(selectedTheme);
}

async function deleteCustomTheme() {
    if (selectedCustomTheme) {
        await executeSql('DELETE FROM CustomTheme WHERE id = $1;',
            [selectedCustomTheme]
        );
    }
    MicroModal.close('modal-css-editor');
    await loadCustomThemes();
    selectedTheme = 'gzh_default';
    document.getElementById(selectedTheme).classList.add('selected');
    changeTheme(selectedTheme);
}

async function loadCustomTheme() {
    if (!selectedCustomTheme) {
        if (selectedTheme) {
            if (selectedTheme.startsWith('customTheme')) {
                const id = selectedTheme.replace('customTheme', '');
                customThemeContent = await getCustomThemeById(id);
            } else {
                const themeResponse = await fetch(`themes/${selectedTheme}.css`);
                customThemeContent = await themeResponse.text();
            }
        } else {
            const theme = 'gzh_default';
            const themeResponse = await fetch(`themes/${theme}.css`);
            customThemeContent = await themeResponse.text();
        }
    }

    const iframe = document.getElementById('cssLeftFrame');
    const iframeWindow = iframe.contentWindow;
    iframeWindow.setContent(customThemeContent);
}

async function getCustomThemeById(id) {
    const customTheme = await querySql('SELECT * FROM CustomTheme WHERE id = $1;',
        [id]
    );
    if (customTheme && customTheme.length > 0) {
        return customTheme[0].content;
    }
    return null;
}

async function updateThemePreview() {
    const iframe = document.getElementById('cssRightFrame');
    const iframeWindow = iframe.contentWindow;
    iframeWindow.setCss(customThemeContent);
}

async function openMarkdownFile() {
    const selected = await open({
        multiple: false,
        filters: [
            {
                name: 'Markdown',
                extensions: ['md', 'markdown']
            }
        ]
    });
    
    if (selected) {
        try {
            const fileContent = await readAsText(selected);
            const iframe = document.getElementById('leftFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.setContent(fileContent);
        } catch (error) {
            console.error("Error reading file:", error);
            await message(`${error}`, '文件读取失败');
        }
    }
}

async function openCssFile() {
    const selected = await open({
        multiple: false,
        filters: [
            {
                name: 'Stylesheet',
                extensions: ['css']
            }
        ]
    });
    
    if (selected) {
        try {
            const fileContent = await readAsText(selected);
            const iframe = document.getElementById('cssLeftFrame');
            const iframeWindow = iframe.contentWindow;
            iframeWindow.loadCss(fileContent);
        } catch (error) {
            console.error("Error reading file:", error);
            await message(`${error}`, '文件读取失败');
        }
    }
}

const helpButton = document.getElementById('helpButton');
const bubbleBox = document.getElementById('bubbleBox');
let hideTimeout;
helpButton.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
    bubbleBox.style.display = 'block';
});

helpButton.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
        bubbleBox.style.display = 'none';
    }, 200);
});

bubbleBox.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
});

bubbleBox.addEventListener('mouseleave', () => {
    bubbleBox.style.display = 'none';
});

function calcHeight(customThemeCount) {
    return 240 + (Math.min(customThemeCount, 2) * 25);
}

async function saveSettings() {
    const iframe = document.getElementById("settingsFrame");
    await iframe.contentWindow.saveSettings();
    await message("保存成功");
}