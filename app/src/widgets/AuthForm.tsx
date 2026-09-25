/**
 * [INPUT]: 依赖 React 的登录/注册/验证码局部状态与输入框引用、共享 Button/GlowButton/Input/PasswordInput、MarketingLink，以及 shared/supabase 认证服务
 * [OUTPUT]: 对外提供登录、双密码注册、六格验证码与 Google OAuth 共用的 AuthForm；发起动作独占加载反馈，状态提示和验证码通过 auth-* 类消费共享排版，协议用 SPA 链接
 * [POS]: widgets 的唯一认证表单，由 LoginPage 承载；表单负责认证步骤，页面负责布局和导航，不直接持有 Supabase client
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { MarketingLink } from "./LandingMotion/MarketingLink";
import {
  ArrowLeftIcon,
  GoogleLogoIcon,
} from "../shared/design-system/icons";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  getAuthErrorMessage,
  resendSignupOtp,
  signInWithPassword,
  signInWithGoogle,
  signUpWithPassword,
  verifyEmailOtp,
} from "../shared/supabase/auth";
import {
  Button,
  GlowButton,
  Input,
  PasswordInput,
} from "../shared/design-system/components";

const OTP_LENGTH = 6;

type AuthStep = "credentials" | "verification";
type AuthMode = "login" | "register";
type PendingAuthAction = "credentials" | "google" | "verification" | "resend";

type AuthFormProps = {
  onAuthenticated: () => void;
};

function createEmptyOtp() {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [step, setStep] = useState<AuthStep>("credentials");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState(createEmptyOtp);
  const [pendingAction, setPendingAction] = useState<PendingAuthAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const verificationInFlightRef = useRef(false);
  const busy = pendingAction !== null;

  useEffect(() => {
    if (step === "verification") {
      otpInputRefs.current[0]?.focus();
    }
  }, [step]);

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "register" && password !== confirmPassword) {
      setErrorMessage("两次输入的密码不一致。");
      return;
    }

    setPendingAction("credentials");
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const outcome =
        mode === "register"
          ? await signUpWithPassword(email, password)
          : await signInWithPassword(email, password);

      if (outcome === "authenticated") {
        onAuthenticated();
        return;
      }

      setOtp(createEmptyOtp());
      setStep("verification");
      setNoticeMessage(
        mode === "register"
          ? "6 位验证码已发送，请完成邮箱验证。"
          : "账号尚未验证，新的 6 位验证码已发送。",
      );
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGoogleSignIn() {
    setPendingAction("google");
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      setPendingAction(null);
    }
  }

  async function submitOtp(code: string) {
    if (verificationInFlightRef.current) {
      return;
    }

    verificationInFlightRef.current = true;
    setPendingAction("verification");
    setErrorMessage(null);
    setNoticeMessage("正在验证验证码…");

    try {
      await verifyEmailOtp(email, code);
      onAuthenticated();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      setNoticeMessage(null);
      setOtp(createEmptyOtp());
      requestAnimationFrame(() => otpInputRefs.current[0]?.focus());
    } finally {
      verificationInFlightRef.current = false;
      setPendingAction(null);
    }
  }

  function applyOtpDigits(startIndex: number, rawDigits: string) {
    const digits = rawDigits.replace(/\D/g, "");

    if (!digits) {
      const nextOtp = [...otp];
      nextOtp[startIndex] = "";
      setOtp(nextOtp);
      return;
    }

    const nextOtp = [...otp];
    const availableDigits = digits.slice(0, OTP_LENGTH - startIndex);

    for (const [offset, digit] of [...availableDigits].entries()) {
      nextOtp[startIndex + offset] = digit;
    }

    setOtp(nextOtp);

    if (nextOtp.every(Boolean)) {
      void submitOtp(nextOtp.join(""));
      return;
    }

    const nextIndex = Math.min(startIndex + availableDigits.length, OTP_LENGTH - 1);
    otpInputRefs.current[nextIndex]?.focus();
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    applyOtpDigits(0, event.clipboardData.getData("text"));
  }

  function handleOtpKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      const nextOtp = [...otp];
      nextOtp[index - 1] = "";
      setOtp(nextOtp);
      otpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  async function handleResendOtp() {
    setPendingAction("resend");
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      await resendSignupOtp(email);
      setOtp(createEmptyOtp());
      setNoticeMessage("新的 6 位验证码已发送，请检查收件箱。");
      requestAnimationFrame(() => otpInputRefs.current[0]?.focus());
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  function handleBackToCredentials() {
    setStep("credentials");
    setOtp(createEmptyOtp());
    setErrorMessage(null);
    setNoticeMessage(null);
  }

  function handleModeChange() {
    setMode((currentMode) => (currentMode === "login" ? "register" : "login"));
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrorMessage(null);
    setNoticeMessage(null);
  }

  const isVerificationStep = step === "verification";
  const isRegisterMode = mode === "register";

  return (
    <section aria-labelledby="auth-form-title" className="auth-card">
      <h2 className={isVerificationStep ? "auth-verification-title" : "sr-only"} id="auth-form-title">
        {isVerificationStep ? "验证邮箱" : isRegisterMode ? "注册 Folune" : "登录 Folune"}
      </h2>
      {isVerificationStep ? (
        <p className="auth-verification-description">验证码已发送至 {email.trim().toLowerCase()}</p>
      ) : null}
      {isVerificationStep ? (
        <div className="auth-verification-body">
          <div className="auth-otp-grid" role="group" aria-label="六位邮箱验证码">
            {otp.map((digit, index) => (
              <Input
                aria-label={`验证码第 ${index + 1} 位`}
                autoComplete={index === 0 ? "one-time-code" : "off"}
                className="auth-otp-input"
                disabled={busy}
                inputMode="numeric"
                key={index}
                maxLength={index === 0 ? OTP_LENGTH : 1}
                onChange={(event) => applyOtpDigits(index, event.target.value)}
                onKeyDown={(event) => handleOtpKeyDown(event, index)}
                onPaste={handleOtpPaste}
                pattern="[0-9]*"
                ref={(input) => {
                  otpInputRefs.current[index] = input;
                }}
                value={digit}
              />
            ))}
          </div>

          <p aria-live="polite" className="auth-status-message" data-tone={errorMessage ? "error" : undefined}>
            {errorMessage ?? noticeMessage ?? "输满 6 位后将自动验证并进入 Folune。"}
          </p>

          <div className="auth-verification-actions">
            <Button
              disabled={busy}
              icon={ArrowLeftIcon}
              onClick={handleBackToCredentials}
              variant="ghost"
            >
              修改邮箱
            </Button>
            <Button disabled={busy} loading={pendingAction === "resend"} onClick={handleResendOtp} variant="secondary">
              {pendingAction === "resend" ? "发送中…" : "重新发送"}
            </Button>
          </div>
        </div>
      ) : (
        <form className="auth-credentials-form" onSubmit={handleCredentialsSubmit}>
          <Button
            className="auth-provider-button w-full"
            disabled={busy}
            icon={GoogleLogoIcon}
            loading={pendingAction === "google"}
            onClick={handleGoogleSignIn}
            variant="secondary"
          >
            使用 Google 账号继续
          </Button>

          <div className="auth-divider" aria-hidden="true">
            或
          </div>

          <label className="sr-only" htmlFor="auth-email">
            电子邮箱
          </label>
          <Input
            autoComplete="username"
            className="auth-input w-full"
            disabled={busy}
            id="auth-email"
            name="username"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="输入您的电子邮箱"
            required
            type="email"
            value={email}
          />

          <label className="sr-only" htmlFor="auth-password">
            密码
          </label>
          <PasswordInput
            autoComplete={isRegisterMode ? "new-password" : "current-password"}
            className="auth-input w-full"
            disabled={busy}
            id="auth-password"
            minLength={6}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            onVisibilityChange={setShowPassword}
            placeholder="输入密码"
            required
            value={password}
            visibilityLabel="密码"
            visible={showPassword}
          />

          {isRegisterMode ? (
            <>
              <label className="sr-only" htmlFor="auth-confirm-password">
                确认密码
              </label>
              <PasswordInput
                autoComplete="new-password"
                className="auth-input w-full"
                disabled={busy}
                id="auth-confirm-password"
                minLength={6}
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                onVisibilityChange={setShowConfirmPassword}
                placeholder="确认密码"
                required
                value={confirmPassword}
                visibilityLabel="确认密码"
                visible={showConfirmPassword}
              />
            </>
          ) : null}

          {!isRegisterMode ? (
            <button className="auth-forgot-password" disabled={busy} type="button">
              忘记密码？
            </button>
          ) : null}

          {errorMessage ? (
            <p aria-live="polite" className="auth-status-message" data-tone="error">
              {errorMessage}
            </p>
          ) : null}

          <GlowButton
            className="auth-submit-button w-full"
            disabled={busy}
            loading={pendingAction === "credentials"}
            type="submit"
          >
            {pendingAction === "credentials" ? "处理中…" : isRegisterMode ? "注册" : "登录"}
          </GlowButton>

          <p className="auth-mode-switch">
            {isRegisterMode ? "已有账号？" : "还没有账号？"}
            <button disabled={busy} onClick={handleModeChange} type="button">
              {isRegisterMode ? "登录" : "注册"}
            </button>
          </p>

          <p className="auth-terms-copy">
            继续即表示您同意 Folune 的
            <MarketingLink to="/terms" state={{ fromLegalLink: true }}>服务条款</MarketingLink>
            和
            <MarketingLink to="/privacy" state={{ fromLegalLink: true }}>隐私政策</MarketingLink>
          </p>
        </form>
      )}
    </section>
  );
}
