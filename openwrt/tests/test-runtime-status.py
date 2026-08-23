#!/usr/bin/env python3

"""Focused regression tests for the LuCI runtime-status data path."""

import contextlib
import importlib.machinery
import importlib.util
import io
import json
import os
import sys
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

if failures:
    for failure in failures:
        print("not ok - %s" % failure, file=sys.stderr)
    sys.exit(1)

print("ok - runtime status returned %d rows with %d interface lookups" % (
    len(rows), len(interface_calls)
))
