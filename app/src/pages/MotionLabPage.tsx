/**
 * [INPUT]: 依赖生产 MotionSpecimen 与 Router Link
 * [OUTPUT]: 对外提供无需登录、只用本地状态的 DEV /motion-lab 验收台
 * [POS]: pages 的 Motion System 浏览器验收入口，复用 Design System 样板并连接真实文件树/归档线验收台
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { Link } from "react-router-dom";
import { MotionSpecimen } from "../widgets/DesignSystemWorkspace/MotionSpecimen";
export function MotionLabPage() {
  return <main className="motion-lab">
    <header><p>SuperNote · Design System</p><h1>Motion</h1><p>连续、克制、可反复操作。</p>
      <nav><Link to="/" viewTransition>Landing</Link><Link to="/archive-cord-lab" viewTransition>文件树与归档线</Link></nav>
    </header>
    <MotionSpecimen />
  </main>;
}
