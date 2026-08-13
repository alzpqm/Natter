include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-natter
PKG_VERSION:=1.0.0
PKG_RELEASE:=13
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-natter
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Natter 的 LuCI 管理介面
  DEPENDS:=+natter
endef

define Package/luci-app-natter/description
 用於設定多 WAN Natter 映射的 LuCI 網頁管理介面。
endef

define Build/Compile
endef

define Package/luci-app-natter/install
	$(CP) ./root/* $(1)/
endef

$(eval $(call BuildPackage,luci-app-natter))
