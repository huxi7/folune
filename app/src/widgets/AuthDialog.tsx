/**
 * [INPUT]: 依赖 React 的登录/注册/密码显隐/验证码局部状态与输入框引用，依赖本地 design-system 的 Button、Dialog、Input、PasswordInput，依赖 shared/supabase 认证服务
 * [OUTPUT]: 对外提供可切换登录与双密码注册、密码显隐、协议提示、六格邮箱验证码与 Google OAuth 的统一 Dialog
 * [POS]: app/src/widgets 的统一认证组件，被 MarketingHeader 消费；不直接持有 Supabase client
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
  Dialog,
  Input,
  PasswordInput,
} from "../shared/design-system/components";

const OTP_LENGTH = 6;

type AuthStep = "credentials" | "verification";
type AuthMode = "login" | "register";

type AuthDialogProps = {
  onAuthenticated: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function createEmptyOtp() {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

export function AuthDialog({
  onAuthenticated,
  onOpenChange,
  open,
}: AuthDialogProps) {
  const [step, setStep] = useState<AuthStep>("credentials");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState(createEmptyOtp);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const verificationInFlightRef = useRef(false);

  useEffect(() => {
    if (step === "verification") {
      otpInputRefs.current[0]?.focus();
    }
  }, [step]);

  function resetDialog() {
    setStep("credentials");
    setMode("login");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOtp(createEmptyOtp());
    setBusy(false);
    setErrorMessage(null);
    setNoticeMessage(null);
    verificationInFlightRef.current = false;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDialog();
    }

    onOpenChange(nextOpen);
  }

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "register" && password !== confirmPassword) {
      setErrorMessage("两次输入的密码不一致。");
      return;
    }

    setBusy(true);
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
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      setBusy(false);
    }
  }

  async function submitOtp(code: string) {
    if (verificationInFlightRef.current) {
      return;
    }

    verificationInFlightRef.current = true;
    setBusy(true);
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
      setBusy(false);
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
    setBusy(true);
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
      setBusy(false);
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
    <Dialog
      description={
        isVerificationStep
          ? `验证码已发送至 ${email.trim().toLowerCase()}`
          : undefined
      }
      onOpenChange={handleOpenChange}
      open={open}
      title={
        isVerificationStep
          ? "验证邮箱"
          : isRegisterMode
            ? "注册 SuperNote"
            : "登录 SuperNote"
      }
    >
      {isVerificationStep ? (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-6 gap-2" role="group" aria-label="六位邮箱验证码">
            {otp.map((digit, index) => (
              <Input
                aria-label={`验证码第 ${index + 1} 位`}
                autoComplete={index === 0 ? "one-time-code" : "off"}
                className="w-full px-0 text-center font-mono text-lg font-semibold"
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

          <div aria-live="polite" className="min-h-5 text-sm leading-5">
            {errorMessage ? (
              <p className="text-destructive">{errorMessage}</p>
            ) : noticeMessage ? (
              <p className="text-muted-foreground">{noticeMessage}</p>
            ) : (
              <p className="text-muted-foreground">输满 6 位后将自动验证并进入 SuperNote。</p>
            )}
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              disabled={busy}
              icon={ArrowLeftIcon}
              onClick={handleBackToCredentials}
              variant="ghost"
            >
              修改邮箱
            </Button>
            <Button disabled={busy} onClick={handleResendOtp} variant="secondary">
              {busy ? "处理中…" : "重新发送"}
            </Button>
          </div>
        </div>
      ) : (
        <form className="auth-credentials-form" onSubmit={handleCredentialsSubmit}>
          <Button
            className="auth-provider-button w-full"
            disabled={busy}
            icon={GoogleLogoIcon}
            onClick={handleGoogleSignIn}
            variant="secondary"
          >
            使用 Google 账号继续
          </Button>

          <div className="auth-divider" aria-hidden="true">
            <span />
            或
            <span />
          </div>

          <label className="sr-only" htmlFor="auth-email">
            电子邮箱
          </label>
          <Input
            autoComplete="username"
            className="auth-input w-full"
            data-dialog-autofocus
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

          {errorMessage ? (
            <p aria-live="polite" className="text-sm leading-5 text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <Button
            className="auth-submit-button w-full"
            disabled={busy}
            type="submit"
            variant="primary"
          >
            {busy ? "处理中…" : isRegisterMode ? "注册" : "登录"}
          </Button>

          <p className="auth-mode-switch">
            {isRegisterMode ? "已有账号？" : "还没有账号？"}
            <button disabled={busy} onClick={handleModeChange} type="button">
              {isRegisterMode ? "登录" : "注册"}
            </button>
          </p>

          <p className="auth-terms-copy">
            继续即表示您同意 SuperNote 的
            <button type="button">服务条款</button>
            和
            <button type="button">隐私政策</button>
          </p>
        </form>
      )}
    </Dialog>
  );
}
