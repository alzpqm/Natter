'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require poll';
'require uci';
'require tools.widgets as widgets';

var STATUS_RUNNING = 'running';
var STATUS_RUNNING_MANUAL = 'running-manual';
var STATUS_RUNNING_DISABLED = 'running-disabled';
var STATUS_STOPPED = 'stopped';
var STATUS_DISABLED = 'disabled';
var STATUS_NOT_AUTOSTARTED = 'not-autostarted';
var STATUS_UNKNOWN = 'unknown';

function isRunningState(state) {
	return state === STATUS_RUNNING || state === STATUS_RUNNING_MANUAL ||
		state === STATUS_RUNNING_DISABLED;
}
var BASE_STYLE =
	'.natter-page{--natter-accent:#2563b9;--natter-good:#218739;--natter-warn:#c47700;--natter-danger:#c93442}' +
	'.natter-hero{position:relative;isolation:isolate;overflow:hidden;padding:1.2em 1.35em;margin:0 0 1.1em;border:1px solid rgba(37,99,185,.22);border-radius:14px;background:linear-gradient(135deg,rgba(37,99,185,.12),rgba(33,135,57,.055) 58%,var(--background-color-high,#fff));box-shadow:0 8px 24px rgba(20,55,95,.08)}' +
	'.natter-hero:after{content:"";position:absolute;z-index:-1;right:-4em;top:-5em;width:14em;height:14em;border-radius:50%;background:rgba(37,99,185,.075);pointer-events:none}' +
	'.natter-hero-main{display:flex;align-items:center;justify-content:space-between;gap:1.25em}' +
	'.natter-hero-copy{min-width:0;max-width:52em}' +
	'.natter-eyebrow,.natter-section-kicker{display:block;color:var(--natter-accent);font-size:.74em;font-weight:700;letter-spacing:.08em;text-transform:uppercase}' +
	'.natter-hero-title{margin:.12em 0 .2em;font-size:2em;line-height:1.15}' +
	'.natter-hero-description{margin:0;color:var(--text-color-low,#667085);line-height:1.55}' +
	'.natter-hero-health{display:flex;align-items:center;gap:.7em;flex:0 0 auto;min-width:15.5em;padding:.72em .85em;border:1px solid var(--border-color-medium,rgba(127,127,127,.25));border-radius:10px;background:var(--background-color-high,rgba(255,255,255,.8));box-shadow:0 3px 12px rgba(0,0,0,.05)}' +
	'.natter-health-dot{width:.72em;height:.72em;flex:0 0 .72em;border-radius:50%;background:var(--text-color-low,#777);box-shadow:0 0 0 4px rgba(127,127,127,.12)}' +
	'.natter-hero-health.is-success .natter-health-dot{background:var(--natter-good);box-shadow:0 0 0 4px rgba(33,135,57,.14)}' +
	'.natter-hero-health.is-warning .natter-health-dot{background:var(--natter-warn);box-shadow:0 0 0 4px rgba(196,119,0,.14)}' +
	'.natter-hero-health.is-danger .natter-health-dot{background:var(--natter-danger);box-shadow:0 0 0 4px rgba(201,52,66,.14)}' +
	'.natter-health-copy{display:block;min-width:0}' +
	'.natter-health-title,.natter-health-detail{display:block}' +
	'.natter-health-title{font-weight:700}' +
	'.natter-health-detail{margin-top:.12em;color:var(--text-color-low,#667085);font-size:.86em;line-height:1.4}' +
	'.natter-feature-row{display:flex;align-items:center;flex-wrap:wrap;gap:.45em;margin-top:.9em}' +
	'.natter-feature-chip{display:inline-flex;align-items:center;min-height:2em;padding:.28em .68em;border:1px solid rgba(37,99,185,.18);border-radius:999px;background:rgba(37,99,185,.07);font-size:.84em;font-weight:600}' +
	'.natter-port-note{margin:.8em 0 0;padding:.62em .78em;border-left:3px solid var(--natter-accent);border-radius:0 7px 7px 0;background:rgba(37,99,185,.065);font-size:.9em;line-height:1.5}' +
	'.natter-page .cbi-section{border:1px solid var(--border-color-medium,rgba(127,127,127,.2));border-radius:12px;margin-bottom:1.1em;box-shadow:0 3px 14px rgba(0,0,0,.045)}' +
	'.natter-panel{position:relative}' +
	'.natter-runtime-panel{border-top:3px solid var(--natter-accent)!important}' +
	'.natter-probe-panel{border-top:3px solid var(--natter-good)!important}' +
	'.natter-check-panel{border-top:3px solid var(--natter-warn)!important}' +
	'.natter-config-map{padding-top:.25em}' +
	'.natter-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1em;flex-wrap:wrap}' +
	'.natter-heading-copy{min-width:0}' +
	'.natter-section-title{display:flex;align-items:center;gap:.5em;margin:.12em 0 0}' +
	'.natter-section-help{color:var(--text-color-low,#777);margin:.35em 0 .8em;line-height:1.5}' +
	'.natter-panel-meta{display:flex;align-items:center;justify-content:flex-end;gap:.55em;flex-wrap:wrap}' +
	'.natter-result-chip{display:inline-flex;align-items:center;min-height:1.9em;padding:.22em .62em;border:1px solid var(--border-color-medium,rgba(127,127,127,.25));border-radius:999px;background:var(--background-color-low,rgba(127,127,127,.08));font-size:.84em;font-weight:600;white-space:nowrap}' +
	'.natter-result-chip.is-success{border-color:rgba(33,135,57,.28);background:rgba(33,135,57,.1);color:var(--natter-good)}' +
	'.natter-result-chip.is-warning{border-color:rgba(196,119,0,.3);background:rgba(196,119,0,.1);color:var(--natter-warn)}' +
	'.natter-result-chip.is-danger{border-color:rgba(201,52,66,.3);background:rgba(201,52,66,.1);color:var(--natter-danger)}' +
	'.natter-table-wrap{width:100%;overflow-x:auto;border:1px solid var(--border-color-medium,rgba(127,127,127,.2));border-radius:8px}' +
	'.natter-table-wrap>table{margin:0;min-width:760px}' +
	'.natter-runtime-table thead th{position:sticky;top:0;z-index:1;background:var(--background-color-high,#fff);white-space:nowrap}' +
	'.natter-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.65em;margin:.8em 0 1em}' +
	'.natter-summary-card{min-width:0;padding:.8em .9em;border:1px solid var(--border-color-medium,rgba(127,127,127,.28));border-radius:8px;background:var(--background-color-low,rgba(127,127,127,.06))}' +
	'button.natter-summary-card{width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;appearance:none}' +
	'button.natter-summary-card{transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}' +
	'button.natter-summary-card:hover{border-color:var(--text-color-medium,#888);transform:translateY(-1px)}' +
	'button.natter-summary-card:focus-visible{outline:2px solid var(--primary-color,#3478c5);outline-offset:2px}' +
	'button.natter-summary-card[aria-pressed="true"]{box-shadow:0 0 0 2px var(--natter-accent);background:var(--background-color-high,#fff)}' +
	'.natter-summary-card .natter-summary-label{display:block;color:var(--text-color-low,#777);font-size:.9em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
	'.natter-summary-card .natter-summary-value{display:block;margin-top:.25em;font-size:1.5em;line-height:1.15;font-variant-numeric:tabular-nums}' +
	'.natter-summary-card.natter-summary-total{border-left:4px solid var(--text-color-medium,#888)}' +
	'.natter-summary-card.natter-summary-mapped{border-left:4px solid #2e9f45}' +
	'.natter-summary-card.natter-summary-waiting{border-left:4px solid #d99000}' +
	'.natter-summary-card.natter-summary-errors{border-left:4px solid #d33}' +
	'.natter-runtime-table tr.natter-state-ok>td{background:rgba(46,159,69,.035)}' +
	'.natter-runtime-table tr.natter-state-error>td{background:rgba(210,50,50,.08)}' +
	'.natter-runtime-table tr.natter-state-waiting>td{background:rgba(220,155,0,.07)}' +
	'.natter-runtime-table tr.natter-state-stalled>td{background:rgba(210,50,50,.08)}' +
	'.natter-runtime-table tbody tr:hover>td{filter:saturate(1.12)}' +
	'.natter-label-danger{background:#c93232!important;color:#fff!important}' +
	'.natter-action-bar{display:flex;align-items:center;flex-wrap:wrap;gap:.5em;margin-top:1em}' +
	'.natter-action-bar .btn{min-height:2.55em;margin:0!important}' +
	'.natter-status-live{display:flex;align-items:baseline;gap:.45em;flex-wrap:wrap;font-weight:600;line-height:1.8}' +
	'.natter-status-reason{color:var(--text-color-low,#777);font-weight:400}' +
	'.natter-service-meta{display:flex;align-items:center;flex-wrap:wrap;gap:.45em;margin:.45em 0 .8em}' +
	'.natter-endpoint{display:inline-block;max-width:100%;padding:.08em .32em;border:1px solid rgba(127,127,127,.12);border-radius:4px;background:var(--background-color-low,rgba(127,127,127,.08));font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.92em;font-variant-numeric:tabular-nums;direction:ltr;text-align:left;overflow-wrap:anywhere;word-break:break-word;user-select:all}' +
	'.natter-refresh-time{color:var(--text-color-low,#777);font-size:.9em;white-space:nowrap}' +
	'.natter-runtime-meta{display:flex;align-items:center;gap:.75em;flex-wrap:wrap}' +
	'.natter-inline-note{font-size:.9em;color:var(--text-color-low,#777)}';
