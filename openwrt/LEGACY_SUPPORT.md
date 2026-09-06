# OpenWrt 25.12 以下官方建置封存

狀態：**不納入官方預設建置與支援矩陣**（2026-09-06）

自 `openwrt-2.2.1-r24` 起，官方建置、測試與 Release 只針對使用 APK 套件管理器的
OpenWrt 25.12 以上版本。下列範圍已從現行專案支援矩陣移除：

- OpenWrt 24.10 與更早版本
- IPK／opkg 套件
- 舊版 OpenWrt SDK 的官方建置、安裝與實機回歸

原始碼仍保留。使用者可以使用相應舊版 SDK 自行嘗試產生 IPK，但需自行處理 package
metadata、Python 版本與 firewall4 差異；這不代表專案提供相容性、安全性、錯誤修正
或實機驗證。自行產生的 IPK 不應與 latest Release 的 APK 混用。

歷史 Release 中的舊 IPK 與 checksum 僅供重現既有部署及原始記錄，會原樣保留，不重建、
不編輯、不刪除。現行 README、建置流程、測試與 Release 只涵蓋 OpenWrt 25.12+ APK。
