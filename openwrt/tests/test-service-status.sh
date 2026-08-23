#!/bin/sh

set -u

SOURCE="${1:-openwrt/files/usr/sbin/natterctl}"
case "$SOURCE" in
	/*) ;;
	*) SOURCE="$(pwd)/$SOURCE" ;;
esac

TEST_ROOT="$(mktemp -d)" || exit 1
MOCK_BIN="$TEST_ROOT/bin"
MOCK_INIT="$TEST_ROOT/natter-init"
RUNNER="$TEST_ROOT/natterctl"
FAILURES=0

cleanup() {
	rm -rf "$TEST_ROOT"
}
trap cleanup 0 1 2 15

mkdir -p "$MOCK_BIN"
sed -e "s#/etc/init.d/natter#\${NATTER_TEST_INIT}#g" "$SOURCE" > "$RUNNER" || exit 1
chmod +x "$RUNNER"

# These variables must expand when the generated mock runs, not while it is written.
# shellcheck disable=SC2016
printf '%s\n' \
	'#!/bin/sh' \
	'case "$1" in' \
	'  enabled) exit "${MOCK_INIT_ENABLED_RC:-1}" ;;' \
	'  running) exit "${MOCK_PROCD_RUNNING_RC:-1}" ;;' \
	'  *) exit 2 ;;' \
	'esac' > "$MOCK_INIT"
chmod +x "$MOCK_INIT"

# shellcheck disable=SC2016
printf '%s\n' \
	'#!/bin/sh' \
	'if [ "${MOCK_GLOBAL_ENABLED:-0}" = 1 ]; then' \
	'  printf "%s\\n" 1' \
	'  exit 0' \
	'fi' \
	'exit 1' > "$MOCK_BIN/uci"
chmod +x "$MOCK_BIN/uci"

check_state() {
	name="$1"
	global_enabled="$2"
	init_enabled="$3"
	procd_running="$4"
	expected="$5"
	init_rc=1
	running_rc=1
	[ "$init_enabled" = 0 ] || init_rc=0
	[ "$procd_running" = 0 ] || running_rc=0
	output="$(
		PATH="$MOCK_BIN:$PATH" \
		NATTER_TEST_INIT="$MOCK_INIT" \
		MOCK_GLOBAL_ENABLED="$global_enabled" \
		MOCK_INIT_ENABLED_RC="$init_rc" \
		MOCK_PROCD_RUNNING_RC="$running_rc" \
		"$RUNNER" service-status
	)"
	actual="$(printf '%s\n' "$output" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')"
	if [ "$actual" = "$expected" ]; then
		printf 'ok - %s (%s)\n' "$name" "$actual"
	else
		printf 'not ok - %s (expected %s, got %s)\n' "$name" "$expected" "$actual" >&2
		FAILURES=$((FAILURES + 1))
	fi
}

check_state 'fully disabled' 0 0 0 disabled
check_state 'disabled config with autostart link' 0 1 0 disabled
check_state 'disabled config with manual worker' 0 0 1 running-disabled
check_state 'disabled config with autostarted worker' 0 1 1 running-disabled
check_state 'manual start is available' 1 0 0 not-autostarted
check_state 'enabled but failed to start' 1 1 0 stopped
check_state 'manual runtime' 1 0 1 running-manual
check_state 'normal runtime' 1 1 1 running

if [ "$FAILURES" -ne 0 ]; then
	printf '%s service-status test(s) failed\n' "$FAILURES" >&2
	exit 1
fi

printf '%s\n' 'all service-status tests passed'
