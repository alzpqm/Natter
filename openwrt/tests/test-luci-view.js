#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

if (typeof String.prototype.format !== 'function') {
	Object.defineProperty(String.prototype, 'format', {
		value: function() {
			const values = arguments;
			let index = 0;
			return String(this).replace(/%s/g, () => String(values[index++]));
		}
	});
}

class MockNode {
	constructor(tagName, attributes, children) {
		this.tagName = String(tagName || '').toUpperCase();
		this.attributes = {};
		this.children = [];
		this.className = '';
		this.disabled = false;
		this._textContent = '';
		Object.keys(attributes || {}).forEach(name => this.setAttribute(name, attributes[name]));
		this.append(children);
	}

	append(value) {
		if (Array.isArray(value)) {
			value.forEach(item => this.append(item));
			return;
		}
		if (value !== undefined && value !== null && value !== '')
			this.children.push(value);
	}

	appendChild(value) {
		this.append(value);
		return value;
	}

	removeChild(value) {
		const index = this.children.indexOf(value);
		if (index !== -1)
			this.children.splice(index, 1);
		return value;
	}

	setAttribute(name, value) {
		this.attributes[name] = value;
		if (name === 'class')
			this.className = String(value);
	}

	getAttribute(name) {
		return this.attributes[name];
	}

	get firstChild() {
		return this.children.length ? this.children[0] : null;
	}

	get textContent() {
		return this._textContent;
	}

	set textContent(value) {
		this._textContent = String(value);
		this.children = [];
	}
}

function E(tagName, attributes, children) {
	if (attributes == null || Array.isArray(attributes) ||
	    typeof attributes !== 'object' || attributes instanceof MockNode) {
		children = attributes;
		attributes = {};
	}
	return new MockNode(tagName, attributes, children);
}

const translate = value => String(value);
const L = {
	bind: (callback, receiver) => callback.bind(receiver),
	resolveDefault: (promise, fallback) => Promise.resolve(promise).catch(() => fallback)
};
const view = { extend: value => value };
const inert = {};
const windowMock = { setTimeout: () => 0 };
const source = fs.readFileSync(path.resolve(
	process.argv[2] || 'openwrt/luci-app-natter/root/www/luci-static/resources/view/natter/natter.js'
), 'utf8');
const factory = new Function(
	'view', 'form', 'fs', 'ui', 'poll', 'uci', 'widgets', 'L', 'E', '_', 'window',
	source
);
const definition = factory(view, inert, inert, inert, inert, inert, inert, L, E, translate, windowMock);
const page = Object.create(definition);
const mappings = [
	{ instance: 'ok', interface: 'wanct', protocol: 'tcp', status: 'ok' },
	{ instance: 'starting', interface: 'wancm', protocol: 'udp', status: 'starting' },
	{ instance: 'error', interface: 'wan2', protocol: 'tcp', status: 'error', error: 'failed' },
	{ instance: 'stalled', interface: 'wan2', protocol: 'udp', status: 'stalled', error: 'stalled' },
	{
		instance: 'stale', interface: 'wan2', protocol: 'tcp', status: 'error',
		error_code: 'interface-address-changed', mapped_inside: '192.0.2.30:33001',
		current_inside_ip: '192.0.2.3'
	}
];
const failures = [];

[
	'.natter-runtime-actions{position:sticky',
	'.natter-runtime-actions .btn{flex-basis:calc(50% - .5em)}',
	'padding-bottom:max(.6em,env(safe-area-inset-bottom))',
	'.natter-hero-main{display:flex',
	'.natter-action-bar .btn{min-height:2.55em',
	'.natter-action-bar .btn{flex:1 1 calc(50% - .5em);min-width:8em;min-height:44px}',
	'@media screen and (max-width:360px)',
	'.natter-summary-card .natter-summary-label{white-space:normal',
	'user-select:all'
].forEach(rule => {
	if (!source.includes(rule))
		failures.push('responsive CSS contract is missing: ' + rule);
});
if (source.includes('.natter-action-bar{position:sticky'))
	failures.push('sticky positioning must not apply to every action bar');
