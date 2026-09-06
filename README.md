# Natter（v2）

將 full-cone NAT（NAT 1）後的 TCP／UDP 連接埠透過打洞公開至網際網路。

本頁以正體中文說明；程式參數、協定名稱、CLI 輸出及原始碼識別字保持英文，方便
與上游文件及日誌對照。一般 Natter 文件請參閱 [`docs/README.md`](docs/README.md)。

## OpenWrt 25.12+ 多 WAN 版本

> **官方建置政策：** 官方預設建置、測試及 Release 僅提供 OpenWrt 25.12 以上的
> APK。低於 25.12 的 OpenWrt 不納入官方支援矩陣、CI 或實機驗證；使用者仍可使用
> 相應舊版 SDK 自行編譯，但相容性與結果由使用者自行確認。歷史 Release 中的 IPK
> 與 checksum 會原樣保留，不重建、不編輯。詳見[舊版支援封存說明](openwrt/LEGACY_SUPPORT.md)。

本 Fork 提供 OpenWrt 25.12 以上使用的多 WAN 整合套件，支援搭配 `mwan3`，但不依賴
`mwan3`。已安裝 mwan3 時會將 DNS、UDP STUN 綁定到指定 WAN 裝置，TCP STUN、保活與
映射 socket 綁定到指定 WAN 來源位址，並使用該介面的 route mark，避免 failover 或
負載平衡切換出口。未安裝 mwan3 時則使用一般 OpenWrt WAN 路由。

