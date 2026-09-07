#!/usr/bin/env python3
"""Real localhost sockets: TCP STUN framing, UDP STUN, startup recovery.

Pass the fully patched natter.py. Only ephemeral loopback ports are used;
no firewall, UCI, Internet, or installed service state is touched.
"""

import importlib.util
import os
import socket
import struct
import sys
import threading
import time


if len(sys.argv) != 2:
    raise SystemExit("pass the fully patched package natter.py explicitly")
spec = importlib.util.spec_from_file_location("natter_loopback_test", os.path.abspath(sys.argv[1]))
natter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(natter)
failures = []


def response(request):
    body = struct.pack("!HHBBHI", 0x0020, 8, 0, 1, 54321 ^ 0x2112,
                       struct.unpack("!I", socket.inet_aton("203.0.113.7"))[0] ^ 0x2112a442)
    return struct.pack("!HHI", 0x0101, len(body), 0x2112a442) + request[8:20] + body


def stun_case(udp):
    kind = socket.SOCK_DGRAM if udp else socket.SOCK_STREAM
    server = socket.socket(socket.AF_INET, kind)
    server.bind(("127.0.0.1", 0))
    server.settimeout(5)
    address = server.getsockname()
    if not udp:
        server.listen(1)

    def serve():
        try:
            if udp:
                request, peer = server.recvfrom(128)
                server.sendto(response(request), peer)
            else:
                with server.accept()[0] as peer:
                    peer.settimeout(5)
                    request = b""
                    while len(request) < 20:
                        part = peer.recv(20 - len(request))
                        if not part:
                            raise AssertionError("STUN request truncated")
                        request += part
                    data = response(request)
                    for offset in range(0, len(data), 3):
                        peer.sendall(data[offset:offset + 3])
                        time.sleep(0.01)
        except Exception as error:
            failures.append("STUN server: %r" % error)
        finally:
            server.close()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    try:
        mapping = natter.StunClient([address], source_host="127.0.0.1", udp=udp)._get_mapping()
        assert mapping[1] == ("203.0.113.7", 54321), mapping
    finally:
        thread.join(6)
    assert not thread.is_alive(), "STUN fixture thread leaked"
    assert not failures, failures
    print("ok - real %s STUN socket%s" % ("UDP" if udp else "TCP", "" if udp else " with 3-byte fragments"))


def keepalive_recovery():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.settimeout(6)
    address = server.getsockname()
    stop = threading.Event()
    first_failure = threading.Event()
    warnings = []
    old_warning = natter.Logger.warning

    def warning(message):
        warnings.append(message)
        first_failure.set()

    natter.Logger.warning = warning

    def serve():
        try:
            # Synchronize with the failed client attempt, not a timing guess:
            # some kernels wait/retransmit before reporting connect failure.
            assert first_failure.wait(5), "client did not report startup failure"
            server.listen(1)
            with server.accept()[0] as peer:
                peer.settimeout(5)
                request = peer.recv(4096)
                assert request.startswith(b"HEAD /natter-keep-alive "), request
                peer.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: keep-alive\r\n\r\n")
                stop.wait(5)
        except Exception as error:
            failures.append("keep-alive server: %r" % error)
        finally:
            server.close()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    client = natter.KeepAlive(address[0], address[1], "127.0.0.1", 0)
    started = time.monotonic()
    try:
        client.wait_ready(1)
        assert client.sock is not None, "no persistent keep-alive socket"
        assert len(warnings) == 1, warnings
        assert time.monotonic() - started < 9, "startup exceeded fixture budget"
    finally:
        client.disconnect()
        stop.set()
        thread.join(6)
        natter.Logger.warning = old_warning
    assert not thread.is_alive(), "keep-alive fixture thread leaked"
    assert not failures, failures
    print("ok - real unavailable TCP keep-alive connection recovers without process restart")


stun_case(False)
stun_case(True)
keepalive_recovery()
print("3/3 real loopback network checks passed")