var MOBILE_STYLE = '@media screen and (max-width:700px){' +
	'.natter-hero{padding:1em;margin-bottom:.8em;border-radius:11px}' +
	'.natter-hero-main{display:block}' +
	'.natter-hero-title{font-size:1.65em}' +
	'.natter-hero-health{width:100%;min-width:0;margin-top:.85em;box-sizing:border-box}' +
	'.natter-feature-row{gap:.35em}' +
	'.natter-feature-chip{font-size:.8em}' +
	'.natter-port-note{font-size:.86em}' +
	'.natter-page .cbi-section{border-radius:10px;margin-bottom:.8em}' +
	'.natter-panel-head{display:block}' +
	'.natter-panel-meta{justify-content:flex-start;margin-top:.45em}' +
	'.natter-runtime-meta{margin-top:.35em}' +
	'.natter-status-live{display:block}' +
	'.natter-status-reason{display:block;margin-top:.25em;line-height:1.5}' +
	'.natter-service-meta{margin:.45em 0 .65em}' +
	'.natter-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:.5em}' +
	'.natter-summary-card{min-height:4.45em;padding:.6em .7em}' +
	'.natter-summary-card .natter-summary-label{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.3}' +
	'.natter-summary-card .natter-summary-value{font-size:1.25em}' +
	'.natter-action-bar .btn{flex:1 1 calc(50% - .5em);min-width:8em;min-height:44px}' +
	'.natter-responsive-table{display:block!important;width:100%!important;min-width:0!important}' +
	'.natter-responsive-table thead{display:none!important}' +
	'.natter-responsive-table tbody{display:block!important;width:100%!important}' +
	'.natter-responsive-table tbody>tr{display:block!important;width:100%!important;max-width:100%!important;' +
		'margin:.65em 0;padding:.5em .7em;border:1px solid rgba(127,127,127,.3);' +
		'border-radius:9px;box-sizing:border-box;box-shadow:0 2px 8px rgba(0,0,0,.05);overflow:hidden}' +
	'.natter-responsive-table tbody>tr>td{display:grid!important;' +
		'grid-template-columns:minmax(6.25em,34%) minmax(0,1fr);column-gap:.65em;' +
		'width:100%!important;min-width:0!important;max-width:100%!important;' +
		'margin:0!important;padding:.35em 0!important;' +
		'text-align:left!important;overflow-wrap:anywhere;box-sizing:border-box}' +
	'.natter-responsive-table tbody>tr>td:before{content:attr(data-title);color:var(--text-color-low,#667085);font-size:.82em;font-weight:700;letter-spacing:.02em;line-height:1.45}' +
	'.natter-responsive-table tbody>tr>td>*{grid-column:2;max-width:100%;min-width:0}' +
	'.natter-responsive-table tbody>tr>td[colspan]{display:block!important}' +
	'.natter-responsive-table tbody>tr>td[colspan]:before{display:none}' +
	'.natter-responsive-table input,.natter-responsive-table select{' +
		'width:100%!important;max-width:100%!important;box-sizing:border-box}' +
	'.natter-runtime-table thead th{position:static}' +
	'.natter-table-wrap{overflow:visible;border:0}' +
	'.natter-table-wrap>table{min-width:0}' +
	'.natter-endpoint{font-size:.86em}' +
	'.natter-runtime-actions{position:sticky;bottom:0;z-index:3;padding:.6em .4em;padding-bottom:max(.6em,env(safe-area-inset-bottom));border:1px solid var(--border-color-medium,rgba(127,127,127,.2));border-radius:9px;background:var(--background-color-high,#fff);box-shadow:0 -3px 12px rgba(0,0,0,.13)}' +
	'}' +
	'@media screen and (max-width:420px){' +
	'.natter-action-bar .btn{flex-basis:100%;min-width:0}' +
	'.natter-runtime-actions .btn{flex-basis:calc(50% - .5em)}' +
	'.natter-result-chip{white-space:normal}' +
	'}' +
	'@media screen and (max-width:360px){' +
	'.natter-feature-chip{width:100%;justify-content:center;box-sizing:border-box}' +
	'.natter-runtime-actions .btn{flex-basis:100%}' +
	'}';

function prepareResponsiveTable(table) {
	var headers;

	if (!table)
		return;
	table.classList.add('natter-responsive-table');
	headers = Array.prototype.map.call(table.querySelectorAll('thead th'),
		function(header, index, all) {
			var text = String(header.textContent || '').trim();
			return text || (index === all.length - 1 ? _('操作') : '');
		});
	Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(row) {
		Array.prototype.forEach.call(row.children, function(cell, index) {
			if (cell.tagName === 'TD' && !cell.hasAttribute('colspan'))
				cell.setAttribute('data-title', headers[index] || '');
		});
	});
}

function networkL3DeviceName(network) {
	var device;

	if (!network || typeof network.getL3Device !== 'function')
		return null;

	device = network.getL3Device();
	return device && typeof device.getName === 'function'
		? device.getName()
		: null;
}

