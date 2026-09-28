import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ToastProvider } from "../src/contexts/ToastContext";
import ChangePasswordModal from "../src/components/ChangePasswordModal";

vi.mock("../src/api/users", () => ({
  changePassword: vi.fn(),
}));

import * as usersApi from "../src/api/users";

function renderModal(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSuccess = props.onSuccess ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ChangePasswordModal onClose={onClose} onSuccess={onSuccess} />
      </ToastProvider>
    </QueryClientProvider>
  );
  return { onSuccess, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChangePasswordModal", () => {
  it("blocks submit when the confirm password does not match", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "OldPass123" },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "NewPass123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "Different123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));

    expect(usersApi.changePassword).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("blocks submit when the new password is too weak", () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "OldPass123" },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "weak" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "weak" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));

    expect(usersApi.changePassword).not.toHaveBeenCalled();
    expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
  });

  it("calls onSuccess when the password change succeeds", async () => {
    usersApi.changePassword.mockResolvedValue(undefined);
    const { onSuccess } = renderModal();

    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "OldPass123" },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "NewPass123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "NewPass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => expect(usersApi.changePassword).toHaveBeenCalledWith({
      current_password: "OldPass123",
      new_password: "NewPass123",
    }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
