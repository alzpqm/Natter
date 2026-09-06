# OpenWrt 2.2.1-r26

本版只調整 LuCI 主題相容性與公開文件；Natter 核心映射、multi-WAN、STUN、procd
與 firewall4 邏輯沿用已通過實機驗證的 r25。

## LuCI 夜間模式

- 改用 LuCI Bootstrap 的背景、文字、邊框、成功、警告及錯誤主題變數。
- 加入 `data-darkmode="true"` 的 fallback 色彩，避免缺少主題變數時出現白底白字。
- 修正健康摘要、狀態標籤、結果 chip、runtime 表格與手機卡片在深色模式下的可讀性。
- 保留手機版 44px 觸控按鈕、窄螢幕單欄與長端點換行行為。

## 文件與版本政策

- 根目錄 README 與一般文件改為正體中文，保留 CLI、協定與原始碼識別字。
- 明確說明 OpenWrt 25.12+ 才有官方 APK、CI、實機測試與支援。
- 低於 25.12 的版本仍可使用相應舊版 SDK 自行編譯，但不屬於官方支援。
- 歷史 Release 的 IPK 與 checksum 原樣保留，不重建、不編輯。

## 套件

- `natter-2.2.1-r26.apk`
- `luci-app-natter-2.2.1-r26.apk`
- `SHA256SUMS-openwrt-2.2.1-r26`

本版不包含 IPK，也不依賴 `mwan3`。
