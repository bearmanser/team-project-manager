import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SignupPage } from "./SignupPage";
import { initialLoginForm, initialSignupForm } from "../../../app/forms";
import { renderWithProviders } from "../../../test/renderWithProviders";

function SignupPageHarness({
  onSubmitSignup,
}: {
  onSubmitSignup: (connectGitHub: boolean) => void;
}) {
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [signupForm, setSignupForm] = useState(initialSignupForm);

  return (
    <SignupPage
      busyLabel={null}
      error={null}
      notice={null}
      loginForm={loginForm}
      signupForm={signupForm}
      themeMode="dark"
      onLoginFormChange={(field, value) =>
        setLoginForm((current) => ({ ...current, [field]: value }))
      }
      onSignupFormChange={(field, value) =>
        setSignupForm((current) => ({ ...current, [field]: value }))
      }
      onNavigateHome={vi.fn()}
      onSubmitLogin={vi.fn()}
      onSubmitSignup={onSubmitSignup}
      onToggleThemeMode={vi.fn()}
    />
  );
}

function getSignupInput(label: string): HTMLInputElement {
  const field = screen.getByText(label).parentElement;
  const input = field?.querySelector("input");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Could not find signup input for ${label}`);
  }

  return input;
}

describe("SignupPage", () => {
  it("submits the standard signup flow from the main form", async () => {
    const onSubmitSignup = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<SignupPageHarness onSubmitSignup={onSubmitSignup} />);

    await user.type(getSignupInput("Username"), "magnus");
    await user.type(getSignupInput("Email"), "magnus@example.com");
    await user.type(getSignupInput("Password"), "super-secret");
    await user.type(getSignupInput("Confirm password"), "super-secret");

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(onSubmitSignup).toHaveBeenCalledOnce();
    expect(onSubmitSignup).toHaveBeenCalledWith(false);
  });

  it("supports the GitHub-connected signup flow", async () => {
    const onSubmitSignup = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<SignupPageHarness onSubmitSignup={onSubmitSignup} />);

    await user.click(
      screen.getByRole("button", { name: "Create account and connect GitHub" }),
    );

    expect(onSubmitSignup).toHaveBeenCalledOnce();
    expect(onSubmitSignup).toHaveBeenCalledWith(true);
  });
});
