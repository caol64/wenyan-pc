// import { resolveResource } from '@tauri-apps/api/path'
const { resolveResource } = window.__TAURI__.path;
// import { readTextFile } from '@tauri-apps/api/fs'
const { readTextFile } = window.__TAURI__.fs;
// import { appWindow } from '@tauri-apps/api/window'
const { appWindow } = window.__TAURI__.window;

// const { invoke } = window.__TAURI__.tauri;

// let greetInputEl;
// let greetMsgEl;
let theme = "themes/gzh_default.css";
let highlightStyle = "highlight/styles/github.min.css";
let previewMode = "style.css";
let content = "";
let isCopied = false
let isFootnotes = false

// async function greet() {
//   // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
//   greetMsgEl.textContent = await invoke("greet", { name: greetInputEl.value });
// }

// window.addEventListener("DOMContentLoaded", async () => {
//   try {
//     const resourcePath = await resolveResource('resources/example.md');
//     content = await readTextFile(resourcePath);
//     onUpdate();
//   } catch (error) {
//     console.error("Error reading file:", error);
//   }
// });

window.addEventListener('message', async (event) => {
  if (event.data) {
    if (event.data.type === "onReady") {
      try {
        const resourcePath = await resolveResource('resources/example.md');
        content = await readTextFile(resourcePath);
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
    } else if (event.data.type === "onChange") {
      content = event.data.value;
      onUpdate();
    }
  }
});

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