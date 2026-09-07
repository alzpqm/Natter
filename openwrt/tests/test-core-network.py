#!/usr/bin/env python3
"""Offline regressions for the *patched* package's STUN/keep-alive path.

Usage: python3 openwrt/tests/test-core-network.py /path/to/patched/natter.py
No Internet access, firewall changes, root privileges or extra modules needed.
"""

import contextlib
import errno
import importlib.util
import os
import socket
import struct
import sys


if len(sys.argv) != 2:
    raise SystemExit("pass the clean, fully patched package natter.py explicitly")
spec = importlib.util.spec_from_file_location("natter_core_test", os.path.abspath(sys.argv[1]))
natter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(natter)
COOKIE = 0x2112A442
MAPPING = ("203.0.113.7", 54321)
failures = []
checks = []


@contextlib.contextmanager
def replace(obj, name, value):
    original = getattr(obj, name)
    setattr(obj, name, value)
    try:
        yield
    finally:
        setattr(obj, name, original)


def check(name, func):
    checks.append(name)
    try:
        func()
    except Exception as error:
        failures.append(name)
        print("not ok - %s: %s: %s" % (name, type(error).__name__, error))
    else:
        print("ok - %s" % name)


def attribute(kind=0x0020, port=MAPPING[1], ip=MAPPING[0], family=1):
    ip_value = struct.unpack("!I", socket.inet_aton(ip))[0]
    if kind == 0x0020:
        port ^= COOKIE >> 16
        ip_value ^= COOKIE
    return struct.pack("!HHBBHI", kind, 8, 0, family, port, ip_value)


def response(request, body=None, kind=0x0101, cookie=COOKIE, txid=None, length=None):
    if body is None:
        body = attribute()
    return (struct.pack("!HHI", kind, len(body) if length is None else length, cookie)
            + (request[8:20] if txid is None else txid) + body)


class ScriptedSocket:
    def __init__(self, build=response, fragment=None, bind_errno=None, connect_errno=None):
        self.build = build
        self.fragment = fragment
        self.bind_errno = bind_errno
        self.connect_errno = connect_errno
        self.pending = b""
        self.closed = False
        self.request = None
        self.timeout = 3

    def setsockopt(self, *args):
        pass

    def bind(self, address):
        if self.bind_errno:
            raise OSError(self.bind_errno, "fixture bind failure")

    def connect(self, address):
        if self.connect_errno:
            raise OSError(self.connect_errno, "fixture connect failure")

    def getsockname(self):
        return ("127.0.0.1", 40000)

    def settimeout(self, timeout):
        self.timeout = timeout

    def send(self, data):
        self.request = data
        self.pending = self.build(data)
        return len(data)

    def sendall(self, data):
        self.send(data)

    def recv(self, size):
        if not self.pending:
            raise socket.timeout("fixture timeout")
        if self.fragment:
            size = min(size, self.fragment)
        data, self.pending = self.pending[:size], self.pending[size:]
        return data

    def close(self):
        self.closed = True


def mapping_case(build=response, fragment=None, reject=False, udp=False):
    sock = ScriptedSocket(build=build, fragment=fragment)
    client = natter.StunClient([("127.0.0.1", 3478)], udp=udp)
    with replace(natter.socket, "socket", lambda *a, **kw: sock):
        try:
            result = client._get_mapping()
        except natter.StunClient.ServerUnavailable:
            if not reject:
                raise
        else:
            if reject:
                raise AssertionError("invalid response accepted as %r" % (result[1],))
            assert result[1] == MAPPING, result
    assert sock.closed, "STUN socket leaked"


check("valid TCP XOR mapping", lambda: mapping_case())
check("valid UDP XOR mapping", lambda: mapping_case(udp=True))
check("legacy MAPPED-ADDRESS fallback", lambda: mapping_case(
    lambda req: response(req, attribute(kind=1))))
check("TCP header/body fragmentation", lambda: mapping_case(fragment=3))
check("padded optional attribute before mapping", lambda: mapping_case(
    lambda req: response(req, struct.pack("!HH", 0x8022, 3) + b"abc\0" + attribute())))
check("XOR mapping preferred over legacy mapping", lambda: mapping_case(
    lambda req: response(req, attribute(kind=1, port=12345) + attribute())))
check("wrong transaction ID rejected", lambda: mapping_case(
    lambda req: response(req, txid=b"\0" * 12), reject=True, udp=True))
check("wrong magic cookie rejected", lambda: mapping_case(
    lambda req: response(req, cookie=0), reject=True, udp=True))
check("error response cannot publish a mapping", lambda: mapping_case(
    lambda req: response(req, kind=0x0111), reject=True, udp=True))
