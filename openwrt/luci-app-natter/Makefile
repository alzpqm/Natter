include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-natter
PKG_VERSION:=2.2.1
PKG_RELEASE:=26
PKG_MAINTAINER:=alzpqm
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PATCH_DIR:=$(CURDIR)/luci-app-natter/patches

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-natter
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Natter 的 LuCI 管理介面
  DEPENDS:=+natter
  PKGARCH:=all
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