if (!source.includes('外部埠由上游 NAT 自動分配，無法在此指定'))
	failures.push('prominent external-port allocation guidance is missing');

page.renderHero();
const statusPanel = page.renderStatus({
	state: 'running-disabled',
	service: { global_enabled: false, init_enabled: true, procd_running: true },
	mappings,
	mappingError: ''
});

if (!statusPanel.className.includes('natter-runtime-panel'))
	failures.push('runtime panel visual role class is missing');
if (!page.heroHealthNode.className.includes('is-danger'))
	failures.push('running-disabled hero health must be dangerous');
if (page.heroTitleNode.textContent !== '仍在執行（全域已停用）')
	failures.push('running-disabled hero title is inaccurate');

if (!page.buttons.start.disabled)
	failures.push('start must be disabled for running-disabled');
if (page.buttons.stop.disabled)
	failures.push('stop must remain enabled for running-disabled');
if (!page.buttons.restart.disabled)
	failures.push('restart must be disabled for running-disabled');
if (page.buttons.refresh.disabled)
	failures.push('refresh must remain enabled for running-disabled');

const expectedRows = { total: 5, mapped: 1, waiting: 1, errors: 3 };
Object.keys(expectedRows).forEach(filter => {
	page.setRuntimeFilter(filter);
	if (page.runtimeTableBody.children.length !== expectedRows[filter]) {
		failures.push('%s filter expected %s rows, got %s'.format(
			filter, expectedRows[filter], page.runtimeTableBody.children.length
		));
	}
	Object.keys(page.summaryCards).forEach(key => {
		const expectedPressed = key === filter ? 'true' : 'false';
		if (page.summaryCards[key].getAttribute('aria-pressed') !== expectedPressed)
			failures.push('%s card aria-pressed is wrong for %s filter'.format(key, filter));
	});
});

page.setRuntimeFilter('unknown-filter');
if (page.runtimeFilter !== 'total' || page.runtimeTableBody.children.length !== 5)
	failures.push('unknown runtime filter must fall back to total');

page.updateRuntime({
	state: 'running',
	service: { global_enabled: true, init_enabled: true, procd_running: true },
	mappings: [
		{ instance: 'tcp', protocol: 'tcp', status: 'ok' },
		{ instance: 'udp', protocol: 'udp', status: 'ok' }
	],
	mappingError: ''
});
if (!page.heroHealthNode.className.includes('is-success'))
	failures.push('all-mapped running hero health must be successful');
if (page.heroTitleNode.textContent !== '服務與映射正常' ||
    !page.heroDetailNode.textContent.includes('2 個協定映射'))
	failures.push('healthy hero summary is inaccurate');

const probePanel = page.renderProbe();
page.updateProbeTable([
	{ interface: 'wan-a', status: 'ok', nat: true },
	{ interface: 'wan-b', status: 'ok', nat: false }
]);
if (!probePanel.className.includes('natter-probe-panel'))
	failures.push('WAN probe panel visual role class is missing');
if (!page.probeSummaryNode.className.includes('is-success') ||
    page.probeSummaryNode.textContent !== '2/2 個 WAN 正常 · 經 NAT 1 · 直連 1')
	failures.push('WAN probe summary is inaccurate');

const checkPanel = page.renderConfigCheck();
page.updateConfigCheckTable([
	{ section: 'one', status: 'ok' },
	{ section: 'two', status: 'ok' },
	{ section: 'three', status: 'conflict' }
]);
if (!checkPanel.className.includes('natter-check-panel'))
	failures.push('config-check panel visual role class is missing');
if (!page.configCheckSummaryNode.className.includes('is-warning') ||
    page.configCheckSummaryNode.textContent !== '2/3 個項目可用')
	failures.push('config-check summary is inaccurate');

if (failures.length) {
	failures.forEach(failure => console.error('not ok - ' + failure));
	process.exit(1);
}

console.log('ok - running-disabled controls preserve stop access');
console.log('ok - runtime summary filters return 5/1/1/3 rows with accurate aria state');
console.log('ok - hero, diagnostics summaries and mobile CSS contracts are accurate');
