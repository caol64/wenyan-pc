// import { resolveResource } from '@tauri-apps/api/path'
const { resolveResource } = window.__TAURI__.path;
// import { readTextFile } from '@tauri-apps/api/fs'
const { readTextFile } = window.__TAURI__.fs;
// import { appWindow } from '@tauri-apps/api/window'
const { appWindow } = window.__TAURI__.window;

const { invoke } = window.__TAURI__.tauri;

// let greetInputEl;
// let greetMsgEl;
let theme = "themes/gzh_default.css";
let highlightStyle = "highlight/styles/github.min.css";
let previewMode = "style.css";
let content = "";
let isFootnotes = false;
let platform = "gzh";
let leftReady = false;
let rightReady = false;

window.addEventListener('message', async (event) => {
  if (event.data) {
    if (event.data.type === "onReady") {
      leftReady = true;
      load();
    } else if (event.data.type === "onChange") {
      content = event.data.value;
      localStorage.setItem("lastArticle", content);
      onUpdate();
    } else if (event.data.type === "onRightReady") {
      rightReady = true;
      load();
    } else if (event.data.type === "leftScroll") {
      const iframe = document.getElementById('rightFrame');
      const iframeWindow = iframe.contentWindow;
      iframeWindow.scroll(event.data.value.y0);
    } else if (event.data.type === "rightScroll") {
      const iframe = document.getElementById('leftFrame');
      const iframeWindow = iframe.contentWindow;
      iframeWindow.scroll(event.data.value.y0);
    }
  }
});

async function load() {
  if (leftReady && rightReady) {
    try {
      let lastArticle = localStorage.getItem("lastArticle");
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
      onUpdate();
    } catch (error) {
      console.error("Error reading file:", error);
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
      previewMode: previewMode,
    };
    iframe.contentWindow.postMessage(message, '*');
  }
}

function onContentChange() {
  const iframe = document.getElementById('rightFrame');
  if (iframe) {
    const message = {
      type: 'onContentChange',
      content: content,
    };
    iframe.contentWindow.postMessage(message, '*');
  }
}

function onPeviewModeChange(button) {
  const useElement = button.querySelector('use');
  if (previewMode === "style.css") {
    previewMode = "desktop_style.css";
    useElement.setAttribute('href', '#mobileIcon');
  } else {
    previewMode = "style.css";
    useElement.setAttribute('href', '#desktopIcon');
  }
  const iframe = document.getElementById('rightFrame');
  if (iframe) {
    const message = {
      type: 'onPeviewModeChange',
      previewMode: previewMode,
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
  platform = selectedPlatform;
  const iframe = document.getElementById('rightFrame');
  if (iframe) {
    const message = {
      type: 'setTheme',
      highlightStyle: highlightStyle,
      platform: platform
    };
    iframe.contentWindow.postMessage(message, '*');
  }
}

async function onCopy(button) {
  const iframe = document.getElementById('rightFrame');
  const iframeWindow = iframe.contentWindow;
  let htmlValue = "";
  if (platform === "gzh") {
    htmlValue = iframeWindow.getContentWithMathSvg();
    const themeResponse = await fetch(theme);
    const themeValue = await themeResponse.text();
    const hightlightPathResponse = await fetch(highlightStyle);
    const hightlightValue = await hightlightPathResponse.text();
    htmlValue = `${htmlValue}<style>${themeValue}${hightlightValue}</style>`;
  } else if (platform === "zhihu") {
    htmlValue = iframeWindow.getContentWithMathImg();
  } else if (platform === "juejin") {
    htmlValue = iframeWindow.getPostprocessMarkdown();
  } else {
    htmlValue = iframeWindow.getContent();
  }
  if (platform === "juejin") {
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