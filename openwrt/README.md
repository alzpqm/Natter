# Natter for OpenWrt（多 WAN／可選 mwan3 隔離版）

這個目錄是一個可直接放入 OpenWrt 25.12+ source tree 或 SDK 的 APK package。
它固定使用 Natter 2.2.1；`mwan3` 是可選整合，不是
套件依賴。安裝 mwan3 時可為每條 WAN 啟動獨立的
TCP／UDP Natter 實例，也可用一個設定同時啟動彼此獨立的 TCP + UDP 映射。

> 自 `openwrt-2.2.1-r24` 起，只支援 OpenWrt 25.12 以上 APK。OpenWrt 24.10
> 與更早版本及 IPK／opkg 已停止支援並封存，不再建置或測試。請參閱
> [`LEGACY_SUPPORT.md`](LEGACY_SUPPORT.md)。

## 設計重點

- 每個實例對應一個 OpenWrt logical interface，例如 `wan`、`wan2`。
- UDP Natter socket 與內建 DNS 查詢會綁定指定 L3 device；TCP 會綁定該 WAN
  的來源 IPv4。安裝 mwan3 且啟用隔離時，套件會依 mwan3 的 `mmx_mask` 計算
  該介面的實際 route mark（不是把遮罩本身誤當成 mark），因此不會被負載平衡
  或 failover 改送到其他 WAN。
- 內建 DNS 查詢使用相同的 WAN device 與該介面的 route mark（未安裝 mwan3 時
  使用一般路由、不設 mark），不呼叫 `mwan3 use`，因此不會被 mwan3 wrapper 的
  舊來源 IP 快取或 `LD_PRELOAD` fd 狀態干擾。
- Natter 長駐程序與公網探測使用 `nogroup`（GID 65534）建立 socket。OpenClash 的
  路由器本機輸出規則會把這個群組視為 DIRECT，因此不會把 TCP STUN 重導至本機
  代理後再由代理重新選擇 WAN；程序仍保留 root UID，以便設定 socket mark 與裝置。
- 啟動時會把已啟用映射的固定內部埠合併到 Linux
  `net.ipv4.ip_local_reserved_ports`，避免 Clash 等長駐程式把這些埠隨機選為臨時
  UDP 來源埠。既有的系統保留值會保留，停用全域 Natter 後會移除由 Natter 新增的值。
- 啟動前先透過該 WAN 原生 socket 向 `119.29.29.29` 查詢 STUN／keepalive 網域，
  再把 IPv4 數字位址交給 Natter。這可避開本機代理的 fake-IP DNS，也避免 Natter
  程序內再次查 DNS。
- TCP 預設只使用 `turn.cloud-rtc.com:80`；UDP 預設使用小米、B 站、芒果 TV、
  鬥魚的中國大陸 STUN 端點。
- package patch 新增 `--no-port-test`，停用上游 TCP 模式對 `ifconfig.co` 和
  Transmission port-check 的連線，確保 public mapping 探測只使用設定的 STUN。
- `bind_port` 必須固定。上游 NAT 可能映射成另一個 public port；Natter 取得 public
  mapping 後，firewall4 會把抵達固定內部埠的封包 DNAT 到 `target_ip:target_port`。
- 轉送保留訪客來源 IP；目標主機的預設閘道必須回到這台 OpenWrt 路由器。

## 建置

把核心 package 與內附的 LuCI package 複製到 OpenWrt source tree：

```sh
cp -a natter-openwrt /path/to/openwrt/package/network/services/natter
cd /path/to/openwrt
make menuconfig
```

`luci-app-natter` 已包含在此目錄中，OpenWrt 的 package 掃描會一併找到它；不要再把
子目錄複製第二份，以免出現重複 package 定義。

在 `Network -> Routing and Redirection` 選擇 `natter`，並選擇
`LuCI -> Applications -> luci-app-natter`，然後建置：

```sh
make package/natter/compile V=s
make package/natter/luci-app-natter/compile V=s
```

現行建置只以 OpenWrt 25.12+ SDK 產生 `.apk`。package 依賴 `python3-light` 與
`firewall4`；`mwan3` 僅在需要多 WAN 隔離時才安裝。不要使用舊 SDK 產生 IPK。

### 從 GitHub Release 安裝

