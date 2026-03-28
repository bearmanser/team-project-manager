import { MarketingPage } from "../pages/MarketingPage";
import { SignupPage } from "../pages/SignupPage";

type PublicRouteViewProps = {
  busyLabel: string | null;
  error: string | null;
  notice: string | null;
  loginForm: {
    identifier: string;
    password: string;
  };
  signupForm: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  };
  themeMode: "light" | "dark";
  isSignupRoute: boolean;
  onLoginFormChange: (field: "identifier" | "password", value: string) => void;
  onSignupFormChange: (
    field: "username" | "email" | "password" | "confirmPassword",
    value: string,
  ) => void;
  onNavigateHome: () => void;
  onNavigateToSignup: () => void;
  onSubmitLogin: () => void;
  onSubmitSignup: (connectGitHub: boolean) => void;
  onToggleThemeMode: () => void;
};

export function PublicRouteView({
  busyLabel,
  error,
  notice,
  loginForm,
  signupForm,
  themeMode,
  isSignupRoute,
  onLoginFormChange,
  onSignupFormChange,
  onNavigateHome,
  onNavigateToSignup,
  onSubmitLogin,
  onSubmitSignup,
  onToggleThemeMode,
}: PublicRouteViewProps) {
  if (isSignupRoute) {
    return (
      <SignupPage
        busyLabel={busyLabel}
        error={error}
        notice={notice}
        loginForm={loginForm}
        signupForm={signupForm}
        themeMode={themeMode}
        onLoginFormChange={onLoginFormChange}
        onSignupFormChange={onSignupFormChange}
        onNavigateHome={onNavigateHome}
        onSubmitLogin={onSubmitLogin}
        onSubmitSignup={onSubmitSignup}
        onToggleThemeMode={onToggleThemeMode}
      />
    );
  }

  return (
    <MarketingPage
      busyLabel={busyLabel}
      error={error}
      notice={notice}
      loginForm={loginForm}
      themeMode={themeMode}
      onLoginFormChange={onLoginFormChange}
      onNavigateHome={onNavigateHome}
      onNavigateToSignup={onNavigateToSignup}
      onSubmitLogin={onSubmitLogin}
      onToggleThemeMode={onToggleThemeMode}
    />
  );
}
