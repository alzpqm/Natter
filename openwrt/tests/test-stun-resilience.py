#!/usr/bin/env python3

"""Regression tests for bounded STUN logging and bind/connect error handling."""

import errno
import importlib.machinery
import importlib.util
import os
import sys


SOURCE = os.path.abspath(
    sys.argv[1] if len(sys.argv) > 1 else "natter.py"
)
loader = importlib.machinery.SourceFileLoader("natter_stun_resilience_test", SOURCE)
spec = importlib.util.spec_from_loader(loader.name, loader)
natter = importlib.util.module_from_spec(spec)
loader.exec_module(natter)


warnings = []
errors = []
debug = []
natter.Logger.warning = warnings.append
natter.Logger.error = errors.append
natter.Logger.debug = debug.append


class EndOutageTest(Exception):
    pass


clock = [1000.0]
sleeps = []


def fake_sleep(seconds):
    sleeps.append(seconds)
    clock[0] += seconds
    if len(sleeps) >= 31:
        raise EndOutageTest()


natter.time.time = lambda: clock[0]
natter.time.sleep = fake_sleep
client = natter.StunClient(
    [("192.0.2.10", 3478), ("192.0.2.11", 3478)], udp=True
)


def timeout_mapping():
    raise natter.StunClient.ServerUnavailable(
        OSError(errno.ETIMEDOUT, "timed out")
    )


client._get_mapping = timeout_mapping
try:
    client.get_mapping()
except EndOutageTest:
    pass
else:
    raise AssertionError("outage test did not reach its bounded stop")

if len(warnings) != 2:
    raise AssertionError("expected one warning per server, got %d" % len(warnings))
if len(errors) != 2:
    raise AssertionError("expected one outage summary per five minutes, got %d" % len(errors))
if sleeps != [10] * 31:
    raise AssertionError("STUN retry cadence changed unexpectedly")


class StageSocket(object):
    def __init__(self, bind_errno=None, connect_errno=None):
        self.bind_errno = bind_errno
        self.connect_errno = connect_errno
        self.bind_called = False
        self.connect_called = False

    def setsockopt(self, *args):
        pass

    def bind(self, address):
        self.bind_called = True
        if self.bind_errno is not None:
            raise OSError(self.bind_errno, "address not available")

    def settimeout(self, timeout):
        pass

    def connect(self, address):
        if not self.bind_called:
            raise AssertionError("connect was attempted before bind")
        self.connect_called = True
        if self.connect_errno is not None:
            raise OSError(self.connect_errno, "address not available")

    def close(self):
        pass


real_socket_factory = natter.socket.socket
try:
    connect_socket = StageSocket(connect_errno=errno.EADDRNOTAVAIL)
    natter.socket.socket = lambda *args, **kwargs: connect_socket
    client = natter.StunClient(
        [("192.0.2.10", 3478)], source_host="192.0.2.20", source_port=40000
    )
    try:
        client._get_mapping()
    except natter.StunClient.ServerUnavailable as ex:
        cause = ex.args[0] if ex.args else ex
        if getattr(cause, "errno", None) != errno.EADDRNOTAVAIL:
            raise AssertionError("connect-stage errno was not preserved")
    else:
        raise AssertionError("connect-stage EADDRNOTAVAIL was not retryable")
    if not connect_socket.bind_called or not connect_socket.connect_called:
        raise AssertionError("connect-stage fixture did not exercise both stages")

    bind_socket = StageSocket(bind_errno=errno.EADDRNOTAVAIL)
    natter.socket.socket = lambda *args, **kwargs: bind_socket
    client = natter.StunClient(
        [("192.0.2.10", 3478)], source_host="192.0.2.20", source_port=40000
    )
    try:
        client._get_mapping()
    except natter.StunClient.LocalAddressUnavailable:
        pass
    else:
        raise AssertionError("bind-stage EADDRNOTAVAIL lost its fail-fast type")
    if not bind_socket.bind_called or bind_socket.connect_called:
        raise AssertionError("bind-stage failure unexpectedly reached connect")
finally:
    natter.socket.socket = real_socket_factory

warnings.clear()
errors.clear()
sleeps.clear()
client = natter.StunClient(
    [("192.0.2.10", 3478), ("192.0.2.11", 3478)], udp=False
)
mapping_calls = []


def tuple_collision_then_success():
    mapping_calls.append(client.stun_server_list[0])
    if len(mapping_calls) == 1:
        raise natter.StunClient.ServerUnavailable(
            OSError(errno.EADDRNOTAVAIL, "address not available")
        )
    return ("192.0.2.20", 40000), ("198.51.100.20", 50000)


client._get_mapping = tuple_collision_then_success
mapping = client.get_mapping()
if mapping[1] != ("198.51.100.20", 50000):
    raise AssertionError("connect-stage retry did not return the next mapping")
if mapping_calls != [("192.0.2.10", 3478), ("192.0.2.11", 3478)]:
    raise AssertionError("connect-stage EADDRNOTAVAIL did not rotate the server")
if sleeps or errors or len(warnings) != 1:
    raise AssertionError("connect-stage EADDRNOTAVAIL was treated as a stale bind")

warnings.clear()
errors.clear()
sleeps.clear()
client = natter.StunClient([("192.0.2.10", 3478)], udp=True)


def stale_bind_mapping():
    raise natter.StunClient.LocalAddressUnavailable(
        OSError(errno.EADDRNOTAVAIL, "address not available")
    )


client._get_mapping = stale_bind_mapping
try:
    client.get_mapping()
except natter.NatterExitException:
    pass
else:
    raise AssertionError("a stale local bind address did not terminate the worker")

if sleeps:
    raise AssertionError("a stale local bind address entered the STUN retry loop")
if len(errors) != 1 or "Local bind address" not in errors[0]:
    raise AssertionError("a stale local bind address has no concise error")

print("ok - repeated STUN outage logs are bounded without slowing retries")
print("ok - bind and connect EADDRNOTAVAIL are classified by failure stage")
print("ok - TCP tuple collisions rotate STUN servers instead of exiting")
print("ok - stale local bind address exits before entering the retry loop")
