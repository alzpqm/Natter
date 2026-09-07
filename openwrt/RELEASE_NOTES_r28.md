# OpenWrt 2.2.1-r28

本版修正套件內 Natter 核心的映射可用性問題，核心與 LuCI 套件版本同步為 r28。
LuCI 介面沿用 r26，不修改既有映射設定。

## 核心修正

- **STUN 回應驗證**：檢查交易識別碼、訊息類型、magic cookie、長度與位址屬性，
  避免將不相符或不完整的封包當成有效映射；支援 TCP 分段接收與屬性補齊位元組，
  優先採用 XOR-MAPPED-ADDRESS，保留舊式 MAPPED-ADDRESS 相容性。
- **啟動與重新連線**：保活伺服器暫時無法連線時，在同一工作程序內重試，
  避免耗盡 procd 的重新啟動次數。區分綁定位址失效與 TCP 連線暫時衝突，
  不再僅依 `EADDRNOTAVAIL` 就判定 WAN 位址已變更。
- **STUN 暫時失聯**：已建立映射的定期探測改成每輪單次嘗試，
  不再因 STUN 的無限重試而停止保活；持續輪替伺服器，並限制重複日誌。
- **接收期限**：STUN TCP 重組與 TCP／UDP 保活採用絕對接收期限，
  防止持續傳入資料使迴圈無限等待。
- **即時日誌**：各等級訊息立即送出，避免程序退出時才集中顯示先前的緩衝日誌。
- **升級完整生效**：將核心檔案納入 procd 的雜湊比對，避免套件更新後，
  啟動參數相同的舊工作程序仍繼續執行舊核心。

這些修正針對映射失效、啟動失敗與阻塞風險；沒有將其宣稱為遠端程式碼執行漏洞。
STUN 封包驗證不等同伺服器身分驗證，仍應使用可信任的 STUN 端點。
協定依據：[STUN RFC 8489](https://www.rfc-editor.org/rfc/rfc8489.html)。

## 驗證

- 24 項核心網路回歸、4 項 STUN 韌性測試與 3 項真實回環連線測試通過。
- 升級後逐一確認工作程序已換代；約 9 小時後複查，16 個工作程序與映射維持正常。
- 兩條 NAT WAN 的外部 HTTP、SSH 及 UDP 雙向資料回覆通過，既有設定保持不變。
- 原有介面事件、服務狀態、映射狀態與 LuCI 回歸測試通過。

## 安裝

官方僅提供 OpenWrt 25.12 以上的 APK；`mwan3` 仍為可選整合，不是套件依賴。
低於 25.12 的版本可自行使用相應 SDK 編譯，不納入本版測試；歷史 IPK 原樣保留。

```sh
(
rm -f /tmp/natter_openwrt_release /tmp/natter.apk /tmp/luci-app-natter.apk
apk update && apk add luci luci-base luci-compat || exit 1
curl -fL --retry 2 https://api.github.com/repos/alzpqm/Natter/releases/latest -o /tmp/natter_openwrt_release || exit 1
core_url=$(jsonfilter -i /tmp/natter_openwrt_release -e '@.assets[*].browser_download_url' | grep -E '/natter-[^/]+\.apk$' | head -n1)
luci_url=$(jsonfilter -i /tmp/natter_openwrt_release -e '@.assets[*].browser_download_url' | grep -E '/luci-app-natter-[^/]+\.apk$' | head -n1)
[ -n "$core_url" ] && curl -fL --retry 2 "$core_url" -o /tmp/natter.apk || { echo "無法下載 Natter APK"; exit 1; }
[ -n "$luci_url" ] && curl -fL --retry 2 "$luci_url" -o /tmp/luci-app-natter.apk || { echo "無法下載 LuCI APK"; exit 1; }
apk add --force-overwrite --clean-protected --allow-untrusted --no-chown /tmp/natter.apk /tmp/luci-app-natter.apk
)
```

## 套件

- `natter-2.2.1-r28.apk`
- `luci-app-natter-2.2.1-r28.apk`
- `SHA256SUMS-openwrt-2.2.1-r28`