以下指令會讀取 Fork 的 latest Release；請先確認裝置能連線 GitHub API。目前發布
版本為 `openwrt-2.2.1-r24`，latest Release 只提供 OpenWrt 25.12+ APK。

OpenWrt 25.12 以上：

```sh
rm -f /tmp/natter_openwrt_release /tmp/natter.apk /tmp/luci-app-natter.apk
apk update
apk add luci luci-base luci-compat
curl -fL --retry 2 https://api.github.com/repos/alzpqm/Natter/releases/latest -o /tmp/natter_openwrt_release
core_url=$(jsonfilter -i /tmp/natter_openwrt_release -e '@.assets[*].browser_download_url' | grep -E '/natter-[^/]+\.apk$' | head -n1 || true)
luci_url=$(jsonfilter -i /tmp/natter_openwrt_release -e '@.assets[*].browser_download_url' | grep -E '/luci-app-natter-[^/]+\.apk$' | head -n1 || true)
[ -n "$core_url" ] && curl -fL --retry 2 "$core_url" -o /tmp/natter.apk || { echo "Natter APK latest version get failed"; exit 1; }
[ -n "$luci_url" ] && curl -fL --retry 2 "$luci_url" -o /tmp/luci-app-natter.apk || { echo "luci-app-natter APK latest version get failed"; exit 1; }
apk add --force-overwrite --clean-protected --allow-untrusted --no-chown /tmp/natter.apk /tmp/luci-app-natter.apk
```

安裝 `luci-app-natter` 後，頁面位於 **Services → Natter**。首次安裝的全域開關
預設關閉；建立並檢查 mapping 後再於頁面啟用，因此不會因安裝套件立即開放任何連入埠。
頁面上方的 **WAN 公網位址** 面板會自動逐一檢查每個不重複的 WAN；已安裝
mwan3 時使用其介面清單，未安裝時改用已啟用 mapping 所選的 WAN，
顯示 L3 裝置、WAN IPv4、公網 IPv4 與是否經過 NAT；也可按 **探測所有 WAN**
重新檢查。探測使用各 WAN 獨立路由的中國大陸 UDP STUN，不會新增任何入站防火牆規則。
**已設定的內部埠** 面板會用與 Natter 相同的裝置綁定、socket mark 與
`SO_REUSEPORT` 選項檢查埠；若被 uhttpd 等本機服務占用，會顯示衝突，而且該協定
不會產生 firewall4 規則。最上方的 **執行狀態** 會把每個協定實例完整列出，
包含尚在探測的 Waiting、成功的 Mapped 與具體錯誤，不需要在固定高度的文字框中捲動。
在 700px 以下的手機畫面，執行狀態、公網 IP、埠檢查與映射設定表都會自動改為
逐筆卡片，避免欄位重疊或產生橫向捲動。

## 多 WAN 設定

先確認 `/etc/config/network` 有 `wan`、`wan2` 等 logical interface。若使用 mwan3
隔離，再確認 `/etc/config/mwan3` 也有同名介面；未安裝 mwan3 時不需要建立該檔案。
`interface` 填 logical interface 名稱，不要填 `pppoe-wan` 或 `eth1` 這類實體
device 名稱。

編輯 `/etc/config/natter`。以下範例同時在 `wan` 建 TCP mapping、在 `wan2` 建
UDP mapping：

```uci
config globals 'globals'
	option enabled '1'
	option mwan3_isolation '1'
	option dns_server '119.29.29.29'

config instance 'wan_tcp'
	option enabled '1'
	option interface 'wan'
	option protocol 'tcp'
	option bind_port '40001'
	option target_ip '192.168.1.100'
	option target_port '443'
	option interval '15'
	option keepalive_server 'www.baidu.com:80'
	list stun_server 'turn.cloud-rtc.com:80'

config instance 'wan2_udp'
	option enabled '1'
	option interface 'wan2'
	option protocol 'udp'
	option bind_port '40002'
	option target_ip '192.168.1.101'
	option target_port '51820'
	option interval '15'
	option keepalive_server '119.29.29.29:53'
	list stun_server 'stun.miwifi.com:3478'
	list stun_server 'stun.chat.bilibili.com:3478'
	list stun_server 'stun.hitv.com:3478'
	list stun_server 'stun.douyucdn.cn:18000'
```

