/**
 * [INPUT]: 依赖共用 Button/Dialog、可选语义图标与桌面平台判断
 * [OUTPUT]: 官网原生安装包下载按钮，Header 可传入下载图标；仅无法可靠判断时提供架构明确的选择
 * [POS]: Header/Hero 共用下载入口；不使用 Toast 模拟下载，不改变页面主次按钮视觉
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { useState } from "react";
import { Button, Dialog } from "../shared/design-system/components";
import type { Icon } from "../shared/design-system/icons";
import { desktopDownloadUrls, detectDesktopPlatform, type DesktopPlatform } from "../shared/desktop/download";

export function DesktopDownloadButton({ icon }: { icon?: Icon } = {}) {
  const [choosing, setChoosing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const download = (platform: DesktopPlatform) => {
    setChoosing(false);
    const anchor = document.createElement("a");
    anchor.href = desktopDownloadUrls[platform];
    anchor.download = "";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };
  const start = async () => {
    if (detecting) return;
    setDetecting(true);
    try {
      const platform = await detectDesktopPlatform();
      if (platform) download(platform); else setChoosing(true);
    } finally { setDetecting(false); }
  };
  return <>
    <Button variant="secondary" icon={icon} disabled={detecting} onClick={() => void start()}>下载</Button>
    <Dialog open={choosing} onOpenChange={setChoosing} title="下载 Folune" density="compact"
      description="请选择电脑版本。目前支持 Apple Silicon Mac 和 Windows x64。">
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => download("macos")}>Mac · Apple Silicon</Button>
        <Button variant="secondary" onClick={() => download("windows")}>Windows · x64</Button>
      </div>
    </Dialog>
  </>;
}
