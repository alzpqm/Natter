# Natter

將 full-cone NAT（NAT 1）後的連接埠透過打洞公開至網際網路。

> 注意：Natter 2.0 重寫了整個程式，不相容於先前版本的命令列用法。詳見
> [更新說明](upgrade.md)。

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

以上例子中，`203.0.113.10` 是 full-cone NAT 外部的公網 IP。Natter 開啟
TCP 連接埠 `203.0.113.10:14500` 供測試。從 LAN 外部連線到
`http://203.0.113.10:14500` 即可看到測試頁面。

## 使用方法

- 詳見[參數說明](usage.md)。
- 轉送方式請參閱[轉送方法](forward.md)。
- 通知腳本請參閱[Natter 通知腳本](script.md)。

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

詳見 [`natter-docker`](../natter-docker)。

## 使用案例

使用內建轉送，對外開放本機 80 連接埠：

```bash
python3 natter.py -p 80
```

使用 iptables 核心轉送（需要 root 權限），對外開放本機 80 連接埠：

```bash
sudo python3 natter.py -m iptables -p 80
```

## 依賴

- Python 2.7（最低版本），Python 3.6 以上（建議）。
- 不需要安裝第三方模組。

## 授權

GNU General Public License v3.0
