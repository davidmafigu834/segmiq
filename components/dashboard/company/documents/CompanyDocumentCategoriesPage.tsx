"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FolderTree, Merge, Plus } from "lucide-react";
import { Button } from "@/components/sales/ui";

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  creation_source: string;
  status: string;
  document_count: number;
};

export function CompanyDocumentCategoriesPage({ clientId }: { clientId: string }) {
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
    <div className="px-4 py-6 md:px-6">
      <Link href="/client/documents" className="text-sm text-zinc-500 hover:text-lime-300">
        ← Documents
      </Link>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Categories</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Reusable folders for organizing documents. AI reuses existing categories before suggesting
            new ones; auto-create stays off unless you enable it in settings.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Plus size={16} />
          New category
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <Button type="submit" variant="primary" size="md" className="mt-3" disabled={creating}>
          {creating ? "Creating…" : "Create category"}
        </Button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Documents</th>
              <th className="px-4 py-2.5">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                  Loading categories…
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                  No categories yet. Create one or let document analysis suggest reusable names.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-zinc-900">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FolderTree size={16} className="mt-0.5 text-zinc-500" />
                      <div>
                        <p className="text-white">{cat.name}</p>
                        {cat.description ? (
                          <p className="mt-0.5 text-xs text-zinc-500">{cat.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{cat.document_count}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {cat.creation_source === "AGENT" ? "AI" : "Manual"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {categories.length > 1 ? (
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Merge size={16} />
            Merge categories
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Move all documents from the source category into the target, then retire the source.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={mergeSource}
              onChange={(e) => setMergeSource(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
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
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
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
    </div>
  );
}
