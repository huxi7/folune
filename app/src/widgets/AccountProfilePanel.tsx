/**
 * [INPUT]: 依赖可后台刷新的后端 Profile、shared/api/profile 的 username/bio PATCH 与 5MB 头像上传、React 受控草稿/800ms 防抖副作用/原生文件 input、本地 UI 与 共享 Lucide 图标
 * [OUTPUT]: 对外提供 AccountDialog 内的账户资料面板、仅按 bio/username 合并后台 Profile 与本地草稿、静默自动保存、头像即时上传与全局 Toast 反馈
 * [POS]: app/src/widgets 的账户资料栏，以 stale-while-revalidate 字段级冲突保护和串行防抖保存消除整页 Loading 与显式提交区
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  ImageSquareIcon,
  UploadSimpleIcon,
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
    setAutosaveMessage("正在自动保存个人资料");

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
      setAutosaveMessage("个人资料已自动保存");
      toast({
        description: "用户名与简介已同步。",
        duration: 2800,
        title: "已自动保存",
        variant: "success",
      });
    } catch (error) {
      const description = error instanceof Error
        ? error.message
        : "自动保存失败，请稍后重试。";
      failedDraft.current = nextDraft;
      setAutosaveMessage(description);
      toast({
        description,
        title: "个人资料自动保存失败",
        variant: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  }, [onProfileChange, toast]);

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
        const description = "用户名不能为空。";
        failedDraft.current = nextDraft;
        setAutosaveMessage(description);
        toast({
          description,
          title: "无法自动保存",
          variant: "warning",
        });
        return;
      }

      void saveProfileDraft(nextDraft);
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [draft, saveProfileDraft, savingProfile, toast, uploadingAvatar]);

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
      const description = "头像文件不能超过 5MB。";
      setAutosaveMessage(description);
      toast({ description, title: "无法上传头像", variant: "warning" });
      return;
    }

    if (!AVATAR_ACCEPTED_TYPES.includes(
      file.type as (typeof AVATAR_ACCEPTED_TYPES)[number],
    )) {
      const description = "头像仅支持 JPEG、PNG 或 WebP 格式。";
      setAutosaveMessage(description);
      toast({ description, title: "无法上传头像", variant: "warning" });
      return;
    }

    setUploadingAvatar(true);
    setAutosaveMessage("正在上传头像");

    try {
      const updatedProfile = await uploadProfileAvatar(file);
      onProfileChange(updatedProfile);
      lastSavedDraft.current = normalizeProfileDraft(createProfileDraft(updatedProfile));
      setAutosaveMessage("头像已更新");
      toast({
        description: "新头像已同步到您的账户。",
        title: "头像已更新",
        variant: "success",
      });
    } catch (error) {
      const description = error instanceof Error
        ? error.message
        : "头像上传失败，请重试。";
      setAutosaveMessage(description);
      toast({ description, title: "头像上传失败", variant: "error" });
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
            <h4 className="account-dialog-section-title">基本信息</h4>
            <p className="account-dialog-section-description">
              用于账户入口与个人身份展示。
            </p>
          </header>

          <div className="account-dialog-rows">
            <div className="account-dialog-row">
              <label className="account-dialog-label" htmlFor="account-profile-username">
                用户名
              </label>
              <div className="account-dialog-control">
                <Input
                  autoCapitalize="none"
                  autoComplete="username"
                  id="account-profile-username"
                  maxLength={100}
                  onChange={(event) => updateField("username", event.target.value)}
                  placeholder="设置用户名"
                  spellCheck={false}
                  value={draft.username}
                />
              </div>
            </div>

            <div className="account-dialog-row">
              <label className="account-dialog-label" htmlFor="account-profile-email">
                邮箱
              </label>
              <div className="account-dialog-control">
                <Input
                  className="account-dialog-readonly-input"
                  id="account-profile-email"
                  readOnly
                  value={profile.email ?? "未绑定邮箱"}
                />
              </div>
            </div>

            <div className="account-dialog-row account-dialog-avatar-row">
              <p className="account-dialog-label">头像</p>
              <div className="account-dialog-avatar-control">
                <div className="account-dialog-avatar-preview">
                  {profile.avatarUrl ? (
                    <img
                      alt={profile.username + " 的头像"}
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
                      aria-label="选择头像图片"
                      className="account-dialog-avatar-input"
                      disabled={uploadingAvatar || savingProfile}
                      onChange={(event) => void handleAvatarChange(event)}
                      type="file"
                    />
                    <span className="ds-button-content">
                      <UploadSimpleIcon aria-hidden="true" size={16} />
                      {uploadingAvatar ? "上传中…" : "选择图片"}
                    </span>
                  </label>
                  <span>JPEG、PNG 或 WebP，最大 5MB。</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="account-dialog-section">
          <header className="account-dialog-section-header">
            <h4 className="account-dialog-section-title">个人简介</h4>
            <p className="account-dialog-section-description">简单介绍一下您自己。</p>
          </header>
          <div className="account-dialog-bio">
            <label className="sr-only" htmlFor="account-profile-bio">
              个人简介
            </label>
            <textarea
              className="ds-input account-dialog-textarea"
              id="account-profile-bio"
              maxLength={240}
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder="写下您的个人介绍"
              value={draft.bio}
            />
            <div className="account-dialog-meta">
              <span>展示在个人资料中。</span>
              <span>{draft.bio.length} / 240</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