- LuCI 正體中文管理介面，支援 TCP、UDP 與 TCP + UDP 獨立映射。
- 動態總覽服務與映射健康狀態，顯示各 WAN 的公網 IPv4、NAT 狀態及連接埠衝突檢查。
- 依 LuCI 主題變數支援淺色與深色模式，手機版提供 44px 觸控按鈕及單欄卡片配置。
- 中國大陸 STUN 探測端點用於 WAN 公網位址檢查，避免被本機代理的 DNS／fake-IP 干擾。
- 不依賴 mwan3；移除 mwan3 不會連帶移除 Natter。
- OpenWrt package 原始碼與建置說明：[`openwrt/README.md`](openwrt/README.md)。
- 套件與 SHA256 請參閱 [GitHub latest Release](https://github.com/alzpqm/Natter/releases/latest)。

目前 Release 只包含 OpenWrt 25.12+ APK：

- `natter-<version>.apk`
- `luci-app-natter-<version>.apk`
- `SHA256SUMS-*`

### 安裝（OpenWrt 25.12 以上）

```sh
rm -f /tmp/natter_openwrt_release /tmp/natter.apk /tmp/luci-app-natter.apk
apk update
apk add luci luci-base luci-compat
curl -fL --retry 2 https://api.github.com/repos/alzpqm/Natter/releases/latest \
  -o /tmp/natter_openwrt_release

core_url=$(jsonfilter -i /tmp/natter_openwrt_release \
  -e '@.assets[*].browser_download_url' | grep -E '/natter-[^/]+\.apk$' | head -n1 || true)
luci_url=$(jsonfilter -i /tmp/natter_openwrt_release \
  -e '@.assets[*].browser_download_url' | grep -E '/luci-app-natter-[^/]+\.apk$' | head -n1 || true)
[ -n "$core_url" ] && curl -fL --retry 2 "$core_url" -o /tmp/natter.apk || \
  { echo "Natter APK latest version get failed"; exit 1; }
[ -n "$luci_url" ] && curl -fL --retry 2 "$luci_url" -o /tmp/luci-app-natter.apk || \
  { echo "luci-app-natter APK latest version get failed"; exit 1; }
apk add --force-overwrite --clean-protected --allow-untrusted --no-chown \
  /tmp/natter.apk /tmp/luci-app-natter.apk
```

安裝後請依 [`openwrt/README.md`](openwrt/README.md) 建立設定，再執行：

```sh
/etc/init.d/natter enable
/etc/init.d/natter restart
```

### 低於 OpenWrt 25.12 的自行編譯

官方不提供低於 25.12 的預建套件、CI 或實機支援；原始碼仍保留，使用者可以依自己
所使用的舊版 SDK 嘗試編譯。這屬於自行維護範圍，不能直接套用 latest Release 的
APK，也不保證舊版 SDK 的 package metadata、Python 版本或 firewall4 行為相容。

```sh
cd /path/to/openwrt-<matching-old-release>
# 將本目錄的 OpenWrt package 原始碼放入 source tree
make package/natter/compile V=s
make package/natter/luci-app-natter/compile V=s
find bin/packages -type f \( -name 'natter_*.ipk' -o -name 'luci-app-natter_*.ipk' \)
```

歷史 Release 的 IPK 僅供重現舊部署，專案不會重建或修改那些檔案。

## 快速開始

```bash
python3 natter.py
```

或使用 Docker：

```bash
docker run --net=host nattertool/natter
```

```text
2023-11-01 01:00:08 [I] Natter
2023-11-01 01:00:08 [I] Tips: Use `--help` to see help messages
2023-11-01 01:00:12 [I]
2023-11-01 01:00:12 [I] tcp://192.168.1.100:13483 <--Natter--> tcp://203.0.113.10:14500
2023-11-01 01:00:12 [I]
2023-11-01 01:00:12 [I] Test mode in on.
2023-11-01 01:00:12 [I] Please check [ http://203.0.113.10:14500 ]
2023-11-01 01:00:12 [I]
2023-11-01 01:00:12 [I] LAN > 192.168.1.100:13483   [ OPEN ]
2023-11-01 01:00:12 [I] LAN > 192.168.1.100:13483   [ OPEN ]
2023-11-01 01:00:12 [I] LAN > 203.0.113.10:14500    [ OPEN ]
2023-11-01 01:00:13 [I] WAN > 203.0.113.10:14500    [ OPEN ]
```

在這個例子中，`203.0.113.10` 是 full-cone NAT 外部的公網 IP。Natter 開啟
`203.0.113.10:14500` 作為測試連接埠。從 LAN 外部連線到該網址即可看到測試頁面。

## 使用方法

- 詳見[參數說明](docs/usage.md)。
- 轉送方式請參閱[轉送方法](docs/forward.md)。
- 通知腳本請參閱[Natter 通知腳本](docs/script.md)。

```text
usage: natter.py [--version] [--help] [-v] [-q] [-u] [-U] [-k <interval>]
                 [-s <address>] [-h <address>] [-e <path>] [-i <interface>]
                 [-b <port>] [-m <method>] [-t <address>] [-p <port>] [-r]

Expose your port behind full-cone NAT to the Internet.

options:
  --version, -V   show the version of Natter and exit
  --help          show this help message and exit
  -v              verbose mode, printing debug messages
  -q              exit when mapped address is changed
  -u              UDP mode
  -U              enable UPnP/IGD discovery
  -k <interval>   seconds between each keep-alive
  -s <address>    hostname or address to STUN server
  -h <address>    hostname or address to keep-alive server
  -e <path>       script path for notifying mapped address

bind options:
  -i <interface>  network interface name or IP to bind
  -b <port>       port number to bind

forward options:
  -m <method>     forward method, common values are 'iptables', 'nftables',
                  'socat', 'gost' and 'socket'
  -t <address>    IP address of forward target
  -p <port>       port number of forward target
  -r              keep retrying until the port of forward target is open
```

## Docker 使用方法

詳見 [`natter-docker`](natter-docker)。

## 使用案例

使用內建轉送，對外開放本機 80 連接埠：

```bash
python3 natter.py -p 80
```

使用 iptables 核心轉送（需要 root 權限）：

```bash
sudo python3 natter.py -m iptables -p 80
```

## 依賴

- Python 2.7（最低版本），Python 3.6 以上（建議）。
- 不需要第三方模組。

## 授權

GNU General Public License v3.0
