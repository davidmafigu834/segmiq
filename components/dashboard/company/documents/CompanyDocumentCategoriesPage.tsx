"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FolderTree, Merge, Plus } from "lucide-react";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import { Badge, Button } from "@/components/sales/ui";
import type { UserRole } from "@/types";

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  creation_source: string;
  status: string;
  document_count: number;
};

export function CompanyDocumentCategoriesPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: {
    companyName: string;
    companyLogoUrl?: string | null;
    userName: string;
    avatarUrl?: string | null;
    unreadNotifications: number;
    notificationRole: UserRole;
    whatsappBadge?: number;
  };
}) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/company-documents/categories`);
      if (!res.ok) {
        setError("Could not load categories.");
        return;
      }
      const data = (await res.json()) as { categories: CategoryRow[] };
      setCategories(data.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/company-documents/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) ?? "Could not create category.");
        return;
      }
      setName("");
      setDescription("");
      await loadCategories();
    } finally {
      setCreating(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/company-documents/categories`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCategoryId: mergeSource,
          targetCategoryId: mergeTarget,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) ?? "Could not merge categories.");
        return;
      }
      setMergeSource("");
      setMergeTarget("");
      await loadCategories();
    } finally {
      setMerging(false);
    }
  };

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="COMPANY / DOCUMENTS / CATEGORIES"
      title="Categories"
      description="Organize documents without relying on folders."
      titleActions={
        <Link href="/client/documents" className="text-[13px] font-medium text-sales-brand-fg hover:underline">
          ← Documents
        </Link>
      }
    >
      {error ? (
        <p className="mb-4 rounded-[10px] border border-sales-danger/25 bg-sales-danger-soft px-4 py-3 text-[13px] text-sales-danger-fg">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="workspace-card rounded-[12px] border border-sales-border bg-sales-surface p-4"
      >
        <div className="flex items-center gap-2 text-[14px] font-medium text-sales-text-primary">
          <Plus size={16} />
          New category
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5 text-[14px] text-sales-text-primary"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5 text-[14px] text-sales-text-primary"
          />
        </div>
        <Button type="submit" variant="primary" size="md" className="mt-3" disabled={creating}>
          {creating ? "Creating…" : "Create category"}
        </Button>
      </form>

      <div className="mt-6 overflow-hidden rounded-[12px] border border-sales-border">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[11px] uppercase tracking-wide text-sales-text-muted">
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Documents</th>
              <th className="px-4 py-2.5 font-medium">Created by</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sales-text-muted">
                  Loading categories…
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sales-text-muted">
                  No categories yet. SegmiQ will suggest reusable names as documents are analyzed.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-sales-border-subtle last:border-0">
                  <td className="px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      <FolderTree size={16} className="mt-0.5 text-sales-text-muted" />
                      <div>
                        <p className="font-medium text-sales-text-primary">{cat.name}</p>
                        {cat.description ? (
                          <p className="mt-0.5 text-[12px] text-sales-text-muted">{cat.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-sales-text-secondary">{cat.document_count}</td>
                  <td className="px-4 py-3.5">
                    {cat.creation_source === "AGENT" ? (
                      <Badge tone="brand" size="sm" appearance="soft">
                        SegmiQ
                      </Badge>
                    ) : (
                      <span className="text-sales-text-muted">Company</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {categories.length > 1 ? (
        <div className="mt-6 workspace-card rounded-[12px] border border-sales-border bg-sales-surface p-4">
          <div className="flex items-center gap-2 text-[14px] font-medium text-sales-text-primary">
            <Merge size={16} />
            Merge categories
          </div>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Move all documents from the source category into the target, then retire the source.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={mergeSource}
              onChange={(e) => setMergeSource(e.target.value)}
              className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5 text-[14px] text-sales-text-primary"
            >
              <option value="">Source category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5 text-[14px] text-sales-text-primary"
            >
              <option value="">Target category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            size="md"
            className="mt-3"
            disabled={merging || !mergeSource || !mergeTarget || mergeSource === mergeTarget}
            onClick={() => void handleMerge()}
          >
            {merging ? "Merging…" : "Merge into target"}
          </Button>
        </div>
      ) : null}
    </CommercialModulePage>
  );
}