function isRedundantIpv6Network(networks, name) {
	var base, derived;

	name = String(name == null ? '' : name);
	if (!name.match(/_6$/))
		return false;

	for (var i = 0; i < networks.length; i++) {
		if (networks[i].getName() === name.slice(0, -2))
			base = networks[i];
		else if (networks[i].getName() === name)
			derived = networks[i];
	}

	return !!base && !!derived &&
		networkL3DeviceName(base) != null &&
		networkL3DeviceName(base) === networkL3DeviceName(derived);
}

function parseServiceStatus(result) {
	var output = result && [ result.stdout || '', result.stderr || '' ].join(' ').trim();

	if (!result || typeof result !== 'object')
		return STATUS_UNKNOWN;
	if (result.code === 3 || result.code === 5 ||
	    output.match(/inactive|stopped|not running|no instances/i))
		return STATUS_STOPPED;
	if (result.code === 0 && output.match(/running/i))
		return STATUS_RUNNING;

	return STATUS_UNKNOWN;
}

function parseServiceMetadata(result) {
	var data;

	if (!result || result.code !== 0)
		return null;
	try {
		data = JSON.parse(String(result.stdout || '{}'));
	}
	catch (error) {
		return null;
	}
	return data && typeof data.state === 'string' ? data : null;
}

function validEndpoint(sectionId, value) {
	value = String(value == null ? '' : value).trim();
	if (value === '')
		return true;
	if (!value.match(/^[A-Za-z0-9.-]+:[0-9]+$/))
		return _('請輸入主機名稱或 IPv4 位址，後接埠號。');

	var port = Number(value.slice(value.lastIndexOf(':') + 1));
	return port >= 1 && port <= 65535 || _('埠號必須介於 1 到 65535。');
}

function validIPv4(sectionId, value) {
	var parts = String(value == null ? '' : value).split('.');

	if (parts.length !== 4)
		return _('請輸入不含前綴長度的 IPv4 位址。');
	for (var i = 0; i < parts.length; i++) {
		if (!parts[i].match(/^(?:0|[1-9][0-9]{0,2})$/) || Number(parts[i]) > 255)
			return _('請輸入不含前綴長度的 IPv4 位址。');
	}

	return true;
}

function validOptionalAbsolutePath(sectionId, value) {
	return value == null || value === '' || String(value).charAt(0) === '/' ||
		_('請使用絕對路徑。');
}

function sleep(milliseconds) {
	return new Promise(function(resolve) { window.setTimeout(resolve, milliseconds); });
}

function formatUpdatedTime(value) {
	var timestamp = Number(value);

	if (!isFinite(timestamp) || timestamp <= 0)
		return '—';
	return new Date(timestamp * 1000).toLocaleString(undefined, {
		month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
	});
}

function formatClockTime(value) {
	return new Date(value || Date.now()).toLocaleTimeString(undefined, {
		hour: '2-digit', minute: '2-digit', second: '2-digit'
	});
}

function isTruthyFlag(value) {
	return value === true || value === 1 || value === '1' || value === 'true';
}

function endpointNode(value) {
	value = String(value == null || value === '' ? '—' : value);
	return value === '—' ? value : E('code', { 'class': 'natter-endpoint' }, value);
}

function sectionHeading(kicker, title) {
	return E('div', { 'class': 'natter-heading-copy' }, [
		E('span', { 'class': 'natter-section-kicker' }, kicker),
		E('h3', { 'class': 'natter-section-title' }, title)
	]);
}

function setResultChip(node, state, text) {
	if (!node)
		return;
	node.className = 'natter-result-chip is-%s'.format(state || 'neutral');
	node.textContent = text;
}

function countRuntimeStates(mappings) {
	var counts = { total: 0, mapped: 0, waiting: 0, errors: 0 };

	(mappings || []).forEach(function(item) {
		counts.total++;
		if (item.status === 'ok')
			counts.mapped++;
		else if (item.status === 'error' || item.status === 'stalled')
			counts.errors++;
		else
			counts.waiting++;
	});
	return counts;
}

function runtimeDetail(item) {
	var detail = String(item && item.error || '');
	var stalled;

	if (item && item.error_code === 'interface-unavailable')
		return _('所選 WAN 目前沒有可用的 IPv4 位址；舊映射已失效，服務會在介面恢復後重建。');
	if (item && item.error_code === 'interface-address-changed')
		return _('WAN IPv4 位址已從 %s 變更為 %s；畫面中的公網端點是舊映射，必須重建。')
			.format(String(item.mapped_inside || '—').split(':')[0] || '—',
				String(item.current_inside_ip || '—'));
	if (detail === 'waiting for a STUN mapping response')
		return item.wait_seconds != null
			? _('正在等待 STUN 回應（已等待 %s 秒）').format(item.wait_seconds)
			: _('正在等待 STUN 回應。');
	if (detail === 'mapping process is not running')
		return _('映射程序未執行。');
	stalled = detail.match(/^no STUN mapping state after ([0-9]+)s$/);
	if (stalled)
		return _('超過 %s 秒仍未取得 STUN 映射；請檢查 WAN、STUN 伺服器與代理繞過設定。')
			.format(stalled[1]);

	return detail;
}

function runtimeMatchesFilter(item, filter) {
	if (filter === 'mapped')
		return item.status === 'ok';
	if (filter === 'errors')
		return item.status === 'error' || item.status === 'stalled';
	if (filter === 'waiting')
		return item.status !== 'ok' && item.status !== 'error' && item.status !== 'stalled';
	return true;
}

