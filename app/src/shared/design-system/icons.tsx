/**
 * [INPUT]: 依赖 lucide-react 的圆角描边图标与 LucideIcon/LucideProps 类型
 * [OUTPUT]: 对外提供含画布操作、语言 GlobeIcon、用量 GaugeIcon 与键帽符号的 Folune 稳定语义图标别名、14/16/20/24 四档尺寸契约、统一 Icon 类型与 Google 四色品牌标记
 * [POS]: app/src/shared/design-system 的图标语言边界；业务层只依赖领域名称，第三方图形选择与品牌例外在此收口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AtSign,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  CircleUserRound,
  CircleX,
  Command,
  Copy,
  CornerDownLeft,
  CreditCard,
  Delete,
  Download,
  Ellipsis,
  Expand,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  Focus,
  Folder,
  FolderOpen,
  Gauge,
  Grip,
  Globe,
  Image,
  Info,
  Keyboard,
  ListCollapse,
  ListTree,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircleMore,
  MessageCirclePlus,
  MessagesSquare,
  Minus,
  Monitor,
  Moon,
  MoonStar,
  Palette,
  PanelLeft,
  PanelRightClose,
  PanelRightOpen,
  PartyPopper,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Space,
  Square,
  SquarePen,
  Sun,
  Trash2,
  type LucideIcon,
  type LucideProps,
  Undo2,
  Upload,
  WandSparkles,
  Waypoints,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";

export const ICON_SIZES = [14, 16, 20, 24] as const;
export type IconSize = (typeof ICON_SIZES)[number];
export type IconProps = Omit<LucideProps, "size"> & { size?: IconSize };
export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

function defineIcon(Component: LucideIcon): Icon {
  return forwardRef<SVGSVGElement, IconProps>(function DesignSystemIcon(props, ref) {
    return <Component ref={ref} {...props} />;
  });
}

export const ArchiveIcon = defineIcon(Archive);
export const AssistantPanelCloseIcon = defineIcon(PanelRightClose);
export const AssistantPanelOpenIcon = defineIcon(PanelRightOpen);
export const ArrowCounterClockwiseIcon = defineIcon(RotateCcw);
export const ArrowLeftIcon = defineIcon(ArrowLeft);
export const ArrowRightIcon = defineIcon(ArrowRight);
export const ArrowUUpLeftIcon = defineIcon(Undo2);
export const ArrowUpIcon = defineIcon(ArrowUp);
export const AtIcon = defineIcon(AtSign);
export const BookOpenTextIcon = defineIcon(BookOpenText);
export const CaretDownIcon = defineIcon(ChevronDown);
export const CaretRightIcon = defineIcon(ChevronRight);
export const CaretUpDownIcon = defineIcon(ChevronsUpDown);
export const ChatCircleDotsIcon = defineIcon(MessageCircleMore);
export const ChatsIcon = defineIcon(MessagesSquare);
export const CheckCircleIcon = defineIcon(CircleCheck);
export const CheckIcon = defineIcon(Check);
export const CircleNotchIcon = defineIcon(LoaderCircle);
export const ConfettiIcon = defineIcon(PartyPopper);
export const CopyIcon = defineIcon(Copy);
export const CommandKeyIcon = defineIcon(Command);
export const ReturnKeyIcon = defineIcon(CornerDownLeft);
export const DeleteKeyIcon = defineIcon(Delete);
export const SpaceKeyIcon = defineIcon(Space);
export const KeyboardIcon = defineIcon(Keyboard);
export const CreditCardIcon = defineIcon(CreditCard);
export const DesktopIcon = defineIcon(Monitor);
export const DotsThreeIcon = defineIcon(Ellipsis);
export const DownloadSimpleIcon = defineIcon(Download);
export const ExpandIcon = defineIcon(Expand);
export const EyeIcon = defineIcon(Eye);
export const EyeSlashIcon = defineIcon(EyeOff);
/** 将已有备忘录加入 Canvas；不承担通用新建或缩放语义 */
export const AddNoteIcon = defineIcon(FilePlus);
/** 已保存画布在文件树里的身份: 一张关系星图，与纸张明确区分，且永不暴露扩展名 */
export const CanvasIcon = defineIcon(Waypoints);
/** Canvas 卡片右下角的连接抓手；它表达拖拽关系，不是新增命令 */
export const ConnectionHandleIcon = defineIcon(Grip);
/** 从一张真实笔记向外发散候选关系；与收拢到文件树的整理语义分离 */
export const ExpandFromNoteIcon = defineIcon(Sparkles);
export const FileTextIcon = defineIcon(FileText);
export const FitViewIcon = defineIcon(Focus);
export const FolderIcon = defineIcon(Folder);
export const FolderOpenIcon = defineIcon(FolderOpen);
export const GaugeIcon = defineIcon(Gauge);
export const GlobeIcon = defineIcon(Globe);
export const GearSixIcon = defineIcon(Settings2);
export const ImageSquareIcon = defineIcon(Image);
export const InfoIcon = defineIcon(Info);
export const MagicWandIcon = defineIcon(WandSparkles);
export const MagnifyingGlassIcon = defineIcon(Search);
export const MenuIcon = defineIcon(Menu);export const NewConversationIcon = defineIcon(MessageCirclePlus);
export const MinusIcon = defineIcon(Minus);
export const MoonIcon = defineIcon(Moon);
export const MoonStarsIcon = defineIcon(MoonStar);
export const NotePencilIcon = defineIcon(SquarePen);
/** 将一篇笔记收拢为文件树落点；与向外发散节点的拓展语义分离 */
export const OrganizeNoteIcon = defineIcon(ListCollapse);
export const PaletteIcon = defineIcon(Palette);
export const PaperPlaneRightIcon = defineIcon(SendHorizontal);
export const PencilSimpleIcon = defineIcon(Pencil);
export const PlusIcon = defineIcon(Plus);
export const PushPinIcon = defineIcon(Pin);
export const ShieldCheckIcon = defineIcon(ShieldCheck);
export const ShieldWarningIcon = defineIcon(ShieldAlert);
export const SidebarSimpleIcon = defineIcon(PanelLeft);
export const SignOutIcon = defineIcon(LogOut);
export const SparkleIcon = defineIcon(Sparkles);
export const StopIcon = defineIcon(Square);
export const SunIcon = defineIcon(Sun);
export const ToolboxIcon = defineIcon(Wrench);
export const TrashIcon = defineIcon(Trash2);
export const TreeStructureIcon = defineIcon(ListTree);
export const UploadSimpleIcon = defineIcon(Upload);
export const UserCircleIcon = defineIcon(CircleUserRound);
export const WarningCircleIcon = defineIcon(CircleAlert);
export const XCircleIcon = defineIcon(CircleX);
export const XIcon = defineIcon(X);
/** Canvas 视口放大；禁止回退为裸 Plus */
export const ZoomInIcon = defineIcon(ZoomIn);
/** Canvas 视口缩小；禁止回退为裸 Minus */
export const ZoomOutIcon = defineIcon(ZoomOut);

export const GoogleLogoIcon = forwardRef<SVGSVGElement, IconProps>(function GoogleLogoIcon({
  size = 24,
  ...props
}, ref) {
  return (
    <svg fill="none" height={size} ref={ref} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg" {...props}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
});
