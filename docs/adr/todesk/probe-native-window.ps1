param(
	[string]$OutFile = ""
)

# Read-only feasibility probe for "embed the real ToDesk window in the panel".
#
# It answers with measurements, not opinion:
#   1. are ToDesk's top-level windows ordinary windows the host could capture?
#   2. what are their bounds (would a captured bitmap be crisp, or upscaled)?
#   3. does the client expose any capture/stream flag on its command line?
#
# It enumerates windows instead of trusting Process.MainWindowHandle, which is 0 for a
# client that lives in the tray. It never injects input and never touches a session.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WinEnum {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int index);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder s, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder s, int max);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

  public static List<IntPtr> ForPids(uint[] pids) {
    var found = new List<IntPtr>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      foreach (var target in pids) if (pid == target) { found.Add(h); break; }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  public static string Class(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }
  public static string Title(IntPtr h) { var sb = new StringBuilder(512); GetWindowTextW(h, sb, 512); return sb.ToString(); }
}
"@

$pids = @(Get-Process ToDesk -ErrorAction SilentlyContinue | ForEach-Object { [uint32]$_.Id })
$handles = if ($pids.Count -gt 0) { [WinEnum]::ForPids($pids) } else { @() }

$rows = foreach ($h in $handles) {
	$r = New-Object WinEnum+RECT
	[void][WinEnum]::GetWindowRect($h, [ref]$r)
	[pscustomobject]@{
		handle  = $h.ToInt64()
		class   = [WinEnum]::Class($h)
		title   = [WinEnum]::Title($h)
		visible = [WinEnum]::IsWindowVisible($h)
		width   = $r.Right - $r.Left
		height  = $r.Bottom - $r.Top
		style   = [WinEnum]::GetWindowLong($h, -16)
	}
}

$env:PATH = "C:\Program Files\ToDesk;" + $env:PATH
$help = ""
if (Get-Command ToDesk.exe -ErrorAction SilentlyContinue) { $help = (& ToDesk.exe -help 2>&1 | Out-String) }

$report = [pscustomobject]@{
	screen              = "$([System.Windows.Forms.SystemInformation]::VirtualScreen.Width)x$([System.Windows.Forms.SystemInformation]::VirtualScreen.Height)"
	todeskProcessCount  = $pids.Count
	topLevelWindows     = @($rows)
	cliMentionsCapture  = [bool]($help -match "screen|capture|screenshot|stream")
}

if ($OutFile) { $report | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $OutFile }
$report | ConvertTo-Json -Depth 6
