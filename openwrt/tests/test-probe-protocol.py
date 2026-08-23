#!/usr/bin/env python3

"""Protocol-boundary regression tests for the OpenWrt probe helper."""

import importlib.machinery
import importlib.util
import os
import socket
import struct
import sys


SOURCE = os.path.abspath(
    sys.argv[1] if len(sys.argv) > 1
    else "openwrt/files/usr/libexec/natter-probe"
)
loader = importlib.machinery.SourceFileLoader("natter_probe_protocol_test", SOURCE)
spec = importlib.util.spec_from_loader(loader.name, loader)
probe = importlib.util.module_from_spec(spec)
loader.exec_module(probe)

COOKIE = 0x2112A442
TRANSACTION_ID = bytes(range(12))
PUBLIC_IP = "203.0.113.7"
PUBLIC_PORT = 54321
failures = []


def stun_response(body, declared_length=None):
    length = len(body) if declared_length is None else declared_length
    return struct.pack("!HHI", 0x0101, length, COOKIE) + TRANSACTION_ID + body


def check_equal(name, actual, expected):
    if actual == expected:
        print("ok - %s" % name)
    else:
        failures.append("%s: expected %r, got %r" % (name, expected, actual))


def check_rejected(name, response):
    try:
        actual = probe.mapped_address(response, TRANSACTION_ID)
    except ValueError:
        print("ok - %s" % name)
        return
    failures.append("%s: malformed response was accepted as %r" % (name, actual))


raw_ip = socket.inet_aton(PUBLIC_IP)
cookie_bytes = struct.pack("!I", COOKIE)
xored_ip = bytes(byte ^ mask for byte, mask in zip(raw_ip, cookie_bytes))
xored_port = PUBLIC_PORT ^ (COOKIE >> 16)
xor_value = b"\x00\x01" + struct.pack("!H", xored_port) + xored_ip
xor_attribute = struct.pack("!HH", 0x0020, len(xor_value)) + xor_value
check_equal(
    "valid XOR-MAPPED-ADDRESS",
    probe.mapped_address(stun_response(xor_attribute), TRANSACTION_ID),
    (PUBLIC_IP, PUBLIC_PORT),
)

mapped_value = b"\x00\x01" + struct.pack("!H", PUBLIC_PORT) + raw_ip
mapped_attribute = struct.pack("!HH", 0x0001, len(mapped_value)) + mapped_value
check_equal(
    "valid MAPPED-ADDRESS",
    probe.mapped_address(stun_response(mapped_attribute), TRANSACTION_ID),
    (PUBLIC_IP, PUBLIC_PORT),
)

check_rejected(
    "truncated STUN message body",
    stun_response(xor_attribute, declared_length=len(xor_attribute) + 4),
)

oversized_attribute = struct.pack("!HH", 0x0020, 12) + xor_value
check_rejected(
    "truncated STUN attribute value",
    stun_response(oversized_attribute),
)

check_rejected(
    "unaligned STUN message length",
    stun_response(xor_attribute + b"x", declared_length=len(xor_attribute) + 1),
)

if failures:
    for failure in failures:
        print("not ok - %s" % failure, file=sys.stderr)
    sys.exit(1)

print("all probe protocol tests passed")
