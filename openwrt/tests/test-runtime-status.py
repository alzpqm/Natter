#!/usr/bin/env python3

"""Focused regression tests for the LuCI runtime-status data path."""

import contextlib
import importlib.machinery
import importlib.util
import io
import json
import os
import sys
import tempfile
import time
from types import SimpleNamespace


SOURCE = os.path.abspath(
    sys.argv[1] if len(sys.argv) > 1
    else "openwrt/files/usr/libexec/natter-probe"
)
loader = importlib.machinery.SourceFileLoader("natter_probe_test", SOURCE)
spec = importlib.util.spec_from_loader(loader.name, loader)
probe = importlib.util.module_from_spec(spec)
loader.exec_module(probe)


interfaces = ("wanct", "wancm", "wan2")
instances = {}
config = {}
for index in range(16):
    section = "mapping_%02d" % index
    interface = interfaces[index % len(interfaces)]
    instances[section] = {
        "command": ["/usr/bin/python3", "/usr/share/natter/natter.py", "-b", str(30000 + index)],
        "env": {
            "NATTER_CONFIG_SECTION": section,
            "NATTER_INTERFACE": interface,
        },
        "pid": 2000 + index,
        "running": True,
    }
    config[section] = {
        ".type": "instance",
        "target_ip": "192.0.2.20",
        "target_port": str(40000 + index),
    }

service_data = {"natter": {"instances": instances}}
interface_calls = []


def fake_run(command, timeout=5):
    if command[:4] == ["ubus", "call", "service", "list"]:
        return SimpleNamespace(returncode=0, stdout=json.dumps(service_data))
    raise AssertionError("unexpected subprocess: %r" % (command,))


def fake_interface_status(name):
    interface_calls.append(name)
    return {
        "interface": name,
        "device": "dev-%s" % name,
        "inside_ip": {
            "wanct": "192.0.2.1",
            "wancm": "192.0.2.2",
            "wan2": "192.0.2.3",
        }[name],
        "up": True,
    }


probe.glob.glob = lambda _pattern: []
probe.parse_uci_show = lambda _package: config
probe.run = fake_run
probe.interface_status = fake_interface_status
probe.process_start_time = lambda _pid: time.time()

output = io.StringIO()
with contextlib.redirect_stdout(output):
    probe.runtime_status()
rows = json.loads(output.getvalue())

failures = []
if len(rows) != len(instances):
    failures.append("expected %d runtime rows, got %d" % (len(instances), len(rows)))

for row in rows:
    interface = row.get("interface")
    expected_ip = {
        "wanct": "192.0.2.1",
        "wancm": "192.0.2.2",
        "wan2": "192.0.2.3",
    }.get(interface)
    if expected_ip and not str(row.get("mapped_inside", "")).startswith(expected_ip + ":"):
        failures.append("wrong inside IP for %s: %s" % (interface, row.get("mapped_inside")))

expected_calls = list(interfaces)
if interface_calls != expected_calls:
    failures.append(
        "expected one interface lookup per WAN %r, got %d calls %r"
        % (expected_calls, len(interface_calls), interface_calls)
    )

with tempfile.TemporaryDirectory() as state_dir:
    state_path = os.path.join(state_dir, "stale_tcp.state")
    with open(state_path, "w", encoding="utf-8") as state_file:
        state_file.write(
            "instance=stale_tcp\n"
            "worker_pid=9001\n"
            "config=stale\n"
            "interface=wan2\n"
            "protocol=tcp\n"
            "status=ok\n"
            "mapped_inside=192.0.2.30:33001\n"
            "public=198.51.100.20:45678\n"
            "target=192.0.2.20:80\n"
            "updated_at=1\n"
        )

    service_data = {"natter": {"instances": {
        "stale_tcp": {
            "command": [
                "/usr/bin/python3", "/usr/share/natter/natter.py", "-b", "33001"
            ],
            "env": {
                "NATTER_CONFIG_SECTION": "stale",
                "NATTER_INTERFACE": "wan2",
            },
            "pid": 9001,
            "running": True,
        },
    }}}
    config = {"stale": {
        ".type": "instance",
        "target_ip": "192.0.2.20",
        "target_port": "80",
    }}
    probe.glob.glob = lambda _pattern: [state_path]
    interface_calls.clear()

    stale_output = io.StringIO()
    with contextlib.redirect_stdout(stale_output):
        probe.runtime_status()
    stale_rows = json.loads(stale_output.getvalue())
    if len(stale_rows) != 1 or stale_rows[0].get("status") != "error":
        failures.append("stale inside address was not changed to error")
    elif stale_rows[0].get("error_code") != "interface-address-changed":
        failures.append("stale inside address has no stable error code")
    elif stale_rows[0].get("current_inside_ip") != "192.0.2.3":
        failures.append("stale inside address did not report the current WAN IPv4")
    if interface_calls != ["wan2"]:
        failures.append("stale mapping check did not reuse one WAN lookup")

    service_data = {"natter": {"instances": {}}}
    config = {"globals": {".type": "natter", "enabled": "0"}}
    orphan_output = io.StringIO()
    with contextlib.redirect_stdout(orphan_output):
        probe.runtime_status()
    if json.loads(orphan_output.getvalue()) != []:
        failures.append("orphan mapping state remained visible after its worker was removed")

if failures:
    for failure in failures:
        print("not ok - %s" % failure, file=sys.stderr)
    sys.exit(1)

print("ok - runtime status returned %d rows with %d interface lookups" % (
    len(rows), len(expected_calls)
))
print("ok - stale mapping is rejected when the WAN IPv4 address changes")
print("ok - orphan mapping state is hidden after its worker is removed")
