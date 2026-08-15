include $(TOPDIR)/rules.mk

PKG_NAME:=natter
PKG_VERSION:=2.2.1
PKG_RELEASE:=13

PKG_SOURCE:=Natter-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/MikeWang000000/Natter/tar.gz/$(PKG_VERSION)?
PKG_HASH:=c16ab2c446a821655d5d784980024a8cadf73fbcb7e9c503665e4ecf83703828
PKG_BUILD_DIR:=$(BUILD_DIR)/Natter-$(PKG_VERSION)

PKG_MAINTAINER:=OpenWrt Natter package maintainers
PKG_LICENSE:=GPL-3.0-only
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk

define Package/natter
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Routing and Redirection
  TITLE:=Multi-WAN-safe full-cone NAT port mapping helper
  URL:=https://github.com/MikeWang000000/Natter
  DEPENDS:=+python3-light +mwan3 +firewall4
  PKGARCH:=all
endef

define Package/natter/description
Natter exposes a TCP or UDP port through a full-cone NAT. This OpenWrt
integration supports independent procd instances per WAN and protocol, applies
a native device bind and mwan3 bypass mark to DNS, STUN and Natter sockets, and
installs firewall4 rules for forwarding the fixed inside port to a LAN target.
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
