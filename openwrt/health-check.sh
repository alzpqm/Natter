#!/bin/sh

# Read-only evidence snapshot for the OpenWrt Natter deployment.
# Usage: ./health-check.sh [ssh-host]

set -eu

host="${1:-natter-openwrt}"

ssh -o BatchMode=yes "$host" 'set -eu
echo "DATE=$(date -Iseconds)"
echo "UPTIME=$(uptime)"
echo "SERVICE=$(/etc/init.d/natter status)"

status_json=$(/usr/sbin/natterctl status-json)
check_json=$(/usr/sbin/natterctl check-config)
probe_json=$(/usr/sbin/natterctl probe-all)
STATUS_JSON="$status_json" CHECK_JSON="$check_json" PROBE_JSON="$probe_json" \
python3 - <<"PY"
import json
import os

status = json.loads(os.environ["STATUS_JSON"])
checks = json.loads(os.environ["CHECK_JSON"])
probes = json.loads(os.environ["PROBE_JSON"])

bad_status = [item.get("instance") for item in status if item.get("status") != "ok"]
bad_checks = [item.get("section") for item in checks if item.get("status") != "ok"]
bad_probes = [item.get("interface") for item in probes if item.get("status") != "ok"]
public = sorted({
    (item.get("interface"), str(item.get("public", "")).split(":", 1)[0])
    for item in status
})

print("MAPPINGS=%d OK=%d NON_OK=%s" %
      (len(status), len(status) - len(bad_status), bad_status))
print("CHECKS=%d OK=%d NON_OK=%s" %
      (len(checks), len(checks) - len(bad_checks), bad_checks))
print("PROBES=%d OK=%d NON_OK=%s" %
      (len(probes), len(probes) - len(bad_probes), bad_probes))
print("PUBLIC_IPS=%s" % public)
PY

workers=$(ps w | awk "/\\/usr\\/share\\/natter\\/natter.py/ && !/awk/ {count++} END {print count+0}")
marks=$(for pid in $(ps w | awk "/\\/usr\\/share\\/natter\\/natter.py/ && !/awk/ {print \$1}"); do
    tr "\\000" "\\n" </proc/$pid/environ | sed -n "s/^NATTER_SO_MARK=//p"
done | awk "\$1 == \"0x3F00\" {ok++} END {print ok+0}")
echo "WORKERS=$workers MARK_0x3F00=$marks"
free -m | sed -n "1,3p"
df -h / /tmp
echo "NATTER_RULE_LINES=$(nft list ruleset 2>/dev/null | grep -c "comment \\\"natter:" || true)"
echo "ERROR_LINES=$(logread -e natter | grep -Ei "error|fail|traceback|exception|warn" | wc -l | tr -d " ")"
'
