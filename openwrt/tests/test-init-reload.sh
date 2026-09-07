#!/bin/sh

set -u

SOURCE="${1:-openwrt/files/etc/init.d/natter}"
case "$SOURCE" in
	/*) ;;
	*) SOURCE="$(pwd)/$SOURCE" ;;
esac

TEST_ROOT="$(mktemp -d)" || exit 1
START_LOG="$TEST_ROOT/start.log"
cleanup() {
	rm -rf "$TEST_ROOT"
}
trap cleanup 0 1 2 15

# shellcheck source=/dev/null
. "$SOURCE"
start() {
	printf '%s\n' "$*" >> "$START_LOG"
}

reload_service interface-event
if [ "$(cat "$START_LOG" 2>/dev/null)" != interface-event ]; then
	printf '%s\n' 'not ok - reload_service did not enter rc.common start()' >&2
	exit 1
fi

bind_epoch_count="$(grep -c 'NATTER_BIND_IP=' "$SOURCE")"
if [ "$bind_epoch_count" -ne 2 ]; then
	printf 'not ok - expected NATTER_BIND_IP in both env branches, got %s\n' \
		"$bind_epoch_count" >&2
	exit 1
fi

if sed -n '/^reload_service()/,/^}/p' "$SOURCE" | \
	sed '/^[[:space:]]*#/d' | grep -q 'start_service'; then
	printf '%s\n' 'not ok - reload_service still calls start_service outside rc_procd' >&2
	exit 1
fi

printf '%s\n' 'ok - reload_service enters an rc.common start transaction'
printf '%s\n' 'ok - TCP and UDP worker definitions carry a WAN IPv4 epoch'

# Exercise the real worker declaration with deterministic, offline inputs.
# In particular, a core upgrade must not depend on DNS/argv changing.
PARAM_LOG="$TEST_ROOT/params.log"
PROBE_HELPER=true
config_get_bool() {
	case "$3" in
		enabled) eval "$1=1" ;;
		*) eval "$1=0" ;;
	esac
}
config_get() {
	case "$3" in
		interface) eval "$1=wan" ;;
		protocol) eval "$1=both" ;;
		bind_port) eval "$1=40000" ;;
		target_ip) eval "$1=192.0.2.20" ;;
		target_port) eval "$1=8080" ;;
		interval) eval "$1=15" ;;
		dns_server) eval "$1=192.0.2.53" ;;
		*) eval "$1=''" ;;
	esac
}
config_list_foreach() { RESOLVED_STUN='192.0.2.30:3478'; }
network_get_device() { eval "$1=eth-test"; }
network_get_ipaddr() { eval "$1=192.0.2.10"; }
resolve_endpoint() { printf '%s\n' '192.0.2.40:80'; }
procd_open_instance() { printf 'instance %s\n' "$1" >> "$PARAM_LOG"; }
procd_set_param() { printf '%s\n' "$*" >> "$PARAM_LOG"; }
procd_append_param() { :; }
procd_close_instance() { :; }
start_protocol_instance fixture tcp fixture_tcp || exit 1
start_protocol_instance fixture udp fixture_udp || exit 1
file_declarations="$(grep -Fxc "file $PROG" "$PARAM_LOG")"
if [ "$file_declarations" -ne 2 ]; then
	printf 'not ok - core checksum dependency missing from TCP/UDP declarations (%s)\n' "$file_declarations" >&2
	exit 1
fi
printf '%s\n' 'ok - TCP and UDP declare the core file checksum for procd upgrades'
