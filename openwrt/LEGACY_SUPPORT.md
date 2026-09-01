# OpenWrt 25 以下支援封存

狀態：**已封存／不再支援**（2026-09-01）

自 `openwrt-2.2.1-r24` 起，Natter OpenWrt 整合只支援使用 APK 套件管理器的
OpenWrt 25.12 以上版本。下列範圍已從現行專案支援矩陣移除：

- OpenWrt 24.10 與更早版本
- IPK／opkg 套件
- 舊版 OpenWrt SDK 建置、安裝與實機回歸

歷史 Release 中可能仍可看到舊 IPK，僅供重現既有部署與原始記錄，不代表仍受支援；
不再提供相容性、安全性或錯誤修正，也不應與 latest Release 混用。現行 README、
建置流程、測試與 Release 只涵蓋 OpenWrt 25.12+ APK。
