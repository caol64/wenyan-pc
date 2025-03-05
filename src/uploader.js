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

class Uploader {
    async uploadImage(file) {
        let imageHost = getEnabledImageHost();
        if (!imageHost) {
            throw new Error('未启用图床');
        }
        if (imageHost.type === "gzh") {
            const uploader = new WechatUploader(imageHost);
            return await uploader.uploadImage(file);
        }
    }
}

class WechatUploader {
    constructor(imageHost) {
        this.tokenUrl = "https://api.weixin.qq.com/cgi-bin/token";
        this.apiUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material`;
        this.imageHost = imageHost;
    }

    async fetchAccessToken() {
        try {
            const response = await tauriFetch(`${this.tokenUrl}?grant_type=client_credential&appid=${this.imageHost.appId}&secret=${this.imageHost.appSecret}`);
            const data = await response.json();
            if (data.access_token) {
                return data;
            } else if (data.errcode) {
                throw new Error(`获取 Access Token 失败，错误码：${data.errcode}，${data.errmsg}`);
            } else {
                throw new Error(`获取 Access Token 失败: ${data}`);
            }
        } catch (error) {
            throw error;
        }
    }

    async uploadMaterial(type, file) {
        try {
            if (!(this.imageHost.accessToken && this.imageHost.expireTime > Date.now())) {
                const resp = await(this.fetchAccessToken());
                this.imageHost.accessToken = resp.access_token;
                this.imageHost.expireTime = Date.now() + resp.expires_in * 1000;
                let imageHosts = getCustomImageHosts();
                imageHosts[0] = this.imageHost;
                saveCustomImageHosts(imageHosts);
            }
            if (!this.imageHost.accessToken) {
                throw new Error('未获取到有效的Access Token');
            }
            const filePart = await file.arrayBuffer();
            const formData = new FormData();
            formData.append("media", new Blob([filePart]), file.name);
            const url = `${this.apiUrl}?access_token=${this.imageHost.accessToken}&type=${type}`;

            const response = await tauriFetch(url, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.errcode) {
                throw new Error(`上传失败，错误码：${data.errcode}，错误信息：${data.errmsg}`);
            }
            const result = data.url.replace("http://", "https://");
            deleteCache(result);
            return result;
        } catch (error) {
            throw error; // 抛出错误
        }
    }

    async uploadImage(file) {
        return this.uploadMaterial('image', file);
    }

}