check("truncated declared body rejected", lambda: mapping_case(
    lambda req: response(req, length=16), reject=True, udp=True))
check("unaligned body length rejected", lambda: mapping_case(
    lambda req: response(req, attribute() + b"x"), reject=True, udp=True))
check("trailing UDP bytes rejected", lambda: mapping_case(
    lambda req: response(req) + b"junk", reject=True, udp=True))
check("malformed attribute after mapping rejected", lambda: mapping_case(
    lambda req: response(req, attribute() + struct.pack("!HH", 0x8022, 8)),
    reject=True, udp=True))
check("wrong address family rejected", lambda: mapping_case(
    lambda req: response(req, attribute(family=2)), reject=True, udp=True))
check("zero mapped port rejected", lambda: mapping_case(
    lambda req: response(req, attribute(port=0)), reject=True, udp=True))


class StopFixture(BaseException):
    pass


def main_recovery(startup_failures=0, loop_failure=False):
    attempts = []
    forwards = []
    sleeps = []
    warnings = []
    fake_time = [1000.0]

    def sleep(seconds):
        sleeps.append(seconds)
        fake_time[0] += seconds
        assert len(sleeps) < 40, "retry loop failed to recover"

    def keep_alive(self):
        attempts.append(len(attempts) + 1)
        if len(attempts) <= startup_failures or (loop_failure and len(attempts) == 2):
            raise OSError(errno.EADDRNOTAVAIL, "fixture TCP tuple collision")
        if len(attempts) > startup_failures + (2 if loop_failure else 1):
            raise StopFixture()

    argv = ["natter.py", "--no-port-test", "-m", "none", "-i", "127.0.0.1",
            "-b", "40000", "-h", "127.0.0.1:8080", "-s", "127.0.0.1:3478", "-k", "1"]
    with contextlib.ExitStack() as stack:
        replacements = [
            (sys, "argv", argv),
            (natter, "check_docker_network", lambda: None),
            (natter.KeepAlive, "keep_alive", keep_alive),
            (natter.StunClient, "get_mapping", lambda self, **kw: (("127.0.0.1", 40000), MAPPING)),
            (natter.ForwardNone, "start_forward", lambda *a, **kw: forwards.append(True)),
            (natter.NatterExit, "set_atexit", lambda func: None),
            (natter.PortTest, "test_lan", lambda *a, **kw: -1),
            (natter.time, "sleep", sleep),
            (natter.time, "time", lambda: fake_time[0]),
            (natter.time, "monotonic", lambda: fake_time[0]),
            (natter.Logger, "info", lambda message="": None),
            (natter.Logger, "error", lambda message="": None),
            (natter.Logger, "warning", warnings.append),
        ]
        for obj, name, value in replacements:
            stack.enter_context(replace(obj, name, value))
        try:
            natter.natter_main(show_title=False)
        except StopFixture:
            pass
    assert forwards == [True], "worker never reached mapping setup"
    if startup_failures:
        assert sleeps == [1] * startup_failures, sleeps
        assert len(warnings) <= 2, "startup outage logs are not bounded"


check("six startup tuple collisions recover in the same worker", lambda: main_recovery(6))
check("runtime connect errno99 is not a stale local address", lambda: main_recovery(loop_failure=True))


def bounded_keepalive(udp):
    now = [0.0]

    class ContinuousSocket(ScriptedSocket):
        count = 0

        def send(self, data):
            return len(data)

        def recv(self, size):
            self.count += 1
            now[0] += 0.25
            assert self.count <= 20, "continuous peer data bypassed the receive deadline"
            return b"x"

    sock = ContinuousSocket()
    client = natter.KeepAlive("127.0.0.1", 8080, "127.0.0.1", 40000, udp=udp)
    client.sock = sock
    with replace(natter.time, "monotonic", lambda: now[0]):
        client.keep_alive()
    assert 0 < sock.count <= 13, sock.count
    assert sock.timeout == 3, "next keep-alive inherited an almost-expired timeout"
    client.disconnect()
    assert sock.closed


check("TCP continuous peer data has an absolute deadline", lambda: bounded_keepalive(False))
check("UDP continuous peer data has an absolute deadline", lambda: bounded_keepalive(True))


