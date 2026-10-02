/**
 * [INPUT]: 依赖可后台刷新的后端 Profile、shared/api/profile 的 username/bio PATCH 与 5MB 头像上传、React 受控草稿/800ms 防抖副作用/原生文件 input、locale 双语文案与本地 UI/共享 Lucide 图标
 * [OUTPUT]: 对外提供 AccountDialog 内分组嵌套卡片式个人资料面板、仅按 bio/username 合并后台 Profile 与本地草稿、静默自动保存、无图标紧凑头像上传入口，成功仅本地可访问反馈、异常进入全局 Toast
 * [POS]: app/src/widgets 的账户资料栏，以 stale-while-revalidate 字段级冲突保护和串行防抖保存消除整页 Loading 与显式提交区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  ImageSquareIcon,
} from "../shared/design-system/icons";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  Input,
  useToast,
} from "../shared/design-system/components";
import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_FILE_BYTES,
  updateProfile,
  uploadProfileAvatar,
  type Profile,
} from "../shared/api/profile";
import { useLocale } from "../shared/locale";

type AccountProfilePanelProps = {
  onProfileChange: (profile: Profile) => void;
  profile: Profile;
};

type ProfileDraft = {
  bio: string;
  username: string;
};

const createProfileDraft = (profile: Profile): ProfileDraft => ({
  bio: profile.bio ?? "",
  username: profile.username,
});

const AUTOSAVE_DELAY_MS = 800;

const normalizeProfileDraft = (draft: ProfileDraft): ProfileDraft => ({
  bio: draft.bio.trim(),
  username: draft.username.trim(),
});

const profileDraftsMatch = (left: ProfileDraft, right: ProfileDraft) =>
  left.bio === right.bio && left.username === right.username;

export function AccountProfilePanel({
  onProfileChange,
  profile,
}: AccountProfilePanelProps) {
  const { t, formatNumber } = useLocale();
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => createProfileDraft(profile));
  const [autosaveMessage, setAutosaveMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const failedDraft = useRef<ProfileDraft | null>(null);
  const lastSavedDraft = useRef(normalizeProfileDraft(createProfileDraft(profile)));

  useEffect(() => {
    const refreshedProfileDraft = {
      bio: profile.bio ?? "",
      username: profile.username,
    };
    const refreshedDraft = normalizeProfileDraft(refreshedProfileDraft);

    setDraft((currentDraft) => {
      const currentNormalized = normalizeProfileDraft(currentDraft);
      const previousSavedDraft = lastSavedDraft.current;
      lastSavedDraft.current = refreshedDraft;

      return {
        bio: currentNormalized.bio === previousSavedDraft.bio
          ? refreshedProfileDraft.bio
          : currentDraft.bio,
        username: currentNormalized.username === previousSavedDraft.username
          ? refreshedProfileDraft.username
          : currentDraft.username,
      };
    });
  }, [profile.bio, profile.username]);

  const saveProfileDraft = useCallback(async (nextDraft: ProfileDraft) => {
    setSavingProfile(true);
    setAutosaveMessage(t("正在自动保存个人资料", "Saving your profile"));

    try {
      const updatedProfile = await updateProfile({
        bio: nextDraft.bio || null,
        username: nextDraft.username,
      });
      const updatedDraft = normalizeProfileDraft(createProfileDraft(updatedProfile));

      failedDraft.current = null;
      lastSavedDraft.current = updatedDraft;
      onProfileChange(updatedProfile);
      setDraft((currentDraft) =>
        profileDraftsMatch(normalizeProfileDraft(currentDraft), nextDraft)
          ? createProfileDraft(updatedProfile)
          : currentDraft,
      );
      setAutosaveMessage(t("个人资料已自动保存", "Your profile has been saved"));
    } catch (error) {
      const description = error instanceof Error
        ? t(error.message, "We couldn't save your changes. Please try again.")
        : t("自动保存失败，请稍后重试。", "We couldn't save your changes. Please try again.");
      failedDraft.current = nextDraft;
      setAutosaveMessage(description);
      toast({
        description,
        title: t("个人资料自动保存失败", "Couldn't save your profile"),
        variant: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  }, [onProfileChange, t, toast]);

  useEffect(() => {
    if (savingProfile || uploadingAvatar) {
      return;
    }

    const nextDraft = normalizeProfileDraft(draft);

    if (profileDraftsMatch(nextDraft, lastSavedDraft.current)) {
      return;
    }

    if (failedDraft.current && profileDraftsMatch(nextDraft, failedDraft.current)) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (!nextDraft.username) {
        const description = t("用户名不能为空。", "Please enter a display name.");
        failedDraft.current = nextDraft;
        setAutosaveMessage(description);
        toast({
          description,
          title: t("无法自动保存", "Couldn't save your changes"),
          variant: "warning",
        });
        return;
      }

      void saveProfileDraft(nextDraft);
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [draft, saveProfileDraft, savingProfile, t, toast, uploadingAvatar]);

  function updateField<Key extends keyof ProfileDraft>(
    key: Key,
    value: ProfileDraft[Key],
  ) {
    failedDraft.current = null;
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
    setAutosaveMessage("");
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file === undefined) {
      return;
    }

    if (file.size > AVATAR_MAX_FILE_BYTES) {
      const description = t("头像文件不能超过 5MB。", "Your photo must be 5MB or smaller.");
      setAutosaveMessage(description);
      toast({ description, title: t("无法上传头像", "Couldn't upload your photo"), variant: "warning" });
      return;
    }

    if (!AVATAR_ACCEPTED_TYPES.includes(
      file.type as (typeof AVATAR_ACCEPTED_TYPES)[number],
    )) {
      const description = t("头像仅支持 JPEG、PNG 或 WebP 格式。", "Please choose a JPEG, PNG or WebP image.");
      setAutosaveMessage(description);
      toast({ description, title: t("无法上传头像", "Couldn't upload your photo"), variant: "warning" });
      return;
    }

    setUploadingAvatar(true);
    setAutosaveMessage(t("正在上传头像", "Uploading your photo"));

    try {
      const updatedProfile = await uploadProfileAvatar(file);
      onProfileChange(updatedProfile);
      lastSavedDraft.current = normalizeProfileDraft(createProfileDraft(updatedProfile));
      setAutosaveMessage(t("头像已更新", "Your photo has been updated"));
    } catch (error) {
      const description = error instanceof Error
        ? t(error.message, "Your photo couldn't be uploaded. Please try again.")
        : t("头像上传失败，请重试。", "Your photo couldn't be uploaded. Please try again.");
      setAutosaveMessage(description);
      toast({ description, title: t("头像上传失败", "Couldn't upload your photo"), variant: "error" });
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <div className="account-dialog-form">
      <span aria-live="polite" className="sr-only" role="status">
        {autosaveMessage}
      </span>
      <div className="account-dialog-scroll">
        <section className="account-dialog-section">
          <header className="account-dialog-section-header">
            <h4 className="account-dialog-section-title">{t("基本信息", "Basic information")}</h4>
            <p className="account-dialog-section-description">
              {t("与个人资料相关的常规设置。", "The details that make this profile yours.")}
            </p>
          </header>

          <div className="account-dialog-rows">
            <div className="account-dialog-row">
              <label className="account-dialog-label" htmlFor="account-profile-username">
                {t("昵称", "Display name")}
              </label>
              <div className="account-dialog-control">
                <Input
                  autoCapitalize="none"
                  autoComplete="username"
                  id="account-profile-username"
                  maxLength={100}
                  onChange={(event) => updateField("username", event.target.value)}
                  placeholder={t("设置昵称", "Your display name")}
                  spellCheck={false}
                  value={draft.username}
                />
              </div>
            </div>

            <div className="account-dialog-row">
              <label className="account-dialog-label" htmlFor="account-profile-email">
                {t("邮箱", "Email")}
              </label>
              <div className="account-dialog-control">
                <Input
                  className="account-dialog-readonly-input"
                  id="account-profile-email"
                  readOnly
                  value={profile.email ?? t("未绑定邮箱", "No email connected")}
                />
              </div>
            </div>

            <div className="account-dialog-row account-dialog-avatar-row">
              <p className="account-dialog-label">{t("头像照片", "Profile photo")}</p>
              <div className="account-dialog-avatar-control">
                <div className="account-dialog-avatar-preview">
                  {profile.avatarUrl ? (
                    <img
                      alt={t(`${profile.username} 的头像`, `${profile.username}'s profile photo`)}
                      className="account-dialog-avatar-image"
                      src={profile.avatarUrl}
                    />
                  ) : (
                    <ImageSquareIcon aria-hidden="true" size={20} />
                  )}
                </div>
                <div className="account-dialog-avatar-actions">
                  <label
                    className="ds-button ds-button-secondary ds-button-size-default account-dialog-upload-trigger"
                    data-disabled={uploadingAvatar || savingProfile}
                  >
                    <input
                      accept={AVATAR_ACCEPTED_TYPES.join(",")}
                      aria-label={t("选择头像图片", "Choose a profile photo")}
                      className="account-dialog-avatar-input"
                      title={t("JPEG、PNG 或 WebP，最大 5MB。", "JPEG, PNG or WebP, up to 5MB.")}
                      disabled={uploadingAvatar || savingProfile}
                      onChange={(event) => void handleAvatarChange(event)}
                      type="file"
                    />
                    <span className="ds-button-content">
                      {uploadingAvatar ? t("上传中…", "Uploading…") : t("上传文件", "Upload file")}
                    </span>
                  </label>

                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="account-dialog-section">
          <header className="account-dialog-section-header">
            <h4 className="account-dialog-section-title">{t("个人简介", "About you")}</h4>
            <p className="account-dialog-section-description">{t("简单介绍一下您自己。", "Share a little about yourself.")}</p>
          </header>
          <div className="account-dialog-bio">
            <label className="sr-only" htmlFor="account-profile-bio">
              {t("个人简介", "About you")}
            </label>
            <textarea
              className="ds-input account-dialog-textarea"
              id="account-profile-bio"
              maxLength={240}
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder={t("写下您的个人介绍", "A few words about you")}
              value={draft.bio}
            />
            <div className="account-dialog-meta">
              <span>{formatNumber(draft.bio.length)} / {formatNumber(240)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
