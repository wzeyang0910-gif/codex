import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerEditForm } from "@/components/customer-edit-form";

describe("CustomerEditForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCHes notes and status and shows success", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ customer: { id: "c1" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomerEditForm customerId="c1" initialNotes="old note" initialStatus="not_contacted" />);

    fireEvent.change(screen.getByLabelText("跟进备注"), { target: { value: "Call next Monday" } });
    fireEvent.change(screen.getByLabelText("跟进状态"), { target: { value: "sent" } });
    fireEvent.click(screen.getByRole("button", { name: "保存编辑" }));

    await waitFor(() => expect(screen.getByText("已保存")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/customers/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Call next Monday", status: "sent" })
    });
  });

  it("keeps edited input values when the PATCH request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "客户更新内容不正确" }), { status: 400 }))
    );

    render(<CustomerEditForm customerId="c1" initialNotes="old note" initialStatus="not_contacted" />);

    fireEvent.change(screen.getByLabelText("跟进备注"), { target: { value: "Keep this note" } });
    fireEvent.change(screen.getByLabelText("跟进状态"), { target: { value: "quoted" } });
    fireEvent.click(screen.getByRole("button", { name: "保存编辑" }));

    expect(await screen.findByText("客户更新内容不正确")).toBeInTheDocument();
    expect(screen.getByLabelText("跟进备注")).toHaveValue("Keep this note");
    expect(screen.getByLabelText("跟进状态")).toHaveValue("quoted");
  });
});
