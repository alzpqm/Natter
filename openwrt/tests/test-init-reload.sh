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
