# dsh-niu-lai 🐂🔊

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）Web 端加的《牛来》热梗音效插件：

- **我发消息 → 电脑播放一声“妈妈”**
- **任务完成 → 电脑播放“牛来”**

全程浏览器内播放（Web Audio），不需要任何 API Key，两段音频直接内嵌在插件包里，开箱即响。

[English](README.md)

## 安装

```sh
# GitHub 源（现在就能装）
dsh plugin --profile web add github:jxwb125646/dsh-niu-lai

# 发布到 npm 后可以用短命令
dsh plugin --profile web add dsh-niu-lai
```

然后重启 `dsh web` 并刷新页面。

## 配置

打开 **设置 → 插件 → 牛来音效**：

- 总开关 + 音量滑块
- 每段音频可**试听**、**替换**（选本地音频文件，存在浏览器里，重启不丢）、**恢复默认**

## 触发逻辑

浏览器半面监听所有会话的对话快照：

- 出现新的用户消息节点（user / steering）→ 播“妈妈”
- 回合结束（助手消息定稿或回合错误终止）→ 播“牛来”

防误响设计：会话首次打开 / 翻历史 / 重连都不会触发；同一回合只响一次；会话加载中不响。

两点提示：浏览器需要先有一次点击/按键才解锁音频（发消息本身就够）；开多个页面标签的话每个标签都会响。

## 卸载

```sh
dsh plugin --profile web remove dsh-niu-lai
```

## 从源码构建

仓库里已提交针对 dsh 0.1.x 预构建的 `lib/`。如需重新构建：

```sh
npm install
npm run embed-audio   # assets/*.mp3 → src/client/assets.ts（base64 data URL）
npm run build         # tsdown → lib/host.js + lib/client.js
```

tsdown 预设已随仓库内置在 `scripts/vendor/`（源自 dsh 仓库的 `packages/client/tsdown.client.ts`），构建不需要 dsh 检出目录。

## 音频版权说明

内置两段音频是电影《牛来》里火出圈的“牛喊妈妈”原声与“牛来”台词，本项目是非官方粉丝自制、仅供个人娱乐；电影音频不适用本仓库的 MIT 许可（见 [NOTICE.md](NOTICE.md)），请勿商用。想换成自己的录音，在设置页直接替换即可。

## 许可

代码：[MIT](LICENSE) · 音频：见 [NOTICE.md](NOTICE.md)
