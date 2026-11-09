import { describe, it, expect } from "vitest";
import { sanitizeBreadcrumbs, BreadcrumbItem } from "../AppShell";

describe("AppShell breadcrumb sanitization (sanitizeBreadcrumbs)", () => {
  it("returns an empty array when given undefined, null, or non-array inputs", () => {
    expect(sanitizeBreadcrumbs(undefined)).toEqual([]);
    expect(sanitizeBreadcrumbs(null as unknown as BreadcrumbItem[])).toEqual([]);
    expect(sanitizeBreadcrumbs([] as BreadcrumbItem[])).toEqual([]);
  });

  it("filters out root breadcrumbs with href === '/'", () => {
    const input: BreadcrumbItem[] = [
      { label: "Dashboard", href: "/" },
      { label: "Project Alpha", href: "/projects/123/baseline" },
      { label: "Change Proposals", active: true },
    ];

    const result = sanitizeBreadcrumbs(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: "Project Alpha", href: "/projects/123/baseline" });
    expect(result[1]).toEqual({ label: "Change Proposals", active: true });
  });

  it("filters out breadcrumb items labeled 'Dashboard' regardless of casing or surrounding whitespace", () => {
    const variations: BreadcrumbItem[] = [
      { label: "dashboard" },
      { label: "Dashboard", href: "/" },
      { label: "  DASHBOARD  ", href: "/anything" },
      { label: "DashBoard" },
    ];

    for (const item of variations) {
      const result = sanitizeBreadcrumbs([item, { label: "Scope Baseline", active: true }]);
      expect(result).toEqual([{ label: "Scope Baseline", active: true }]);
    }
  });

  it("filters out any item with href === '/' even if label is custom", () => {
    const input: BreadcrumbItem[] = [
      { label: "Home", href: "/" },
      { label: "Settings", active: true },
    ];

    const result = sanitizeBreadcrumbs(input);
    expect(result).toEqual([{ label: "Settings", active: true }]);
  });

  it("preserves non-root breadcrumb items that mention dashboard in other contexts or subroutes", () => {
    const input: BreadcrumbItem[] = [
      { label: "Project (abc...)", href: "/projects/abc/baseline" },
      { label: "Dashboard Metrics Export", href: "/projects/abc/export" },
      { label: "Analytics Dashboard", active: true },
    ];

    const result = sanitizeBreadcrumbs(input);
    expect(result).toHaveLength(3);
    expect(result).toEqual(input);
  });

  it("handles malformed breadcrumb objects safely without throwing", () => {
    const malformed = [
      null as unknown as BreadcrumbItem,
      { label: "" },
      { label: "Valid Label", href: "/valid" },
    ];

    const result = sanitizeBreadcrumbs(malformed);
    expect(result).toEqual([
      { label: "" },
      { label: "Valid Label", href: "/valid" },
    ]);
  });
});

