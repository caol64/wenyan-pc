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

const { fetch: tauriFetch } = window.parent.__TAURI__.http;
const { readTextFile, writeBinaryFile } = window.parent.__TAURI__.fs;
const { open: openShell } = window.parent.__TAURI__.shell;
const imgType = ['image/bmp', 'image/png', 'image/jpeg', 'image/gif', 'video/mp4'];

const highlightThemes = [
    {
        id: 'atom-one-dark'
    },
    {
        id: 'atom-one-light'
    },
    {
        id: 'dracula'
    },
    {
        id: 'github-dark'
    },
    {
        id: 'github'
    },
    {
        id: 'monokai'
    },
    {
        id: 'solarized-dark'
    },
    {
        id: 'solarized-light'
    },
    {
        id: 'xcode'
    }
];

const gzhImageHost = {
    type: 'gzh',
    appId: '',
    appSecret: '',
    accessToken: '',
    expireTime: 0,
    isEnabled: false
};
const defaultImageHosts = [gzhImageHost];

const defaultCodeblockSettings = {
    isMacStyle: false,
    hightlightTheme: 'github',
    fontSize: '12px',
    fontFamily: null
};

const cache = {};

function setCache(key, value) {
    cache[key] = value;
}

function getCache(key) {
    return cache[key];
}

function deleteCache(key) {
    delete cache[key];
}

async function downloadImage(src) {
    const cached = getCache(src);
    if (cached) {
        return cached;
    }
    // 获取图片二进制数据
    const response = await tauriFetch(src);
    const arrayBuffer = await response.arrayBuffer();

    // 将 ArrayBuffer 转换为 Base64 字符串
    const base64String = arrayBufferToBase64(arrayBuffer);
    const mimeType = response.headers['content-type'] || 'image/png'; // 获取 MIME 类型

    const result = `data:${mimeType};base64,${base64String}`;
    setCache(src, result);
    return result;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function getCustomImageHosts() {
    let imageHosts = localStorage.getItem('customImageHosts');
    if (imageHosts) {
        imageHosts = JSON.parse(imageHosts);
    } else {
        imageHosts = defaultImageHosts;
    }
    return imageHosts;
}

function saveCustomImageHosts(imageHosts) {
    localStorage.setItem('customImageHosts', JSON.stringify(imageHosts));
}

function getEnabledImageHost() {
    const imageHosts = getCustomImageHosts();
    if (imageHosts) {
        for (const e of imageHosts) {
            if (e && e.isEnabled) {
                return e;
            }
        }
    }
    return null;
}

async function readAsText(resourcePath) {
    return await readTextFile(resourcePath);
}

async function writeAsBinary(filePath, arrayBuffer) {
    await writeBinaryFile(filePath, arrayBuffer);
}

async function setLastArticle(content) {
    localStorage.setItem('lastArticle', content);
}

async function handleImages(container) {
    container.querySelectorAll('img').forEach(async (element) => {
        const dataSrc = element.getAttribute('src');
        if (dataSrc && dataSrc.startsWith('https://mmbiz.qpic.cn')) {
            element.setAttribute('data-src', dataSrc);
            element.src = await downloadImage(dataSrc);
        }
    });
}

function revertImages(container) {
    container.querySelectorAll('img').forEach(async (element) => {
        const dataSrc = element.getAttribute('data-src');
        if (dataSrc && dataSrc.startsWith('https://mmbiz.qpic.cn')) {
            element.src = dataSrc;
        }
    });
}

document.querySelectorAll('.external-link').forEach((link) => {
    link.addEventListener('click', async (event) => {
        event.preventDefault();
        await openShell(link.href);
    });
});

function stringToMap(str) {
    const map = new Map();
    if (str) {
        const keyValuePairs = str.trim().split(' ');
        for (const pair of keyValuePairs) {
            const [key, value] = pair.split('=');
            if (key && value) {
                map.set(key, value);
            }
        }
    }
    return map;
}

function getCodeblockSettings() {
    let codeblockSettings = localStorage.getItem('codeblockSettings');
    if (codeblockSettings) {
        codeblockSettings = JSON.parse(codeblockSettings);
    } else {
        codeblockSettings = defaultCodeblockSettings;
    }
    return codeblockSettings;
}

function saveCodeblockSettings(codeblockSettings) {
    localStorage.setItem('codeblockSettings', JSON.stringify(codeblockSettings));
}

function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
        return '';
    }
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
        return '';
    }
    return filename.slice(lastDotIndex + 1);
}
