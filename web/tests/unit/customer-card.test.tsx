import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, expect, it } from "vitest";
import { CustomerCard } from "@/components/customer-card";

const customer = {
  id: "c1",
  name: "Arabian Medical Supplies Co.",
  country: "Saudi Arabia",
  region: "Middle East",
  city: "Riyadh",
  website: "https://arabian-med.example",
  customerType: "distributor",
  businessSummary: "Imports and distributes wound care and sports medicine supplies.",
  demandEvidence: "wound care catalog; import signal",
  recommendedProducts: ["kinesiology_tape", "wound_dressing"],
  grade: "B",
  score: 76,
  status: "not_contacted",
  contacts: [
    {
      id: "ct1",
      name: "Ahmed Saleh",
      title: "General Manager",
      email: "owner@example.com",
      emailStatus: "accept_all",
      source: "Hunter domain search",
      sourceUrl: "https://hunter.example/source",
      isPrimary: true,
      riskNote: "accept-all domain"
    }
  ],
  evidences: [
    {
      id: "ev1",
      type: "catalog",
      title: "Wound care catalog",
      url: "https://arabian-med.example/catalog",
      summary: "Catalog includes wound dressing import categories."
    }
  ],
  letters: [
    {
      id: "letter1",
      subject: "Supply proposal for wound care and kinesiology tape",
      body: "Dear Ahmed, we noticed your wound care catalog and can support OEM supply."
    }
  ]
};

describe("CustomerCard", () => {
  it("shows business match, evidence, recommendations, contact risk, outreach, and edit link", () => {
    render(<CustomerCard customer={customer} />);

    expect(screen.getByText("Arabian Medical Supplies Co.")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("76 分")).toBeInTheDocument();
    expect(screen.getByText(/Imports and distributes wound care/)).toBeInTheDocument();
    expect(screen.getByText("wound care catalog; import signal")).toBeInTheDocument();
    expect(screen.getByText(/kinesiology_tape/)).toBeInTheDocument();
    expect(screen.getByText(/accept-all 风险/)).toBeInTheDocument();
    expect(screen.getByText("Supply proposal for wound care and kinesiology tape")).toBeInTheDocument();
    expect(screen.getByText(/Dear Ahmed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "编辑客户" })).toHaveAttribute("href", "/customers/c1");
  });

  it("renders contact source and evidence links as readable links", () => {
    render(<CustomerCard customer={customer} />);

    expect(screen.getByRole("link", { name: "Hunter domain search" })).toHaveAttribute(
      "href",
      "https://hunter.example/source"
    );
    expect(screen.getByRole("link", { name: "Wound care catalog" })).toHaveAttribute(
      "href",
      "https://arabian-med.example/catalog"
    );
  });
});