return view.extend({
	getPublicAddresses: function() {
		return fs.exec('/usr/sbin/natterctl', [ 'probe-all' ]).then(function(result) {
			var data;

			if (!result || result.code !== 0)
				throw new Error(result && (result.stderr || result.stdout) ||
					_('公網位址探測失敗。'));
			try {
				data = JSON.parse(String(result.stdout || '[]'));
			}
			catch (error) {
				throw new Error(_('探測工具回傳了無效資料。'));
			}
			if (!Array.isArray(data))
				throw new Error(_('探測工具回傳了無效資料。'));
			return data;
		});
	},

	updateProbeTable: function(results, error) {
		var body = this.probeTableBody, okCount = 0, natCount = 0, directCount = 0;

		if (!body)
			return;
		while (body.firstChild)
			body.removeChild(body.firstChild);

		if (error) {
			setResultChip(this.probeSummaryNode, 'danger', _('探測失敗'));
			if (this.probeUpdatedNode)
				this.probeUpdatedNode.textContent = _('上次檢查失敗：%s').format(formatClockTime());
			body.appendChild(E('tr', {}, [
				E('td', { 'colspan': '6', 'class': 'alert-message warning' },
					_('探測失敗：%s').format(error))
			]));
			return;
		}

		if (!results || !results.length) {
			setResultChip(this.probeSummaryNode, 'warning', _('找不到 WAN'));
			if (this.probeUpdatedNode)
				this.probeUpdatedNode.textContent = _('檢查時間：%s').format(formatClockTime());
			body.appendChild(E('tr', {}, [
				E('td', { 'colspan': '6' }, _('找不到可用的 WAN 介面。若未安裝 mwan3，請先在映射設定中選取一般 WAN。'))
			]));
			return;
		}
		if (this.probeUpdatedNode)
			this.probeUpdatedNode.textContent = _('檢查時間：%s').format(formatClockTime());
		results.forEach(function(item) {
			if (item.status === 'ok')
				okCount++;
			if (item.nat === true)
				natCount++;
			else if (item.nat === false)
				directCount++;
		});
		setResultChip(this.probeSummaryNode,
			okCount === results.length ? 'success' : okCount ? 'warning' : 'danger',
			_('%s/%s 個 WAN 正常 · 經 NAT %s · 直連 %s')
				.format(okCount, results.length, natCount, directCount));

		results.forEach(function(item) {
			var state, nat, rowClass;

			if (item.status === 'ok') {
				state = E('span', { 'class': 'label success' }, _('正常'));
				rowClass = 'natter-state-ok';
			}
			else if (item.status === 'offline') {
				state = E('span', { 'class': 'label warning' }, _('離線'));
				rowClass = 'natter-state-waiting';
			}
			else {
				state = E('span', { 'class': 'label warning' }, _('失敗'));
				rowClass = 'natter-state-error';
			}
			if (item.error)
				state.title = String(item.error);

			nat = item.nat === true ? _('是') :
				item.nat === false ? _('否（直接使用公網 IP）') : '—';
			body.appendChild(E('tr', { 'class': rowClass }, [
				E('td', { 'data-title': _('WAN') }, String(item.interface || '—')),
				E('td', { 'data-title': _('L3 裝置') }, String(item.device || '—')),
				E('td', { 'data-title': _('WAN IPv4 位址') }, endpointNode(item.inside_ip)),
				E('td', { 'data-title': _('公網 IPv4 位址') }, endpointNode(item.public_ip)),
				E('td', { 'data-title': _('NAT') }, nat),
				E('td', { 'data-title': _('狀態') }, state)
			]));
		});
	},

	setProbeBusy: function(busy) {
		this.probeBusy = busy;
		if (this.probeButton) {
			this.probeButton.disabled = busy;
			this.probeButton.setAttribute('aria-busy', busy ? 'true' : 'false');
			this.probeButton.textContent = busy ? _('探測中…') : _('探測所有 WAN');
		}
	},

	probeAllWans: function() {
		if (this.probeBusy)
			return Promise.resolve();

		this.setProbeBusy(true);
		return this.getPublicAddresses().then(L.bind(function(results) {
			this.updateProbeTable(results);
		}, this)).catch(L.bind(function(error) {
			this.updateProbeTable(null, error.message);
			ui.addTimeLimitedNotification(null,
				E('p', _('WAN 公網位址探測失敗：%s').format(error.message)),
				7000, 'warning');
		}, this)).finally(L.bind(function() {
			this.setProbeBusy(false);
		}, this));
	},

	renderProbe: function() {
		this.probeTableBody = E('tbody', {}, [
			E('tr', {}, [ E('td', { 'colspan': '6' }, _('等待探測…')) ])
		]);
		this.probeUpdatedNode = E('span', {
			'class': 'natter-refresh-time',
			'aria-live': 'polite'
		}, _('尚未檢查'));
		this.probeSummaryNode = E('span', {
			'class': 'natter-result-chip is-neutral',
			'aria-live': 'polite'
		}, _('等待探測'));
		this.probeButton = E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-action',
			'click': L.bind(function(ev) {
				ev.preventDefault();
				return this.probeAllWans();
			}, this)
		}, _('探測所有 WAN'));

		return E('div', { 'class': 'cbi-section natter-panel natter-probe-panel' }, [
			E('div', { 'class': 'natter-panel-head' }, [
				sectionHeading(_('出口檢查'), _('WAN 公網位址')),
				E('div', { 'class': 'natter-panel-meta' }, [
					this.probeSummaryNode, this.probeUpdatedNode
				])
			]),
			E('p', { 'class': 'natter-section-help' }, _('已安裝 mwan3 時會逐一探測其 WAN；未安裝 mwan3 時會探測已啟用映射所使用的 WAN。探測使用中國大陸 UDP STUN，且不會新增任何入站防火牆規則。')),
				E('div', { 'class': 'natter-table-wrap' }, [
				E('table', {
					'class': 'table natter-responsive-table',
					'aria-label': _('WAN 公網位址清單')
				}, [
					E('thead', {}, [ E('tr', {}, [
						E('th', {}, _('WAN')),
						E('th', {}, _('L3 裝置')),
						E('th', {}, _('WAN IPv4 位址')),
						E('th', {}, _('公網 IPv4 位址')),
						E('th', {}, _('NAT')),
						E('th', {}, _('狀態'))
					]) ]),
					this.probeTableBody
				])
			]),
				E('div', { 'class': 'cbi-page-actions natter-action-bar' }, [ this.probeButton ])
		]);
	},

	getConfigChecks: function() {
		return fs.exec('/usr/sbin/natterctl', [ 'check-config' ]).then(function(result) {
			var data;

			if (!result || result.code !== 0)
				throw new Error(result && (result.stderr || result.stdout) ||
					_('設定檢查失敗。'));
			try {
				data = JSON.parse(String(result.stdout || '[]'));
			}
			catch (error) {
				throw new Error(_('設定檢查回傳了無效資料。'));
			}
			if (!Array.isArray(data))
				throw new Error(_('設定檢查回傳了無效資料。'));
			return data;
		});
	},

	updateConfigCheckTable: function(results, error) {
		var body = this.configCheckTableBody, okCount = 0;

		if (!body)
			return;
		while (body.firstChild)
			body.removeChild(body.firstChild);

		if (error) {
			setResultChip(this.configCheckSummaryNode, 'danger', _('檢查失敗'));
			if (this.configCheckUpdatedNode)
				this.configCheckUpdatedNode.textContent = _('上次檢查失敗：%s').format(formatClockTime());
			body.appendChild(E('tr', {}, [
				E('td', { 'colspan': '6', 'class': 'alert-message warning' },
					_('設定檢查失敗：%s').format(error))
			]));
			return;
		}
		if (!results || !results.length) {
			setResultChip(this.configCheckSummaryNode, 'warning', _('沒有啟用項目'));
			if (this.configCheckUpdatedNode)
				this.configCheckUpdatedNode.textContent = _('檢查時間：%s').format(formatClockTime());
			body.appendChild(E('tr', {}, [
				E('td', { 'colspan': '6' }, _('目前沒有已啟用的映射。'))
			]));
			return;
		}
		if (this.configCheckUpdatedNode)
			this.configCheckUpdatedNode.textContent = _('檢查時間：%s').format(formatClockTime());
		results.forEach(function(item) {
			if (item.status === 'ok')
				okCount++;
		});
		setResultChip(this.configCheckSummaryNode,
			okCount === results.length ? 'success' : okCount ? 'warning' : 'danger',
			_('%s/%s 個項目可用').format(okCount, results.length));

		results.forEach(function(item) {
			var resultNode, text, rowClass;

			if (item.status === 'ok') {
				resultNode = E('span', { 'class': 'label success' }, _('可用'));
				rowClass = 'natter-state-ok';
			}
			else {
				text = item.status === 'conflict' ? _('埠衝突') :
					item.status === 'offline' ? _('離線') :
					item.status === 'disabled' ? _('已停用') : _('無效');
				resultNode = E('span', { 'class': 'label warning' }, text);
				rowClass = item.status === 'conflict' || item.status === 'invalid'
					? 'natter-state-error' : 'natter-state-waiting';
			}
			body.appendChild(E('tr', { 'class': rowClass }, [
				E('td', { 'data-title': _('映射') }, String(item.section || '—')),
				E('td', { 'data-title': _('WAN') }, String(item.interface || '—')),
				E('td', { 'data-title': _('L3 裝置') }, String(item.device || '—')),
				E('td', { 'data-title': _('協定') }, String(item.protocol || '—').toUpperCase()),
				E('td', { 'data-title': _('內部埠') }, item.bind_port == null ? '—' : String(item.bind_port)),
				E('td', { 'data-title': _('結果') }, [ resultNode, item.error ? E('div', {
					'class': 'cbi-value-description'
				}, String(item.error)) : '' ])
			]));
		});
	},

	setConfigCheckBusy: function(busy) {
		this.configCheckBusy = busy;
		if (this.configCheckButton) {
			this.configCheckButton.disabled = busy;
			this.configCheckButton.setAttribute('aria-busy', busy ? 'true' : 'false');
			this.configCheckButton.textContent = busy ? _('檢查中…') : _('檢查內部埠');
		}
	},

	checkConfiguredPorts: function() {
		if (this.configCheckBusy)
			return Promise.resolve();
		this.setConfigCheckBusy(true);
		return this.getConfigChecks().then(L.bind(function(results) {
			this.updateConfigCheckTable(results);
		}, this)).catch(L.bind(function(error) {
			this.updateConfigCheckTable(null, error.message);
		}, this)).finally(L.bind(function() {
			this.setConfigCheckBusy(false);
		}, this));
	},

	renderConfigCheck: function() {
		this.configCheckTableBody = E('tbody', {}, [
			E('tr', {}, [ E('td', { 'colspan': '6' }, _('等待檢查…')) ])
		]);
		this.configCheckUpdatedNode = E('span', {
			'class': 'natter-refresh-time',
			'aria-live': 'polite'
		}, _('尚未檢查'));
		this.configCheckSummaryNode = E('span', {
			'class': 'natter-result-chip is-neutral',
			'aria-live': 'polite'
		}, _('等待檢查'));
		this.configCheckButton = E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-action',
			'click': L.bind(function(ev) {
				ev.preventDefault();
				return this.checkConfiguredPorts();
			}, this)
		}, _('檢查內部埠'));

		return E('div', { 'class': 'cbi-section natter-panel natter-check-panel' }, [
			E('div', { 'class': 'natter-panel-head' }, [
				sectionHeading(_('設定診斷'), _('已設定的內部埠')),
				E('div', { 'class': 'natter-panel-meta' }, [
					this.configCheckSummaryNode, this.configCheckUpdatedNode
				])
			]),
			E('p', { 'class': 'natter-section-help' }, _('使用與 Natter 相同的裝置綁定、socket mark 與埠共用選項檢查已啟用的映射。發生協定衝突時，不會建立防火牆規則。')),
			E('div', { 'class': 'natter-table-wrap' }, [
			E('table', {
				'class': 'table natter-responsive-table',
				'aria-label': _('已設定的內部埠清單')
			}, [
				E('thead', {}, [ E('tr', {}, [
					E('th', {}, _('映射')),
					E('th', {}, _('WAN')),
					E('th', {}, _('L3 裝置')),
					E('th', {}, _('協定')),
					E('th', {}, _('內部埠')),
					E('th', {}, _('結果'))
				]) ]),
				this.configCheckTableBody
			]) ]),
			E('div', { 'class': 'cbi-page-actions natter-action-bar' }, [ this.configCheckButton ])
		]);
	},

	getRuntime: function() {
		return Promise.all([
			L.resolveDefault(fs.exec('/etc/init.d/natter', [ 'status' ]), null),
			L.resolveDefault(fs.exec('/usr/sbin/natterctl', [ 'status-json' ]), null),
			L.resolveDefault(fs.exec('/usr/sbin/natterctl', [ 'service-status' ]), null)
		]).then(function(results) {
			var mappings = [], mappingError = '', service;

			if (!results[1] || results[1].code !== 0) {
				mappingError = results[1] && (results[1].stderr || results[1].stdout) ||
					_('無法取得映射狀態。');
			}
			else {
				try {
					mappings = JSON.parse(String(results[1].stdout || '[]'));
					if (!Array.isArray(mappings))
						throw new Error('not an array');
				}
				catch (error) {
					mappings = [];
					mappingError = _('映射狀態回傳了無效資料。');
				}
			}
			service = parseServiceMetadata(results[2]);
			return {
				state: service ? service.state : parseServiceStatus(results[0]),
				service: service,
				mappings: mappings,
				mappingError: String(mappingError || '').trim()
			};
		});
	},

	load: function() {
		return Promise.all([ L.resolveDefault(uci.load('mwan3'), null), this.getRuntime() ]);
	},

	statusLabel: function(state) {
		if (state === STATUS_RUNNING)
			return { text: _('執行中'), cssClass: 'label success' };
		if (state === STATUS_RUNNING_MANUAL)
			return { text: _('手動執行中'), cssClass: 'label warning' };
		if (state === STATUS_RUNNING_DISABLED)
			return { text: _('仍在執行（全域已停用）'), cssClass: 'label natter-label-danger' };
		if (state === STATUS_DISABLED)
			return { text: _('已停用'), cssClass: 'label warning' };
		if (state === STATUS_NOT_AUTOSTARTED)
			return { text: _('未啟用開機自啟'), cssClass: 'label warning' };
		if (state === STATUS_STOPPED)
			return { text: _('已停止（無執行實例）'), cssClass: 'label warning' };
		return { text: _('未知'), cssClass: 'label warning' };
	},

	statusReason: function(state, service) {
		if (state === STATUS_RUNNING_MANUAL)
			return _('目前有執行中的實例，但未啟用開機自啟。');
		if (state === STATUS_RUNNING_DISABLED)
			return _('全域開關已停用，但 procd 實例仍在執行；請停止服務或重新套用設定。');
		if (state === STATUS_DISABLED)
			return _('全域 Natter 開關已停用。');
		if (state === STATUS_NOT_AUTOSTARTED)
			return _('服務未設為開機啟用，但可以手動啟動。');
		if (state === STATUS_STOPPED)
			return _('沒有執行中的 procd 實例；可能是啟動失敗。');
		if (state === STATUS_RUNNING)
			return _('procd 至少有一個執行中的 Natter 實例。');
		return _('無法判斷服務狀態。');
	},

	renderHero: function() {
		this.heroTitleNode = E('strong', {
			'class': 'natter-health-title'
		}, _('正在讀取狀態…'));
		this.heroDetailNode = E('span', {
			'class': 'natter-health-detail'
		}, _('請稍候'));
		this.heroHealthNode = E('div', {
			'class': 'natter-hero-health is-warning',
			'aria-live': 'polite'
		}, [
			E('span', { 'class': 'natter-health-dot', 'aria-hidden': 'true' }),
			E('span', { 'class': 'natter-health-copy' }, [
				this.heroTitleNode, this.heroDetailNode
			])
		]);

		return E('section', {
			'class': 'natter-hero',
			'aria-labelledby': 'natter-page-title'
		}, [
			E('div', { 'class': 'natter-hero-main' }, [
				E('div', { 'class': 'natter-hero-copy' }, [
					E('span', { 'class': 'natter-eyebrow' }, _('OpenWrt 多 WAN NAT 穿透')),
					E('h2', { 'id': 'natter-page-title', 'class': 'natter-hero-title' }, _('Natter')),
					E('p', { 'class': 'natter-hero-description' },
						_('集中查看服務、映射與各 WAN 公網位址，並以獨立出口維持 TCP／UDP NAT 映射。'))
				]),
				this.heroHealthNode
			]),
			E('div', { 'class': 'natter-feature-row', 'aria-label': _('主要功能') }, [
				E('span', { 'class': 'natter-feature-chip' }, _('多 WAN 個別出口')),
				E('span', { 'class': 'natter-feature-chip' }, _('中國大陸 STUN 探測')),
				E('span', { 'class': 'natter-feature-chip' }, _('TCP／UDP 獨立映射'))
			]),
			E('p', { 'class': 'natter-port-note' },
				_('外部埠由上游 NAT 自動分配，無法在此指定；TCP 與 UDP 的外部埠可能不同。'))
		]);
	},

	updateHero: function(runtime) {
		var counts, severity = 'warning', title, detail;

		if (!this.heroHealthNode)
			return;
		runtime = runtime || { state: STATUS_UNKNOWN, mappings: [] };
		counts = countRuntimeStates(runtime.mappings);

		if (this.busy) {
			title = _('正在處理服務操作');
			detail = _('完成後會自動重新整理狀態。');
		}
		else if (runtime.mappingError) {
			severity = 'danger';
			title = _('映射狀態無法讀取');
			detail = String(runtime.mappingError);
		}
		else if (runtime.state === STATUS_RUNNING && counts.total > 0 &&
		         counts.mapped === counts.total) {
			severity = 'success';
			title = _('服務與映射正常');
			detail = _('%s 個協定映射均已建立').format(counts.total);
		}
		else if (runtime.state === STATUS_RUNNING) {
			severity = counts.errors ? 'danger' : 'warning';
			title = counts.errors ? _('部分映射發生錯誤') : _('服務執行中，映射尚未完成');
			detail = _('%s/%s 個映射已建立 · 等待 %s · 錯誤 %s')
				.format(counts.mapped, counts.total, counts.waiting, counts.errors);
		}
		else {
			severity = runtime.state === STATUS_RUNNING_DISABLED ||
				runtime.state === STATUS_UNKNOWN ? 'danger' : 'warning';
			title = this.statusLabel(runtime.state).text;
			detail = this.statusReason(runtime.state, runtime.service);
		}

		this.heroHealthNode.className = 'natter-hero-health is-%s'.format(severity);
		this.heroTitleNode.textContent = title;
		this.heroDetailNode.textContent = detail;
	},

	updateServiceMeta: function(service) {
		var globalEnabled, initEnabled, node;

		if (!this.serviceMetaNode)
			return;
		while (this.serviceMetaNode.firstChild)
			this.serviceMetaNode.removeChild(this.serviceMetaNode.firstChild);

		if (!service) {
			this.serviceMetaNode.appendChild(E('span', {
				'class': 'label warning'
			}, _('服務詳細狀態無法取得')));
			return;
		}

		globalEnabled = isTruthyFlag(service.global_enabled);
		initEnabled = isTruthyFlag(service.init_enabled);
		node = E('span', {
			'class': 'label %s'.format(globalEnabled ? 'success' : 'warning')
		}, _('全域開關：%s').format(globalEnabled ? _('已啟用') : _('已停用')));
		this.serviceMetaNode.appendChild(node);
		node = E('span', {
			'class': 'label %s'.format(initEnabled ? 'success' : 'warning')
		}, _('開機自啟：%s').format(initEnabled ? _('已啟用') : _('未啟用')));
		this.serviceMetaNode.appendChild(node);
	},

	updateRuntimeTable: function(mappings, error) {
		var body = this.runtimeTableBody, visibleMappings;

		if (!body)
			return;
		while (body.firstChild)
			body.removeChild(body.firstChild);

		if (error) {
			body.appendChild(E('tr', {}, [
				E('td', { 'colspan': '8', 'class': 'alert-message warning' },
					_('執行狀態取得失敗：%s').format(error))
			]));
			return;
		}
		if (!mappings || !mappings.length) {
			body.appendChild(E('tr', {}, [
				E('td', { 'colspan': '8' }, _('目前沒有作用中的映射，也沒有回報錯誤。'))
			]));
			return;
		}
		visibleMappings = mappings.filter(function(item) {
			return runtimeMatchesFilter(item, this.runtimeFilter);
		}, this);
		if (!visibleMappings.length) {
			body.appendChild(E('tr', {}, [
				E('td', { 'colspan': '8' }, _('目前篩選條件沒有符合的映射。'))
			]));
			return;
		}

		visibleMappings.forEach(function(item) {
			var state, stateText, rowClass, detail;

			if (item.status === 'ok') {
				state = E('span', { 'class': 'label success' }, _('已建立映射'));
				rowClass = 'natter-state-ok';
			}
			else {
				stateText = item.status === 'error' ? _('錯誤') :
					item.status === 'stalled' ? _('卡住') :
					item.status === 'starting' ? _('啟動中') : _('等待中');
				state = E('span', {
					'class': item.status === 'error' || item.status === 'stalled'
						? 'label natter-label-danger' : 'label warning'
				}, stateText);
				rowClass = item.status === 'error' || item.status === 'stalled'
					? 'natter-state-error' : 'natter-state-waiting';
			}
			detail = runtimeDetail(item);

			body.appendChild(E('tr', { 'class': rowClass }, [
				E('td', { 'data-title': _('實例') }, String(item.instance || item.config || '—')),
				E('td', { 'data-title': _('WAN') }, String(item.interface || '—')),
				E('td', { 'data-title': _('協定') }, String(item.protocol || '—').toUpperCase()),
				E('td', { 'data-title': _('內部端點') }, endpointNode(item.mapped_inside)),
				E('td', { 'data-title': _('公網端點') }, endpointNode(item.public)),
				E('td', { 'data-title': _('轉送目標') }, endpointNode(item.target)),
				E('td', { 'data-title': _('狀態') }, [ state, detail ? E('div', {
					'class': 'cbi-value-description'
				}, detail) : '' ]),
				E('td', { 'data-title': _('映射時間') }, formatUpdatedTime(item.updated_at))
			]));
		});
	},

	updateRuntime: function(runtime) {
		var label;

		this.runtime = runtime || {
			state: STATUS_UNKNOWN,
			mappings: [],
			mappingError: _('無法取得映射狀態。')
		};
		if (!this.statusNode)
			return;

		label = this.busy
			? { text: _('處理中…'), cssClass: 'label warning' }
			: this.statusLabel(this.runtime.state);
		this.statusNode.className = label.cssClass;
		this.statusNode.textContent = label.text;
		this.updateServiceMeta(this.runtime.service);
		if (this.statusReasonNode)
			this.statusReasonNode.textContent = this.statusReason(this.runtime.state,
				this.runtime.service);
		this.updateHero(this.runtime);
		if (this.lastRefreshNode)
			this.lastRefreshNode.textContent = _('最後更新：%s').format(formatClockTime());
		this.updateRuntimeSummary(this.runtime.mappings);
		this.updateRuntimeTable(this.runtime.mappings, this.runtime.mappingError);

		if (this.buttons) {
			var locked = this.busy || this.readonly;
			Object.keys(this.buttons).forEach(function(name) {
				this.buttons[name].setAttribute('aria-busy', this.busy ? 'true' : 'false');
			}, this);
			this.buttons.start.disabled = locked || isRunningState(this.runtime.state) ||
				this.runtime.state === STATUS_DISABLED;
			this.buttons.stop.disabled = locked || !isRunningState(this.runtime.state) ||
				this.runtime.state === STATUS_DISABLED;
			this.buttons.restart.disabled = locked || !isRunningState(this.runtime.state) ||
				this.runtime.state === STATUS_RUNNING_DISABLED;
			this.buttons.refresh.disabled = this.busy;
		}
	},

	refreshRuntime: function() {
		if (this.busy)
			return Promise.resolve(this.runtime);

		return this.getRuntime().then(L.bind(function(runtime) {
			this.updateRuntime(runtime);
			return runtime;
		}, this));
	},

	waitForState: function(target, attempts) {
		return this.getRuntime().then(L.bind(function(runtime) {
			var matched = Array.isArray(target)
				? target.indexOf(runtime.state) !== -1
				: runtime.state === target;
			if (matched || attempts <= 1)
				return runtime;
			return sleep(500).then(L.bind(function() {
				return this.waitForState(target, attempts - 1);
			}, this));
		}, this));
	},

	serviceCommand: function(action) {
		var target = action === 'stop'
			? [ STATUS_STOPPED, STATUS_NOT_AUTOSTARTED, STATUS_DISABLED ]
			: [ STATUS_RUNNING, STATUS_RUNNING_MANUAL ];

		if (this.busy || this.readonly)
			return Promise.resolve();

		this.busy = true;
		this.updateRuntime(this.runtime);

		return fs.exec('/etc/init.d/natter', [ action ]).then(L.bind(function(result) {
			if (!result || result.code !== 0)
				throw new Error(result && (result.stderr || result.stdout) ||
					_('Natter 服務操作失敗。'));
			return this.waitForState(target, 8);
		}, this)).then(function(runtime) {
			var matched = Array.isArray(target)
				? target.indexOf(runtime.state) !== -1
				: runtime.state === target;
			if (!matched)
				throw new Error(_('無法確認要求的服務狀態。'));
			ui.addTimeLimitedNotification(null, E('p', _('Natter 服務已更新。')),
				5000, 'info');
		}).catch(function(error) {
			ui.addNotification(null,
				E('p', _('Natter 服務操作失敗：%s').format(error.message)), 'danger');
		}).finally(L.bind(function() {
			this.busy = false;
			return this.refreshRuntime();
		}, this));
	},

	makeButton: function(name, label, cssClass) {
		var button = E('button', {
			'type': 'button',
			'class': 'btn cbi-button %s'.format(cssClass),
			'click': L.bind(function(ev) {
				ev.preventDefault();
				return name === 'refresh' ? this.refreshRuntime() : this.serviceCommand(name);
			}, this)
		}, label);
		this.buttons[name] = button;
		return button;
	},

	makeSummaryCard: function(key, label, cssClass) {
		var value = E('strong', { 'class': 'natter-summary-value' }, '—');
		var card;

		this.summaryNodes[key] = value;
		card = E('button', {
			'type': 'button',
			'class': 'natter-summary-card natter-summary-%s'.format(cssClass || key),
			'aria-pressed': this.runtimeFilter === key ? 'true' : 'false',
			'aria-controls': 'natter-runtime-table',
			'click': L.bind(function(ev) {
				ev.preventDefault();
				this.setRuntimeFilter(key);
			}, this)
		}, [
			E('span', { 'class': 'natter-summary-label' }, label), value
		]);
		this.summaryCards[key] = card;
		return card;
	},

	setRuntimeFilter: function(filter) {
		if ([ 'total', 'mapped', 'waiting', 'errors' ].indexOf(filter) === -1)
			filter = 'total';
		this.runtimeFilter = filter;
		Object.keys(this.summaryCards || {}).forEach(function(key) {
			this.summaryCards[key].setAttribute('aria-pressed', key === filter ? 'true' : 'false');
		}, this);
		if (this.runtime)
			this.updateRuntimeTable(this.runtime.mappings, this.runtime.mappingError);
	},

	updateRuntimeSummary: function(mappings) {
		var counts = countRuntimeStates(mappings);

		if (!this.summaryNodes)
			return;
		this.summaryNodes.total.textContent = String(counts.total);
		this.summaryNodes.mapped.textContent = String(counts.mapped);
		this.summaryNodes.waiting.textContent = String(counts.waiting);
		this.summaryNodes.errors.textContent = String(counts.errors);
	},

	renderStatus: function(runtime) {
		this.buttons = {};
		this.summaryNodes = {};
		this.summaryCards = {};
		this.runtimeFilter = this.runtimeFilter || 'total';
		this.statusNode = E('span');
		this.statusReasonNode = E('span', { 'class': 'natter-status-reason' });
		this.serviceMetaNode = E('div', {
			'class': 'natter-service-meta',
			'aria-live': 'polite'
		});
		this.lastRefreshNode = E('span', {
			'class': 'natter-refresh-time',
			'aria-live': 'off'
		}, _('等待更新…'));
		this.runtimeTableBody = E('tbody', {}, [
			E('tr', {}, [ E('td', { 'colspan': '8' }, _('等待狀態…')) ])
		]);

		var panel = E('div', { 'class': 'cbi-section natter-panel natter-runtime-panel' }, [
			E('div', { 'class': 'natter-panel-head' }, [
				sectionHeading(_('即時狀態'), _('執行狀態')),
				E('div', { 'class': 'natter-panel-meta' }, [ this.lastRefreshNode ])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('服務')),
				E('div', { 'class': 'cbi-value-field natter-status-live', 'aria-live': 'polite' }, [
					this.statusNode, ' ', this.statusReasonNode
				])
			]),
			this.serviceMetaNode,
			E('div', { 'class': 'natter-summary-grid', 'aria-live': 'polite' }, [
				this.makeSummaryCard('total', _('映射數'), 'total'),
				this.makeSummaryCard('mapped', _('已建立映射'), 'mapped'),
				this.makeSummaryCard('waiting', _('等待中'), 'waiting'),
				this.makeSummaryCard('errors', _('錯誤'), 'errors')
			]),
			E('p', { 'class': 'natter-section-help' }, _('點選摘要卡可篩選下方清單。每個協定實例都會列為一列；「映射時間」是最後一次成功 STUN 映射的時間，Keepalive 檢查不會更新此欄位。錯誤會直接顯示在這裡，不必開啟或捲動日誌視窗。')),
			E('div', { 'class': 'natter-table-wrap' }, [
			E('table', {
				'id': 'natter-runtime-table',
				'class': 'table natter-responsive-table natter-runtime-table',
				'aria-label': _('Natter 執行映射清單')
			}, [
				E('thead', {}, [ E('tr', {}, [
					E('th', {}, _('實例')),
					E('th', {}, _('WAN')),
					E('th', {}, _('協定')),
					E('th', {}, _('內部端點')),
					E('th', {}, _('公網端點')),
					E('th', {}, _('轉送目標')),
					E('th', {}, _('狀態')),
					E('th', {}, _('映射時間'))
				]) ]),
				this.runtimeTableBody
			]) ]),
			E('div', { 'class': 'cbi-page-actions natter-action-bar natter-runtime-actions' }, [
				this.makeButton('start', _('啟動'), 'cbi-button-positive'), ' ',
				this.makeButton('restart', _('重新啟動'), 'cbi-button-apply'), ' ',
				this.makeButton('stop', _('停止'), 'cbi-button-negative'), ' ',
				this.makeButton('refresh', _('重新整理'), 'cbi-button-neutral')
			])
		]);

		this.updateRuntime(runtime);
		return panel;
	},

	render: function(data) {
		var m, s, o, hasMwan3Wan;
		var runtime = data[1];
		var mwanInterfaces = {};

		uci.sections('mwan3', 'interface').forEach(function(section) {
			mwanInterfaces[section['.name']] = true;
		});
		hasMwan3Wan = Object.keys(mwanInterfaces).length > 0;

		m = new form.Map('natter', _('映射設定'),
			_('可在一般 WAN 或 mwan3 WAN 上建立獨立的 TCP 或 UDP 公網映射。mwan3 是可選的出口隔離整合，未安裝時 Natter 仍可正常運行。'));

		s = m.section(form.NamedSection, 'globals', 'globals', _('全域設定'));
		o = s.option(form.Flag, 'enabled', _('啟用 Natter'));
		o.default = '0';

		o = s.option(form.Flag, 'mwan3_isolation', _('使用 mwan3 WAN 隔離（可選）'));
		o.default = '1';
		o.rmempty = false;
		o.description = _('安裝 mwan3 時將 STUN、Keepalive 與映射 socket 綁定在所選 WAN，避免容錯切換或負載平衡。未安裝 mwan3 時會自動使用一般 WAN 路由。');

		o = s.option(form.Value, 'dns_server', _('中國大陸 DNS 伺服器'));
		o.default = '119.29.29.29';
		o.validate = validIPv4;
		o.rmempty = false;

		s = m.section(form.GridSection, 'instance', _('公網映射'));
		s.addremove = true;
		s.anonymous = false;
		s.sortable = true;
		s.nodescriptions = true;
		s.sectiontitle = function(sectionId) { return sectionId; };

		o = s.option(form.Flag, 'enabled', _('啟用'));
		o.default = '0';
		o.editable = true;

		o = s.option(widgets.NetworkSelect, 'interface', _('WAN'));
		o.nocreate = true;
		o.rmempty = false;
		o.retain = true;
		o.filter = function(sectionId, value) {
			var isSelectable = mwanInterfaces[value] === true;
			var configured = this.map.data.get('natter', sectionId, 'interface');

			if (!hasMwan3Wan) {
				isSelectable = this.networks.some(function(network) {
					return network.getName() === value && networkL3DeviceName(network) != null;
				});
			}
			return configured === value ||
				(isSelectable &&
				 !isRedundantIpv6Network(this.networks, value));
		};

		o = s.option(form.ListValue, 'protocol', _('協定'));
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.value('both', _('TCP + UDP（獨立映射）'));
		o.default = 'tcp';
		o.rmempty = false;
		o.editable = true;
		o.description = _('TCP + UDP 會在相同內部埠上啟動兩個獨立映射；兩者的公網埠分別分配，可能不同。');

		o = s.option(form.Value, 'bind_port', _('內部綁定埠'));
		o.datatype = 'port';
		o.rmempty = false;
		o.editable = true;
		o.description = _('必須使用路由器上尚未占用的本機埠。請勿重複使用 LuCI/uhttpd 等服務的埠。實際公網埠由上游 NAT 分配，可能與此不同。');

		o = s.option(form.Value, 'target_ip', _('LAN 目標'));
		o.validate = validIPv4;
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.Value, 'target_port', _('目標埠'));
		o.datatype = 'port';
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.Value, 'interval', _('Keepalive 間隔'));
		o.datatype = 'range(1,65535)';
		o.default = '15';
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.Value, 'keepalive_server', _('Keepalive 端點'));
		o.placeholder = _('TCP：www.baidu.com:80；UDP：119.29.29.29:53');
		o.rmempty = true;
		o.modalonly = true;
		o.validate = validEndpoint;
		o.depends('protocol', 'tcp');
		o.depends('protocol', 'udp');

		o = s.option(form.DynamicList, 'stun_server', _('中國大陸 STUN 端點'));
		o.placeholder = 'stun.miwifi.com:3478';
		o.rmempty = true;
		o.retain = true;
		o.modalonly = true;
		o.validate = validEndpoint;
		o.description = _('留空會使用內建的 TCP 或 UDP 中國大陸 STUN 清單。Natter 啟動前會透過所選 WAN 解析 DNS。');
		o.depends('protocol', 'tcp');
		o.depends('protocol', 'udp');

		o = s.option(form.Value, 'tcp_keepalive_server', _('TCP Keepalive 端點'));
		o.placeholder = 'www.baidu.com:80';
		o.rmempty = true;
		o.modalonly = true;
		o.validate = validEndpoint;
		o.depends('protocol', 'both');

		o = s.option(form.Value, 'udp_keepalive_server', _('UDP Keepalive 端點'));
		o.placeholder = '119.29.29.29:53';
		o.rmempty = true;
		o.modalonly = true;
		o.validate = validEndpoint;
		o.depends('protocol', 'both');

		o = s.option(form.DynamicList, 'tcp_stun_server', _('TCP 中國大陸 STUN 端點'));
		o.placeholder = 'turn.cloud-rtc.com:80';
		o.rmempty = true;
		o.modalonly = true;
		o.validate = validEndpoint;
		o.depends('protocol', 'both');

		o = s.option(form.DynamicList, 'udp_stun_server', _('UDP 中國大陸 STUN 端點'));
		o.placeholder = 'stun.miwifi.com:3478';
		o.rmempty = true;
		o.modalonly = true;
		o.validate = validEndpoint;
		o.depends('protocol', 'both');

		o = s.option(form.Value, 'hook_script', _('映射 hook 腳本'));
		o.placeholder = '/usr/local/bin/natter-mapped';
		o.rmempty = true;
		o.modalonly = true;
		o.validate = validOptionalAbsolutePath;

		o = s.option(form.Flag, 'verbose', _('詳細記錄'));
		o.default = '0';
		o.modalonly = true;

		return m.render().then(L.bind(function(node) {
			if (node && node.classList)
				node.classList.add('natter-config-map');
			Array.prototype.forEach.call(
				node.querySelectorAll('table.cbi-section-table'),
				prepareResponsiveTable
			);
			this.readonly = !!m.readonly;
			this.busy = false;
			this.probeBusy = false;
			this.configCheckBusy = false;
			this.runtimePoll = L.bind(this.refreshRuntime, this);
			poll.add(this.runtimePoll, 5);
			var probePanel = this.renderProbe();
			var configCheckPanel = this.renderConfigCheck();
			window.setTimeout(L.bind(this.probeAllWans, this), 0);
			window.setTimeout(L.bind(this.checkConfiguredPorts, this), 0);

			return E('div', { 'class': 'natter-page' }, [ E('style', {}, BASE_STYLE + MOBILE_STYLE),
				this.renderHero(), this.renderStatus(runtime), probePanel,
				configCheckPanel, node ]);
		}, this));
	}
});
