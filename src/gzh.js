const { ResponseType: tauriResponse, Body, getClient } = parent.window.__TAURI__.http;

class AccessToken {
    constructor(appId, appSecret) {
        this.appId = appId;
        this.appSecret = appSecret;
        this.apiUrl = "https://api.weixin.qq.com/cgi-bin/token";
        this.accessToken = null;
        this.expiresIn = null;
    }

    /**
     * 获取 access_token
     * @returns {Promise<{access_token: string, expires_in: number}>}
     */
    async fetchAccessToken() {
        try {
            const client = await getClient();
            const response = await client.get(`${this.apiUrl}?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`, {
                responseType: tauriResponse.JSON
            });
            const data = await response.data;
            if (data.access_token) {
                this.accessToken = data.access_token;
                this.expiresIn = data.expires_in;
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

}

class WeChatMaterialUploader {
    constructor(accessToken) {
        this.accessToken = accessToken;
        this.apiUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${this.accessToken}`;
    }

    async uploadMaterial(type, file) {
        try {
            const filePart = await readBinaryFile(file);
            const body = Body.form({
                media: filePart
            });
            const client = await getClient();
            const response = await client.request({
                url: this.apiUrl + `&type=${type}`,
                method: 'POST',
                body: body,
                responseType: tauriResponse.JSON,
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            const data = await response.data;
            if (data.errcode) {
                throw new Error(`上传失败，错误码：${data.errcode}，错误信息：${data.errmsg}`);
            }
            return data;
        } catch (error) {
            throw error; // 抛出错误
        }
    }

    async uploadImage(file) {
        return this.uploadMaterial('image', file);
    }

}

function readBinaryFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            file: new Uint8Array(reader.result),
            mime: file.type,
            fileName: file.name,
        });
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}