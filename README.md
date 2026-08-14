# Natter (v2)

Expose your port behind full-cone NAT to the Internet.
  
[中文文档](docs/README.md)


## OpenWrt 多 WAN 版本

本 Fork 同時提供可在 OpenWrt 22.03 以上使用的多 WAN 整合套件，適合搭配
`mwan3`。它會將 DNS、STUN、Keepalive 與映射 socket 綁定到指定 WAN，使用
mwan3 bypass mark，避免 failover 或負載平衡將流量切換到其他出口。

- LuCI 正體中文管理介面，支援 TCP、UDP 與 TCP + UDP 獨立映射
- 顯示各 WAN 的公網 IPv4、NAT 狀態、埠衝突檢查與執行狀態
- 手機畫面會將表格改為卡片排列，避免欄位重疊
- OpenWrt package 原始碼與建置說明：[`openwrt/README.md`](openwrt/README.md)
- 目前套件與 SHA256：[`OpenWrt Release`](https://github.com/alzpqm/Natter/releases/tag/openwrt-2.2.1-r12-luci-r14)

Release 內含：

- `natter-2.2.1-r12.apk`
- `luci-app-natter-1.0.0-r14.apk`
- `natter_2.2.1-r12_all.ipk`（OpenWrt 22.03）
- `luci-app-natter_1.0.0-r14_all.ipk`（OpenWrt 22.03）

OpenWrt 23.05 以上使用 APK；OpenWrt 22.03 使用舊式 IPK。以下指令會從 Fork
的最新 Release 取得對應套件。22.03 以前的 firewall3 版本尚未納入，因為本整合
依賴 firewall4；請不要在 21.02 或更早版本直接安裝這些套件。

### OpenWrt 23.05 以上（APK）

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

### OpenWrt 22.03（IPK）

```sh
rm -f /tmp/natter_openwrt_release /tmp/natter.ipk /tmp/luci-app-natter.ipk
opkg update
opkg install luci luci-base luci-compat
curl -fL --retry 2 https://api.github.com/repos/alzpqm/Natter/releases/latest \
  -o /tmp/natter_openwrt_release

core_url=$(jsonfilter -i /tmp/natter_openwrt_release \
  -e '@.assets[*].browser_download_url' | grep -E '/natter_[^/]+_all\.ipk$' | head -n1 || true)
luci_url=$(jsonfilter -i /tmp/natter_openwrt_release \
  -e '@.assets[*].browser_download_url' | grep -E '/luci-app-natter_[^/]+_all\.ipk$' | head -n1 || true)
[ -n "$core_url" ] && curl -fL --retry 2 "$core_url" -o /tmp/natter.ipk || \
  { echo "Natter IPK latest version get failed"; exit 1; }
[ -n "$luci_url" ] && curl -fL --retry 2 "$luci_url" -o /tmp/luci-app-natter.ipk || \
  { echo "luci-app-natter IPK latest version get failed"; exit 1; }
opkg install --force-overwrite /tmp/natter.ipk
opkg install --force-overwrite /tmp/luci-app-natter.ipk
```

安裝套件後，請依 `openwrt/README.md` 建立設定並執行
`/etc/init.d/natter enable`、`/etc/init.d/natter restart`。


## Quick start

```bash
python3 natter.py
```

Or, using Docker:

```bash
docker run --net=host nattertool/natter
```

```
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
2023-11-01 01:00:13 [I]
```

In the example above, `203.0.113.10` is your public IP address outside the full-cone NAT. Natter opened TCP port `203.0.113.10:14500` for testing.

Visit `http://203.0.113.10:14500` outside your LAN, you will see the web page:

```
It works!

--------
Natter
```


## Usage

```
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


## Usage for Docker

Read [natter-docker](natter-docker) for details.


## Use cases

Expose local port 80 to the Internet, using built-in forward method:

```bash
python3 natter.py -p 80
```

Expose local port 80 to the Internet, using iptables kernel forward method (requires root permission):

```bash
sudo python3 natter.py -m iptables -p 80
```


## Dependencies

- Python 2.7 (minimum), >= 3.6 (recommended)
- No third-party modules are required.


## License

GNU General Public License v3.0
