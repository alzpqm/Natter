include $(TOPDIR)/rules.mk

PKG_NAME:=natter
PKG_VERSION:=2.2.1
PKG_RELEASE:=28

PKG_SOURCE:=Natter-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/MikeWang000000/Natter/tar.gz/$(PKG_VERSION)?
PKG_HASH:=c16ab2c446a821655d5d784980024a8cadf73fbcb7e9c503665e4ecf83703828
PKG_BUILD_DIR:=$(BUILD_DIR)/Natter-$(PKG_VERSION)

PKG_MAINTAINER:=alzpqm
PKG_LICENSE:=GPL-3.0-only
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk

define Package/natter
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Routing and Redirection
  TITLE:=Multi-WAN-safe full-cone NAT port mapping helper
  URL:=https://github.com/MikeWang000000/Natter
  DEPENDS:=+python3-light +firewall4
  PKGARCH:=all
endef

define Package/natter/description
Natter exposes a TCP or UDP port through a full-cone NAT. This OpenWrt
integration supports independent procd instances per WAN and protocol, binds
UDP sockets to the WAN device and TCP sockets to the WAN source address, and
(when mwan3 is installed and isolation is enabled) calculates the matching
mwan3 route mark for DNS, STUN and Natter sockets. Router-local sockets use the
standard unprivileged group to bypass compatible transparent proxies. It
reserves configured fixed ports from ephemeral allocation and installs
firewall4 rules for forwarding the fixed inside port to a LAN target.
endef

define Package/natter/preinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ "$${PKG_UPGRADE:-0}" = "1" ] || exit 0

mkdir -p /var/run/natter
state_tmp="$$(mktemp /var/run/natter/.package-upgrade-runtime.XXXXXX)" || exit 0
if /etc/init.d/natter running >/dev/null 2>&1; then
	printf 'running\n' > "$$state_tmp"
else
	printf 'stopped\n' > "$$state_tmp"
fi
mv -f "$$state_tmp" /var/run/natter/.package-upgrade-runtime
guard_tmp="$$(mktemp /var/run/natter/.package-upgrade-guard.XXXXXX)" || exit 0
printf 'created_at=%s\n' "$$(date +%s)" > "$$guard_tmp"
mv -f "$$guard_tmp" /var/run/natter/.package-upgrade-guard
exit 0
endef

define Package/natter/conffiles
/etc/config/natter
endef

define Build/Compile
endef

define Package/natter/install
	$(INSTALL_DIR) $(1)/usr/share/natter
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/natter.py $(1)/usr/share/natter/natter.py

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/natter $(1)/etc/config/natter

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/natter $(1)/etc/init.d/natter

	$(INSTALL_DIR) $(1)/usr/share/natter/runtime
	$(INSTALL_DATA) ./files/etc/natter/dstnat.nft $(1)/usr/share/natter/runtime/dstnat.nft
	$(INSTALL_DATA) ./files/etc/natter/forward.nft $(1)/usr/share/natter/runtime/forward.nft
	$(INSTALL_DATA) ./files/etc/natter/input.nft $(1)/usr/share/natter/runtime/input.nft

	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./files/usr/libexec/natter-firewall $(1)/usr/libexec/natter-firewall
	$(INSTALL_BIN) ./files/usr/libexec/natter-notify $(1)/usr/libexec/natter-notify
	$(INSTALL_BIN) ./files/usr/libexec/natter-probe $(1)/usr/libexec/natter-probe
	$(INSTALL_BIN) ./files/usr/libexec/natter-interface-trigger $(1)/usr/libexec/natter-interface-trigger

	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/usr/sbin/natterctl $(1)/usr/sbin/natterctl

	$(INSTALL_DIR) $(1)/usr/share/nftables.d/chain-pre/dstnat
	$(INSTALL_DATA) ./files/usr/share/nftables.d/chain-pre/dstnat/90-natter.nft \
		$(1)/usr/share/nftables.d/chain-pre/dstnat/90-natter.nft
	$(INSTALL_DIR) $(1)/usr/share/nftables.d/chain-pre/forward
	$(INSTALL_DATA) ./files/usr/share/nftables.d/chain-pre/forward/90-natter.nft \
		$(1)/usr/share/nftables.d/chain-pre/forward/90-natter.nft
	$(INSTALL_DIR) $(1)/usr/share/nftables.d/chain-pre/input
	$(INSTALL_DATA) ./files/usr/share/nftables.d/chain-pre/input/90-natter.nft \
		$(1)/usr/share/nftables.d/chain-pre/input/90-natter.nft
endef

$(eval $(call BuildPackage,natter))
