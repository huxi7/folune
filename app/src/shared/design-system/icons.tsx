/**
 * [INPUT]: 依赖 lucide-react 的圆角描边图标与 LucideIcon/LucideProps 类型
 * [OUTPUT]: 对外提供 SuperNote 稳定语义图标别名、14/16/20/24 四档尺寸契约、统一 Icon 类型与本地 Google 品牌标记
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
export const CreditCardIcon = defineIcon(CreditCard);
export const DesktopIcon = defineIcon(Monitor);
export const DotsThreeIcon = defineIcon(Ellipsis);
export const DownloadSimpleIcon = defineIcon(Download);
export const EyeIcon = defineIcon(Eye);
export const EyeSlashIcon = defineIcon(EyeOff);
export const FileTextIcon = defineIcon(FileText);
export const FolderIcon = defineIcon(Folder);
export const FolderOpenIcon = defineIcon(FolderOpen);
export const GearSixIcon = defineIcon(Settings2);
export const ImageSquareIcon = defineIcon(Image);
export const InfoIcon = defineIcon(Info);
export const MagicWandIcon = defineIcon(WandSparkles);
export const MagnifyingGlassIcon = defineIcon(Search);
export const MenuIcon = defineIcon(Menu);
export const NewConversationIcon = defineIcon(MessageCirclePlus);
export const MoonIcon = defineIcon(Moon);
export const MoonStarsIcon = defineIcon(MoonStar);
export const NotePencilIcon = defineIcon(SquarePen);
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

export const GoogleLogoIcon = forwardRef<SVGSVGElement, IconProps>(function GoogleLogoIcon({
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