def recheck_outage_keeps_mapping_alive():
    mapping_calls = [0]
    keepalives_during_outage = []
    now = [1000.0]

    def mapping(self):
        mapping_calls[0] += 1
        if mapping_calls[0] <= 2:
            return ("127.0.0.1", 40000), MAPPING
        if mapping_calls[0] > 9:
            raise StopFixture()
        raise natter.StunClient.ServerUnavailable(socket.timeout("fixture STUN outage"))

    def keep_alive(self):
        if mapping_calls[0] > 2:
            keepalives_during_outage.append(True)

    argv = ["natter.py", "--no-port-test", "-u", "-m", "none", "-i", "127.0.0.1",
            "-b", "40000", "-h", "127.0.0.1:5353", "-s", "127.0.0.1:3478", "-k", "1"]
    with contextlib.ExitStack() as stack:
        for obj, name, value in [
            (sys, "argv", argv),
            (natter, "check_docker_network", lambda: None),
            (natter, "set_reuse_port", lambda port: None),
            (natter.StunClient, "_get_mapping", mapping),
            (natter.KeepAlive, "keep_alive", keep_alive),
            (natter.NatterExit, "set_atexit", lambda func: None),
            (natter.time, "sleep", lambda seconds: now.__setitem__(0, now[0] + seconds)),
            (natter.time, "time", lambda: now[0]),
            (natter.time, "monotonic", lambda: now[0]),
            (natter.Logger, "info", lambda message="": None),
            (natter.Logger, "error", lambda message="": None),
            (natter.Logger, "warning", lambda message="": None),
        ]:
            stack.enter_context(replace(obj, name, value))
        try:
            natter.natter_main(show_title=False)
        except StopFixture:
            pass
    assert len(keepalives_during_outage) == 7, (
        "STUN recheck outage starved keep-alive: %d sends for 7 failures"
        % len(keepalives_during_outage))


check("STUN recheck outage does not starve active keep-alive", recheck_outage_keeps_mapping_alive)


def keepalive_error_stage(bind_failure):
    sock = ScriptedSocket(**{
        "bind_errno" if bind_failure else "connect_errno": errno.EADDRNOTAVAIL
    })
    client = natter.KeepAlive("127.0.0.1", 8080, "127.0.0.1", 40000)
    with replace(natter.socket, "socket", lambda *a, **kw: sock):
        try:
            client._connect()
        except natter.KeepAlive.LocalAddressUnavailable:
            assert bind_failure, "connect collision classified as stale bind"
        except OSError:
            assert not bind_failure, "stale bind not classified for worker replacement"
        else:
            raise AssertionError("fixture error was swallowed")
    assert client.sock is None and sock.closed, "failed keep-alive socket leaked"


check("keep-alive stale bind fails fast and closes socket", lambda: keepalive_error_stage(True))
check("keep-alive connect collision stays retryable and closes socket", lambda: keepalive_error_stage(False))


def one_shot_stun_rechecks_are_bounded():
    client = natter.StunClient([("127.0.0.1", 3478), ("127.0.0.2", 3478)])
    now = [1000.0]
    warnings = []
    errors = []

    def fail():
        raise natter.StunClient.ServerUnavailable(socket.timeout("fixture outage"))

    with contextlib.ExitStack() as stack:
        for obj, name, value in [
            (client, "_get_mapping", fail),
            (natter.time, "time", lambda: now[0]),
            (natter.time, "sleep", lambda _: (_ for _ in ()).throw(AssertionError("recheck slept"))),
            (natter.Logger, "warning", warnings.append),
            (natter.Logger, "error", errors.append),
        ]:
            stack.enter_context(replace(obj, name, value))
        for _ in range(32):
            try:
                client.get_mapping(retry=False)
            except natter.StunClient.ServerUnavailable:
                pass
            else:
                raise AssertionError("recheck outage was not reported to caller")
            now[0] += 10
    assert len(warnings) == 2 and len(errors) == 2, (warnings, errors)


check("single-shot STUN rechecks preserve bounded logs and never sleep", one_shot_stun_rechecks_are_bounded)


def logs_are_flushed():
    class Stream:
        writes = 0
        flushes = 0

        def write(self, message):
            self.writes += 1

        def flush(self):
            self.flushes += 1

    stream = Stream()
    with contextlib.ExitStack() as stack:
        for obj, name, value in [
            (natter.sys, "stdout", stream),
            (natter.sys, "stderr", stream),
            (natter.os, "environ", dict(os.environ, NATTER_OPENWRT_LOG="1")),
            (natter.Logger, "level", natter.Logger.DEBUG),
        ]:
            stack.enter_context(replace(obj, name, value))
        for method in (natter.Logger.debug, natter.Logger.info, natter.Logger.warning, natter.Logger.error):
            method("fixture immediate log")
    assert stream.writes == stream.flushes == 4, (stream.writes, stream.flushes)


check("all log levels are flushed before returning to the worker", logs_are_flushed)

print("%d/%d core network checks passed" % (len(checks) - len(failures), len(checks)))
sys.exit(bool(failures))
