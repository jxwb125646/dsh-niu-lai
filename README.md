# dsh-niu-lai 🐂🔊

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) Web plugin that brings the viral 《牛来》 movie meme to your agent sessions:

- **You send a message → the computer plays “妈妈”**
- **A task completes → the computer plays “牛来”**

All in-browser (Web Audio). No API keys, no external services, the clips ship embedded in the bundle.

[中文说明](README.zh.md)

## Install

```sh
# GitHub source (works today)
dsh plugin --profile web add github:jxwb125646/dsh-niu-lai

# npm (once published)
dsh plugin --profile web add dsh-niu-lai
```

Then restart `dsh web` and refresh the page.

## Configure

Open **Settings → Plugins → 牛来音效** (Niu Lai sounds):

- master on/off switch and volume slider
- per-clip **preview**, **replace** (pick any local audio file — stored in your browser, survives restarts), and **reset to default**

## How it works

The browser half watches every session's conversation snapshot:

- a new `user`/`steering` message node → plays the *Mama* clip
- a turn ends (finalized assistant message or terminal turn error) → plays the *Niu Lai* clip

Anti-spam guards: session open/history pagination/reconnect never trigger; each turn sounds once; nothing plays while a session is still loading. One clip at a time — a new sound interrupts the one still playing, so a fast reply's “牛来” cuts off a lingering “妈妈”.

Two notes: browsers require one click/keypress before audio unlocks (sending a message counts); every open page tab plays its own copy.

## Uninstall

```sh
dsh plugin --profile web remove dsh-niu-lai
```

## Building from source

The committed `lib/` is prebuilt against dsh 0.1.x. To rebuild:

```sh
npm install
npm run embed-audio   # assets/*.mp3 → src/client/assets.ts (base64 data URLs)
npm run build         # tsdown → lib/host.js + lib/client.js
```

The tsdown preset is vendored in `scripts/vendor/` (from `packages/client/tsdown.client.ts` in the dsh repo) so the build needs no dsh checkout.

## Audio attribution

The two default clips are the viral “妈妈” cow sound and “牛来” phrase from the movie 《牛来》. This is an unofficial fan project for personal entertainment — the movie audio is not covered by this repository's MIT license (see [NOTICE.md](NOTICE.md)), and you should not use it commercially. Replace the clips in Settings if you prefer your own recordings.

## License

Code: [MIT](LICENSE) · Audio: see [NOTICE.md](NOTICE.md)
