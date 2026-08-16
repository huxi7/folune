/**
 * [INPUT]: 依赖 lucide-react 的圆角描边图标与 LucideIcon/LucideProps 类型
 * [OUTPUT]: 对外提供 SuperNote 稳定语义图标别名、统一 Icon 类型与本地 Google 品牌标记
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
  CircleX,
  Copy,
  CreditCard,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Info,
  ListTree,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircleMore,
  MessageCirclePlus,
  MessagesSquare,
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
  Square,
  SquarePen,
  Sun,
  Trash2,
  Undo2,
  Upload,
  CircleUserRound,
  WandSparkles,
  Wrench,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { forwardRef } from "react";

export type Icon = LucideIcon;

export const ArchiveIcon = Archive;
export const AssistantPanelCloseIcon = PanelRightClose;
export const AssistantPanelOpenIcon = PanelRightOpen;
export const ArrowCounterClockwiseIcon = RotateCcw;
export const ArrowLeftIcon = ArrowLeft;
export const ArrowRightIcon = ArrowRight;
export const ArrowUUpLeftIcon = Undo2;
export const ArrowUpIcon = ArrowUp;
export const AtIcon = AtSign;
export const BookOpenTextIcon = BookOpenText;
export const CaretDownIcon = ChevronDown;
export const CaretRightIcon = ChevronRight;
export const CaretUpDownIcon = ChevronsUpDown;
export const ChatCircleDotsIcon = MessageCircleMore;
export const ChatsIcon = MessagesSquare;
export const CheckCircleIcon = CircleCheck;
export const CheckIcon = Check;
export const CircleNotchIcon = LoaderCircle;
export const ConfettiIcon = PartyPopper;
export const CopyIcon = Copy;
export const CreditCardIcon = CreditCard;
export const DesktopIcon = Monitor;
export const DotsThreeIcon = Ellipsis;
export const DownloadSimpleIcon = Download;
export const EyeIcon = Eye;
export const EyeSlashIcon = EyeOff;
export const FileTextIcon = FileText;
export const FolderIcon = Folder;
export const FolderOpenIcon = FolderOpen;
export const GearSixIcon = Settings2;
export const ImageSquareIcon = Image;
export const InfoIcon = Info;
export const MagicWandIcon = WandSparkles;
export const MagnifyingGlassIcon = Search;
export const MenuIcon = Menu;
export const NewConversationIcon = MessageCirclePlus;
export const MoonIcon = Moon;
export const MoonStarsIcon = MoonStar;
export const NotePencilIcon = SquarePen;
export const PaletteIcon = Palette;
export const PaperPlaneRightIcon = SendHorizontal;
export const PencilSimpleIcon = Pencil;
export const PlusIcon = Plus;
export const PushPinIcon = Pin;
export const ShieldCheckIcon = ShieldCheck;
export const ShieldWarningIcon = ShieldAlert;
export const SidebarSimpleIcon = PanelLeft;
export const SignOutIcon = LogOut;
export const SparkleIcon = Sparkles;
export const StopIcon = Square;
export const SunIcon = Sun;
export const ToolboxIcon = Wrench;
export const TrashIcon = Trash2;
export const TreeStructureIcon = ListTree;
export const UploadSimpleIcon = Upload;
export const UserCircleIcon = CircleUserRound;
export const WarningCircleIcon = CircleAlert;
export const XCircleIcon = CircleX;
export const XIcon = X;

export const GoogleLogoIcon = forwardRef<SVGSVGElement, LucideProps>(function GoogleLogoIcon({
  color = "currentColor",
  size = 24,
  ...props
}, ref) {
  return (
    <svg
      fill="none"
      height={size}
      ref={ref}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z"
        fill={color}
      />
      <path
        d="M12 22c2.7 0 4.98-.9 6.64-2.37l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10.02 10.02 0 0 0 12 22Z"
        fill={color}
        opacity="0.82"
      />
      <path
        d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.54l3.35-2.62Z"
        fill={color}
        opacity="0.64"
      />
      <path
        d="M12 5.95c1.47 0 2.78.5 3.82 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10.02 10.02 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"
        fill={color}
        opacity="0.92"
      />
    </svg>
  );
});
