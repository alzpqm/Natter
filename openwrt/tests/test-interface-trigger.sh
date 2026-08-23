#!/bin/sh

set -u

SOURCE="${1:-openwrt/files/usr/libexec/natter-interface-trigger}"
case "$SOURCE" in
	/*) ;;
	*) SOURCE="$(pwd)/$SOURCE" ;;
esac

TEST_ROOT="$(mktemp -d)" || exit 1
MOCK_BIN="$TEST_ROOT/bin"
MOCK_INIT="$TEST_ROOT/natter-init"
RUNNER="$TEST_ROOT/natter-interface-trigger"
FAILURES=0

cleanup() {
	rm -rf "$TEST_ROOT"
}
trap cleanup 0 1 2 15

mkdir -p "$MOCK_BIN"

sed \
	-e "s#/etc/init.d/natter#\${NATTER_TEST_INIT}#g" \
	-e "s#RUNTIME_DIR=/var/run/natter#RUNTIME_DIR=\${NATTER_TEST_RUNTIME_DIR}#" \
	-e 's/^[[:space:]]*sleep 1[[:space:]]*$/:/' \
	"$SOURCE" > "$RUNNER" || exit 1
chmod +x "$RUNNER"

# These variables must expand when the generated mock runs, not while it is written.
# shellcheck disable=SC2016
printf '%s\n' \
	'#!/bin/sh' \
	'case "$1" in' \
	'  enabled) exit "${MOCK_ENABLED_RC:-1}" ;;' \
	'  running) exit "${MOCK_RUNNING_RC:-1}" ;;' \
	'  reload) printf "%s\\n" reload >> "$MOCK_RELOAD_LOG"; exit 0 ;;' \
	'  *) exit 2 ;;' \
	'esac' > "$MOCK_INIT"
chmod +x "$MOCK_INIT"

# shellcheck disable=SC2016
printf '%s\n' \
	'#!/bin/sh' \
	'case "${MOCK_INTERFACE_STATE:-down}" in' \
	'  up-a) printf "%s\\n" "{\"l3_device\":\"eth0\",\"ipv4-address\":[{\"address\":\"192.0.2.10\"}]}" ;;' \
	'  up-b) printf "%s\\n" "{\"l3_device\":\"eth0\",\"ipv4-address\":[{\"address\":\"192.0.2.11\"}]}" ;;' \
	'  down) exit 1 ;;' \
	'  *) exit 2 ;;' \
	'esac' > "$MOCK_BIN/ubus"
chmod +x "$MOCK_BIN/ubus"

# shellcheck disable=SC2016
printf '%s\n' \
	'#!/bin/sh' \
	'case "$*" in' \
	'  *l3_device*) printf "%s\\n" eth0 ;;' \
	'  *ipv4-address*)' \
	'    case "${MOCK_INTERFACE_STATE:-down}" in' \
	'      up-a) printf "%s\\n" 192.0.2.10 ;;' \
	'      up-b) printf "%s\\n" 192.0.2.11 ;;' \
	'    esac' \
	'    ;;' \
	'esac' > "$MOCK_BIN/jsonfilter"
chmod +x "$MOCK_BIN/jsonfilter"

# shellcheck disable=SC2016
printf '%s\n' \
	'#!/bin/sh' \
	'[ "${MOCK_MV_FAILURE:-0}" = 1 ] && exit 1' \
	'exec /bin/mv "$@"' > "$MOCK_BIN/mv"
chmod +x "$MOCK_BIN/mv"

# shellcheck disable=SC2016
printf '%s\n' \
	'#!/bin/sh' \
	'[ "${MOCK_MKTEMP_FAILURE:-0}" = 1 ] && exit 1' \
	'exec /usr/bin/mktemp "$@"' > "$MOCK_BIN/mktemp"
chmod +x "$MOCK_BIN/mktemp"

reload_count() {
	if [ -f "$1" ]; then
		wc -l < "$1" | tr -d ' '
	else
		printf '%s\n' 0
	fi
}

check_count() {
	name="$1"
	expected="$2"
	log="$3"
	actual="$(reload_count "$log")"
	if [ "$actual" = "$expected" ]; then
		printf 'ok - %s (reloads=%s)\n' "$name" "$actual"
	else
		printf 'not ok - %s (expected reloads=%s, got %s)\n' "$name" "$expected" "$actual" >&2
		FAILURES=$((FAILURES + 1))
	fi
}

check_status() {
	name="$1"
	expected="$2"
	actual="$3"
	if [ "$actual" = "$expected" ]; then
		printf 'ok - %s (status=%s)\n' "$name" "$actual"
	else
		printf 'not ok - %s (expected status=%s, got %s)\n' "$name" "$expected" "$actual" >&2
		FAILURES=$((FAILURES + 1))
	fi
}

run_event() {
	runtime="$1"
	log="$2"
	enabled_rc="$3"
	running_rc="$4"
	state="$5"
	mv_failure="${6:-0}"
	mktemp_failure="${7:-0}"
	mkdir -p "$runtime"
	PATH="$MOCK_BIN:$PATH" \
		NATTER_TEST_INIT="$MOCK_INIT" \
		NATTER_TEST_RUNTIME_DIR="$runtime" \
		MOCK_RELOAD_LOG="$log" \
		MOCK_ENABLED_RC="$enabled_rc" \
		MOCK_RUNNING_RC="$running_rc" \
		MOCK_INTERFACE_STATE="$state" \
		MOCK_MV_FAILURE="$mv_failure" \
		MOCK_MKTEMP_FAILURE="$mktemp_failure" \
		"$RUNNER" wan
}

runtime="$TEST_ROOT/manual-runtime"
log="$TEST_ROOT/manual-runtime.log"
run_event "$runtime" "$log" 1 0 up-a
check_count 'manual runtime handles an interface event' 1 "$log"

runtime="$TEST_ROOT/stopped-disabled"
log="$TEST_ROOT/stopped-disabled.log"
run_event "$runtime" "$log" 1 1 up-a
check_count 'stopped and disabled stays stopped' 0 "$log"

runtime="$TEST_ROOT/offline-dedup"
log="$TEST_ROOT/offline-dedup.log"
run_event "$runtime" "$log" 0 0 down
run_event "$runtime" "$log" 0 0 down
check_count 'identical offline events are deduplicated' 1 "$log"

runtime="$TEST_ROOT/online-dedup"
log="$TEST_ROOT/online-dedup.log"
run_event "$runtime" "$log" 0 0 up-a
run_event "$runtime" "$log" 0 0 up-a
check_count 'identical online events are deduplicated' 1 "$log"

runtime="$TEST_ROOT/address-change"
log="$TEST_ROOT/address-change.log"
run_event "$runtime" "$log" 0 0 up-a
run_event "$runtime" "$log" 0 0 up-b
check_count 'an IPv4 address change triggers a reload' 2 "$log"

runtime="$TEST_ROOT/stale-lock"
log="$TEST_ROOT/stale-lock.log"
mkdir -p "$runtime/.interface-trigger-wan.lock"
printf '%s\n' 999999 > "$runtime/.interface-trigger-wan.lock/pid"
run_event "$runtime" "$log" 0 0 up-a
check_count 'a stale trigger lock is recovered' 1 "$log"

runtime="$TEST_ROOT/active-lock"
log="$TEST_ROOT/active-lock.log"
mkdir -p "$runtime/.interface-trigger-wan.lock"
printf '%s\n' "$$" > "$runtime/.interface-trigger-wan.lock/pid"
run_event "$runtime" "$log" 0 0 up-a
check_count 'an active trigger lock suppresses a concurrent reload' 0 "$log"

runtime="$TEST_ROOT/mktemp-failure"
log="$TEST_ROOT/mktemp-failure.log"
if run_event "$runtime" "$log" 0 0 up-a 0 1; then
	status=0
else
	status=$?
fi
check_status 'snapshot mktemp failure is reported' 1 "$status"

runtime="$TEST_ROOT/mv-failure"
log="$TEST_ROOT/mv-failure.log"
if run_event "$runtime" "$log" 0 0 up-a 1 0; then
	status=0
else
	status=$?
fi
check_status 'snapshot publish failure is reported' 1 "$status"
temporary_count="$(find "$runtime" -type f -name '.interface-wan.*' | wc -l | tr -d ' ')"
if [ "$temporary_count" = 0 ]; then
	printf '%s\n' 'ok - snapshot publish failure removes its temporary file'
else
	printf 'not ok - snapshot publish failure leaked %s temporary file(s)\n' "$temporary_count" >&2
	FAILURES=$((FAILURES + 1))
fi

if [ "$FAILURES" -ne 0 ]; then
	printf '%s interface-trigger test(s) failed\n' "$FAILURES" >&2
	exit 1
fi

printf '%s\n' 'all interface-trigger tests passed'