同一條 WAN、同一協定的 `bind_port` 不可重複。TCP 與 UDP 可以使用相同的數字埠。
`option protocol 'both'` 是 LuCI 的便利設定：它會在同一個內部數字埠分別啟動 TCP
與 UDP 實例及規則。兩個協定的 NAT 狀態完全獨立，因此 public port 也可能不同。
`bind_port` 是路由器在該 WAN 上使用的內部綁定埠；實際公網埠由上游 NAT
分配，可能完全不同。STUN 只能查出已分配的埠，無法要求營運商 CGNAT 分配指定值；
只有上游明確支援 PCP、NAT-PMP 或 UPnP 時才可能申請偏好的 public port。
`bind_port` 必須是路由器尚未使用的埠；若目標服務就在路由器上，不可直接填該服務
正在監聽的埠。例如 LuCI 監聽 `33003/TCP` 時，可用 `46321` 作為 bind port，
再把 target 設為 `192.168.1.1:33003`。
若服務就在 OpenWrt 本機，`target_ip` 請填路由器的一個實際 IPv4 位址，例如 LAN IP，
不要填 `127.0.0.1`。

套用設定：

```sh
/etc/init.d/natter enable
/etc/init.d/natter restart
```

介面 up/down 或 IP 改變時，procd trigger 會重建該組 firewall4 規則並重啟實例。
選定 WAN 失效時，該實例會失敗並等待介面恢復，不會偷偷 fail over 到另一條 WAN。

## 查看 mapping 與除錯

在管理端可用共享 SSH alias 執行唯讀健康檢查；它會同時計算映射、埠檢查、公網探測、mwan3 mark、資源與錯誤摘要：

```sh
./health-check.sh
```

```sh
natterctl status
natterctl probe-all
natterctl check-config
logread -e natter
natterctl firewall
mwan3 status
```

`natterctl probe-all` 會輸出 JSON，適合 LuCI 或其他監控程式使用。已安裝並啟用
mwan3 隔離時，每個 WAN 的 DNS 與 UDP STUN socket 都綁定對應 device，TCP STUN／
keepalive 綁定對應來源 IPv4，並使用該介面的 mwan3 route mark；未安裝 mwan3 時
則使用一般 WAN 路由。程序與探測 socket 另使用 OpenClash 相容的 DIRECT 群組，
避免路由器本機透明代理取代原連線。若其他代理不支援 GID 65534 bypass，才需另外
將 STUN 與 keepalive 設為 DIRECT。
`natterctl check-config` 也輸出 JSON，逐一回報已啟用 mapping 的 TCP／UDP bind port
是否可用。啟動失敗時 `natterctl status` 會保留 `status=error` 與具體錯誤，不再只
消失於 mapping 清單。

成功時 `natterctl status` 會顯示：

```text
public=203.0.113.20:51234
target=192.168.1.100:443
```

也會送出 `natter.mapping` ubus event。若設定 `option hook_script`，腳本會收到：

```text
protocol mapped-inside-ip mapped-inside-port public-ip public-port
```

通知／hook 子程序會保留 `NATTER_INTERFACE` 等介面資訊，但為避免本機 `ubus`
socket 被 mwan3 wrapper 誤綁，會移除 `LD_PRELOAD`。hook 若要自行連外，請明確使用
支援 `SO_BINDTODEVICE`／`SO_MARK` 的工具固定出口；不要假定一般命令會沿用 Natter
程序的 socket 綁定。OpenWrt 版本會將 Natter 的 INFO/WARN 寫入 `daemon.info`，只有
ERROR 進入 `daemon.err`，避免把正常的 `Calling script` 訊息誤判成錯誤。

## 限制與安全性

- Natter 只適用 IPv4 full-cone NAT；symmetric NAT 無法靠此方式建立穩定映射。
- firewall4 規則只接受指定 WAN device、固定內部埠、目標 IP／埠且帶 DNAT 狀態的封包。
- 公共 STUN 端點可能停用或改 IP，應保留多個 UDP 端點。TCP 公共大陸端點較少；正式
  環境建議另備一台位於中國大陸、支援 TCP STUN 的 coturn，並加入多個 `stun_server`。
- OpenClash 若保留標準的 GID 65534 bypass，Natter 會自動走 DIRECT。其他透明代理
  若忽略 socket 群組並強制攔截所有中國大陸 IP，仍需把 STUN、keepalive 與
  `119.29.29.29:53` 設為 DIRECT；套件不能覆寫未知代理的私有攔截規則。
