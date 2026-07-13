import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace })
}));

describe("LoginPage", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
    vi.stubGlobal("React", React);
  });

  it("默认不填充或展示任何登录凭据，并提示联系管理员", () => {
    render(<LoginPage />);

    expect(screen.getByRole("textbox", { name: "邮箱" })).toHaveValue("");
    expect(screen.getByLabelText("密码")).toHaveValue("");
    expect(screen.getByText("请联系管理员获取账号")).toBeInTheDocument();
    expect(screen.queryByText(/@cnyonye\.local/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument();
  });

  it("提交期间禁用按钮，并用实时状态消息说明进度", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveResponse = resolve;
          })
      )
    );

    render(<LoginPage />);
    const submit = screen.getByRole("button", { name: "登录" });
    fireEvent.click(submit);

    expect(submit).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("正在登录...");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    resolveResponse(
      new Response(JSON.stringify({ user: { name: "销售员", role: "sales" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/tasks/new"));
  });

  it("网络异常后显示提示并恢复可提交状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    render(<LoginPage />);
    const submit = screen.getByRole("button", { name: "登录" });
    fireEvent.click(submit);

    expect(await screen.findByRole("status")).toHaveTextContent("网络异常，请稍后重试");
    expect(submit).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("响应不是 JSON 时显示提示并恢复可提交状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }))
    );

    render(<LoginPage />);
    const submit = screen.getByRole("button", { name: "登录" });
    fireEvent.click(submit);

    expect(await screen.findByRole("status")).toHaveTextContent("服务器响应格式异常，请稍后重试");
    expect(submit).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("API 拒绝登录后显示服务端提示并恢复可提交状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "邮箱或密码错误" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    render(<LoginPage />);
    const submit = screen.getByRole("button", { name: "登录" });
    fireEvent.click(submit);

    expect(await screen.findByRole("status")).toHaveTextContent("邮箱或密码错误");
    expect(submit).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
