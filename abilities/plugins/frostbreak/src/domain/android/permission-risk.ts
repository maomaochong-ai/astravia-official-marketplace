/**
 * 权限分级。只回答「平台是否把它当运行时权限」，不判断业务是否合理：
 * 面板的权限表按危险 / 特殊 / 普通 / 自定义分色，凭据与结论都在规则层。
 */

export type PermissionLevel = "dangerous" | "special" | "normal" | "custom";

/** Android 运行时权限（需要用户当场授权）里最常出现在取证报告中的一组。 */
const DANGEROUS = new Set([
	"android.permission.READ_SMS",
	"android.permission.RECEIVE_SMS",
	"android.permission.SEND_SMS",
	"android.permission.READ_CALL_LOG",
	"android.permission.WRITE_CALL_LOG",
	"android.permission.CALL_PHONE",
	"android.permission.READ_CONTACTS",
	"android.permission.WRITE_CONTACTS",
	"android.permission.GET_ACCOUNTS",
	"android.permission.ACCESS_FINE_LOCATION",
	"android.permission.ACCESS_COARSE_LOCATION",
	"android.permission.ACCESS_BACKGROUND_LOCATION",
	"android.permission.CAMERA",
	"android.permission.RECORD_AUDIO",
	"android.permission.READ_EXTERNAL_STORAGE",
	"android.permission.WRITE_EXTERNAL_STORAGE",
	"android.permission.READ_MEDIA_IMAGES",
	"android.permission.READ_MEDIA_VIDEO",
	"android.permission.READ_MEDIA_AUDIO",
	"android.permission.READ_PHONE_STATE",
	"android.permission.READ_PHONE_NUMBERS",
	"android.permission.BODY_SENSORS",
	"android.permission.ACTIVITY_RECOGNITION",
	"android.permission.POST_NOTIFICATIONS",
	"android.permission.BLUETOOTH_CONNECT",
	"android.permission.BLUETOOTH_SCAN",
	"android.permission.NEARBY_WIFI_DEVICES",
	"android.permission.READ_CALENDAR",
	"android.permission.WRITE_CALENDAR",
]);

/** 需要用户在系统设置里单独开启、或只能由系统/签名方授予的权限。 */
const SPECIAL = new Set([
	"android.permission.SYSTEM_ALERT_WINDOW",
	"android.permission.WRITE_SETTINGS",
	"android.permission.PACKAGE_USAGE_STATS",
	"android.permission.BIND_ACCESSIBILITY_SERVICE",
	"android.permission.BIND_DEVICE_ADMIN",
	"android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
	"android.permission.REQUEST_INSTALL_PACKAGES",
	"android.permission.MANAGE_EXTERNAL_STORAGE",
	"android.permission.QUERY_ALL_PACKAGES",
	"android.permission.SCHEDULE_EXACT_ALARM",
	"android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
]);

export function permissionLevel(name: string): PermissionLevel {
	if (DANGEROUS.has(name)) return "dangerous";
	if (SPECIAL.has(name)) return "special";
	if (name.startsWith("android.permission.")) return "normal";
	return "custom";
}
