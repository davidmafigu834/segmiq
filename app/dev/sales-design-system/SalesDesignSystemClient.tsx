"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Info,
  LayoutList,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Zap,
  XCircle,
} from "lucide-react";
import {
  ActivityRow,
  Alert,
  Avatar,
  Badge,
  BrandIcon,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  DataTable,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  FieldError,
  FieldHint,
  FieldLabel,
  IconButton,
  SplitButton,
  Input,
  KpiStat,
  LeadIdentity,
  LeadScoreBadge,
  MetaPill,
  MetricValue,
  Milestone,
  PipelineStageBadge,
  Radio,
  SalesAreaChart,
  SalesBarChart,
  SalesDonutChart,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  StatusDot,
  Switch,
  Tabs,
  TextArea,
  Timeline,
  ToastProvider,
  Tooltip,
  Trend,
  useSalesToast,
} from "@/components/sales/ui";
import {
  SALES_COLORS,
  SALES_RADIUS,
  SALES_SHADOW,
} from "@/lib/sales/design-tokens";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";

const NAV = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing & elevation" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs & Search" },
  { id: "controls", label: "Switch & Selectors" },
  { id: "badges", label: "Badges & status" },
  { id: "cards", label: "Cards & KPIs" },
  { id: "table", label: "Table" },
  { id: "timeline", label: "Timeline" },
  { id: "charts", label: "Charts" },
  { id: "feedback", label: "Alerts & toasts" },
  { id: "misc", label: "Icons & misc" },
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4 border-b border-sales-border-subtle pb-12 last:border-0">
      <div>
        <h2 className="sales-type-h2 text-sales-text-primary">{title}</h2>
        {description ? (
          <p className="mt-1 sales-type-body text-sales-text-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ButtonShowcaseRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
        {title}
      </p>
      <div className="flex flex-wrap items-end gap-5">{children}</div>
    </div>
  );
}

function PreviewCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[11px] text-sales-text-muted">{label}</span>
      {children}
    </div>
  );
}

function Swatch({
  name,
  value,
  className,
  textClassName = "text-sales-text-primary",
}: {
  name: string;
  value: string;
  className: string;
  textClassName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-sales-md border border-sales-border bg-sales-surface">
      <div className={`h-14 ${className}`} />
      <div className="space-y-0.5 px-3 py-2">
        <p className={`text-[12px] font-semibold ${textClassName}`}>{name}</p>
        <p className="font-mono text-[11px] text-sales-text-muted">{value}</p>
      </div>
    </div>
  );
}

function ShowcaseInner() {
  const { toast } = useSalesToast();
  const [seg, setSeg] = useState<"day" | "week" | "month">("week");
  const [segCount, setSegCount] = useState<"all" | "open" | "won">("open");
  const [segIcon, setSegIcon] = useState<"day" | "list">("day");
  const [tab, setTab] = useState("overview");
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [indeterminateDemo] = useState(true);
  const [radio, setRadio] = useState("a");
  const [q, setQ] = useState("");
  const [qFilled, setQFilled] = useState("Acme Solar");
  const [selectVal, setSelectVal] = useState("whatsapp");
  const [notesFilled, setNotesFilled] = useState(
    "Discussed rooftop capacity and next-step site survey."
  );
  const crmTheme = useCrmThemeOptional();

  return (
    <div className="sales-dashboard-premium sales-ds-showcase min-h-screen overflow-y-auto bg-sales-bg text-sales-text-primary">
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8 pb-24 lg:px-8">
        <aside className="sticky top-8 hidden h-fit w-48 shrink-0 lg:block">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Catalog
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Design system sections">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-sales-sm px-2 py-1.5 text-[12px] font-medium text-sales-text-secondary transition-colors hover:bg-sales-surface hover:text-sales-text-primary"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-12">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
                Development only · Full catalog
              </p>
              <h1 className="sales-type-h1 mt-1">SegmiQ Sales Design System</h1>
              <p className="mt-2 max-w-2xl sales-type-body-lg text-sales-text-secondary">
                Complete token and component reference aligned to the Sales Design System boards.
                Use this page to verify primitives before shipping sales UI.
              </p>
              <p className="mt-2 text-[12px] text-sales-text-muted">
                Active theme: {crmTheme?.theme === "light" ? "Light" : "Dark"}
              </p>
            </div>
            <SalesThemeToggle />
          </header>

          {/* ── Colors ─────────────────────────────────────────── */}
          <Section id="colors" title="Colors" description="Brand, neutrals, and semantic tones.">
            <p className="text-[12px] font-semibold text-sales-text-secondary">Brand</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Swatch name="Brand" value={SALES_COLORS.brand} className="bg-sales-brand" />
              <Swatch name="Brand Hover" value={SALES_COLORS.brandHover} className="bg-sales-brand-hover" />
              <Swatch name="Brand Soft" value={SALES_COLORS.brandSoft} className="bg-sales-brand-soft" />
              <Swatch
                name="Brand Soft Solid"
                value={SALES_COLORS.brandSoftSolid}
                className="bg-[var(--sales-brand-soft-solid)]"
              />
            </div>
            <p className="pt-2 text-[12px] font-semibold text-sales-text-secondary">Neutrals</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Swatch name="Text Primary / 900" value={SALES_COLORS.neutral900} className="bg-[#101828]" textClassName="text-white" />
              <Swatch name="700" value={SALES_COLORS.neutral700} className="bg-[#344054]" textClassName="text-white" />
              <Swatch name="500" value={SALES_COLORS.neutral500} className="bg-[#475467]" textClassName="text-white" />
              <Swatch name="400 Muted" value={SALES_COLORS.neutral400} className="bg-[#667085]" />
              <Swatch name="300 Border Strong" value={SALES_COLORS.neutral300} className="bg-[#D0D5DD]" />
              <Swatch name="200" value={SALES_COLORS.neutral200} className="bg-[#E4E7EC]" />
              <Swatch name="100" value={SALES_COLORS.neutral100} className="bg-[#F4F6FB]" />
              <Swatch name="50 / Bg" value={SALES_COLORS.neutral50} className="bg-[#F7F8FC]" />
            </div>
            <p className="pt-2 text-[12px] font-semibold text-sales-text-secondary">Semantic</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Swatch name="Success" value={SALES_COLORS.success} className="bg-sales-success" textClassName="text-white" />
              <Swatch name="Warning" value={SALES_COLORS.warning} className="bg-sales-warning" />
              <Swatch name="Danger" value={SALES_COLORS.danger} className="bg-sales-danger" textClassName="text-white" />
              <Swatch name="Info" value={SALES_COLORS.info} className="bg-sales-info" textClassName="text-white" />
              <Swatch name="Purple" value={SALES_COLORS.purple} className="bg-sales-purple" textClassName="text-white" />
              <Swatch name="Teal" value={SALES_COLORS.teal} className="bg-sales-teal" textClassName="text-white" />
              <Swatch name="WhatsApp" value={SALES_COLORS.whatsapp} className="bg-sales-whatsapp" textClassName="text-white" />
              <Swatch name="Facebook" value={SALES_COLORS.facebook} className="bg-[#1877F2]" textClassName="text-white" />
            </div>
          </Section>

          {/* ── Typography ─────────────────────────────────────── */}
          <Section id="typography" title="Typography" description="Inter across the platform · board scale mapped to utility classes.">
            <Card>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-[11px] text-sales-text-muted">Display / H1 · 28px · 700</p>
                  <p className="sales-type-h1">Page title for pipeline</p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-sales-text-muted">H2 · 20px · 600</p>
                  <p className="sales-type-h2">Section heading</p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-sales-text-muted">H3 · 16px · 600</p>
                  <p className="sales-type-h3">Card title</p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-sales-text-muted">Body large · 14px</p>
                  <p className="sales-type-body-lg text-sales-text-primary">
                    Primary body copy for descriptions and insights.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-sales-text-muted">Body · 13px</p>
                  <p className="sales-type-body text-sales-text-secondary">
                    Secondary body for supporting detail and table cells.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-sales-text-muted">Small / Caption / Label</p>
                  <p className="sales-type-small text-sales-text-secondary">Small supporting text · 12px</p>
                  <p className="sales-type-caption text-sales-text-muted">Caption meta · 11px</p>
                  <p className="sales-type-label">Field label · 12px · 500</p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-sales-text-muted">Metric · tabular-nums</p>
                  <p className="sales-type-metric">$118,450</p>
                  <p className="mt-1 sales-tabular text-[14px] text-sales-text-secondary">
                    12,450 · 32% · 08:42
                  </p>
                </div>
              </CardContent>
            </Card>
          </Section>

          {/* ── Spacing & elevation ────────────────────────────── */}
          <Section id="spacing" title="Spacing & elevation" description="4px base scale · radius · shadows.">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Spacing</CardTitle>
                  <CardDescription>4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-2">
                  {[4, 8, 12, 16, 20, 24, 32, 40, 48].map((n) => (
                    <div key={n} className="flex flex-col items-center gap-1">
                      <div className="rounded-sm bg-sales-brand" style={{ width: n, height: 24 }} />
                      <span className="text-[10px] text-sales-text-muted">{n}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Radius</CardTitle>
                  <CardDescription>
                    xs {SALES_RADIUS.xs} · sm {SALES_RADIUS.sm} · md {SALES_RADIUS.md} · lg{" "}
                    {SALES_RADIUS.lg} · xl {SALES_RADIUS.xl} · pill
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                  {(
                    [
                      ["xs", "rounded-sales-xs"],
                      ["sm", "rounded-sales-sm"],
                      ["md", "rounded-sales-md"],
                      ["lg", "rounded-sales-lg"],
                      ["xl", "rounded-sales-xl"],
                      ["pill", "rounded-full"],
                    ] as const
                  ).map(([label, cls]) => (
                    <div
                      key={label}
                      className={`flex h-12 w-16 items-center justify-center border border-sales-border-strong bg-sales-brand-soft text-[11px] font-medium ${cls}`}
                    >
                      {label}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["Card", SALES_SHADOW.card, "shadow-sales-card"],
                  ["Dropdown", SALES_SHADOW.dropdown, "shadow-sales-dropdown"],
                  ["Popover", SALES_SHADOW.popover, "shadow-sales-popover"],
                  ["Modal", SALES_SHADOW.modal, "shadow-sales-modal"],
                ] as const
              ).map(([name, value, cls]) => (
                <div
                  key={name}
                  className={`rounded-sales-lg border border-sales-border bg-sales-surface p-4 ${cls}`}
                >
                  <p className="text-[13px] font-semibold">{name}</p>
                  <p className="mt-1 font-mono text-[10px] leading-snug text-sales-text-muted">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Buttons ────────────────────────────────────────── */}
          <Section
            id="buttons"
            title="Buttons"
            description="8px radius · 32 / 40 (44 touch) / 48 · lime primary, no glow. Hover / active rows use previewState (showcase only)."
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-sales-text-secondary">
                Validate both themes with the page toggle.
              </p>
              <SalesThemeToggle />
            </div>
            <div className="space-y-8">
              <ButtonShowcaseRow title="Primary">
                <PreviewCell label="Default">
                  <Button leftIcon={<Plus />}>Create deal</Button>
                </PreviewCell>
                <PreviewCell label="Hover preview">
                  <Button previewState="hover" leftIcon={<Plus />}>
                    Create deal
                  </Button>
                </PreviewCell>
                <PreviewCell label="Active preview">
                  <Button previewState="active" leftIcon={<Plus />}>
                    Create deal
                  </Button>
                </PreviewCell>
                <PreviewCell label="Disabled">
                  <Button disabled leftIcon={<Plus />}>
                    Create deal
                  </Button>
                </PreviewCell>
                <PreviewCell label="Loading">
                  <Button loading leftIcon={<Plus />}>
                    Create deal
                  </Button>
                </PreviewCell>
              </ButtonShowcaseRow>

              <ButtonShowcaseRow title="Secondary">
                <PreviewCell label="Default">
                  <Button variant="secondary">Cancel</Button>
                </PreviewCell>
                <PreviewCell label="Hover preview">
                  <Button variant="secondary" previewState="hover">
                    Cancel
                  </Button>
                </PreviewCell>
                <PreviewCell label="Active preview">
                  <Button variant="secondary" previewState="active">
                    Cancel
                  </Button>
                </PreviewCell>
                <PreviewCell label="Disabled">
                  <Button variant="secondary" disabled>
                    Cancel
                  </Button>
                </PreviewCell>
              </ButtonShowcaseRow>

              <ButtonShowcaseRow title="Ghost">
                <PreviewCell label="Default">
                  <Button variant="ghost">View details</Button>
                </PreviewCell>
                <PreviewCell label="Hover preview">
                  <Button variant="ghost" previewState="hover">
                    View details
                  </Button>
                </PreviewCell>
                <PreviewCell label="Active preview">
                  <Button variant="ghost" previewState="active">
                    View details
                  </Button>
                </PreviewCell>
              </ButtonShowcaseRow>

              <ButtonShowcaseRow title="Icon">
                <PreviewCell label="Default">
                  <IconButton aria-label="Search" size="md" icon={<Search strokeWidth={1.8} />} />
                </PreviewCell>
                <PreviewCell label="Hover">
                  <IconButton
                    aria-label="Search hover"
                    size="md"
                    previewState="hover"
                    icon={<Search strokeWidth={1.8} />}
                  />
                </PreviewCell>
                <PreviewCell label="Active">
                  <IconButton
                    aria-label="Search selected"
                    size="md"
                    previewState="active"
                    icon={<Search strokeWidth={1.8} />}
                  />
                </PreviewCell>
                <PreviewCell label="Selected">
                  <IconButton aria-label="Call" size="md" active icon={<Phone strokeWidth={1.8} />} />
                </PreviewCell>
              </ButtonShowcaseRow>

              <ButtonShowcaseRow title="Split button">
                <PreviewCell label="Default">
                  <SplitButton
                    label="Create deal"
                    leftIcon={<Plus />}
                    menuItems={[
                      { label: "Create deal", onClick: () => toast({ tone: "info", title: "Create deal" }) },
                      { label: "Create quote", onClick: () => toast({ tone: "info", title: "Create quote" }) },
                    ]}
                  />
                </PreviewCell>
                <PreviewCell label="Hover">
                  <SplitButton label="Create deal" leftIcon={<Plus />} previewState="hover" />
                </PreviewCell>
                <PreviewCell label="Active">
                  <SplitButton label="Create deal" leftIcon={<Plus />} previewState="active" />
                </PreviewCell>
              </ButtonShowcaseRow>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  Sizes · icons · semantic
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm">Small 32</Button>
                  <Button size="md">Medium 40</Button>
                  <Button size="lg">Large 48</Button>
                  <Button leftIcon={<Zap />} rightIcon={<Plus />}>
                    Quick actions
                  </Button>
                  <Button variant="danger">Delete</Button>
                  <Button variant="success">Mark won</Button>
                  <Button variant="link">Link action</Button>
                  <Tooltip label="More actions">
                    <IconButton aria-label="More">
                      <MoreHorizontal strokeWidth={1.8} />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Inputs & Search ────────────────────────────────── */}
          <Section
            id="inputs"
            title="02 — Inputs & Search"
            description="Quiet default · neutral hover · soft SegmiQ lime focus · danger wins when invalid. Hover/focus rows use previewState (showcase only)."
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-sales-text-secondary">
                Validate both themes with the page toggle. Desktop height 40 · touch 44 · text 16px on phones.
              </p>
              <SalesThemeToggle />
            </div>

            <div className="space-y-8">
              <ButtonShowcaseRow title="Search input">
                <PreviewCell label="Empty">
                  <div className="w-[280px]">
                    <SearchInput
                      value={q}
                      onChange={setQ}
                      placeholder="Search leads, deals, customers…"
                      shortcutHint
                    />
                  </div>
                </PreviewCell>
                <PreviewCell label="Focus preview">
                  <div className="w-[280px]">
                    <SearchInput
                      value=""
                      onChange={() => {}}
                      placeholder="Search leads, deals, customers…"
                      shortcutHint
                      previewState="focus"
                    />
                  </div>
                </PreviewCell>
                <PreviewCell label="With query">
                  <div className="w-[280px]">
                    <SearchInput
                      value={qFilled}
                      onChange={setQFilled}
                      onClear={() => setQFilled("")}
                      placeholder="Search leads, deals, customers…"
                      shortcutHint
                    />
                  </div>
                </PreviewCell>
                <PreviewCell label="Disabled">
                  <div className="w-[280px]">
                    <SearchInput
                      value=""
                      onChange={() => {}}
                      placeholder="Search leads, deals, customers…"
                      disabled
                    />
                  </div>
                </PreviewCell>
              </ButtonShowcaseRow>

              <ButtonShowcaseRow title="Text input">
                <PreviewCell label="Default">
                  <div className="w-[240px]">
                    <Input placeholder="Company name" />
                  </div>
                </PreviewCell>
                <PreviewCell label="Hover preview">
                  <div className="w-[240px]">
                    <Input placeholder="Company name" previewState="hover" />
                  </div>
                </PreviewCell>
                <PreviewCell label="Focused preview">
                  <div className="w-[240px]">
                    <Input placeholder="Company name" previewState="focus" />
                  </div>
                </PreviewCell>
                <PreviewCell label="Filled">
                  <div className="w-[240px]">
                    <Input defaultValue="Acme Energy" />
                  </div>
                </PreviewCell>
                <PreviewCell label="Invalid">
                  <div className="w-[240px]">
                    <Input invalid placeholder="This field is required" />
                  </div>
                </PreviewCell>
                <PreviewCell label="Disabled">
                  <div className="w-[240px]">
                    <Input disabled value="Read-only display value" readOnly />
                  </div>
                </PreviewCell>
              </ButtonShowcaseRow>

              <ButtonShowcaseRow title="Textarea">
                <PreviewCell label="Default">
                  <div className="w-[280px]">
                    <TextArea placeholder="Call summary…" rows={3} />
                  </div>
                </PreviewCell>
                <PreviewCell label="Filled">
                  <div className="w-[280px]">
                    <TextArea value={notesFilled} onChange={(e) => setNotesFilled(e.target.value)} rows={3} />
                  </div>
                </PreviewCell>
                <PreviewCell label="Invalid">
                  <div className="w-[280px]">
                    <TextArea invalid placeholder="Notes are required…" rows={3} />
                  </div>
                </PreviewCell>
              </ButtonShowcaseRow>

              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  Field text
                </p>
                <div className="grid max-w-xl gap-5">
                  <div>
                    <FieldLabel htmlFor="ds-name" required>
                      Customer name
                    </FieldLabel>
                    <Input id="ds-name" placeholder="Tendai Moyo" />
                    <FieldHint>This information will be visible to your team members.</FieldHint>
                  </div>
                  <div>
                    <FieldLabel htmlFor="ds-err">Email</FieldLabel>
                    <Input id="ds-err" invalid defaultValue="not-an-email" />
                    <FieldError>Enter a valid email address.</FieldError>
                  </div>
                  <div>
                    <FieldLabel htmlFor="ds-select">Lead source</FieldLabel>
                    <Select
                      id="ds-select"
                      value={selectVal}
                      onChange={(e) => setSelectVal(e.target.value)}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="facebook">Facebook</option>
                      <option value="website">Website</option>
                      <option value="referral">Referral</option>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Switch & Selectors ─────────────────────────────── */}
          <Section
            id="controls"
            title="03 — Switch & Selectors"
            description="Clear state, instant feedback, accessible by default. Neutral at rest · SegmiQ lime when on/selected · controlled focus."
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-sales-text-secondary">
                Validate both themes with the page toggle. Hover / focus rows use previewState (showcase only).
              </p>
              <SalesThemeToggle />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {/* 01 Switch */}
              <Card>
                <CardHeader>
                  <CardTitle>01 Switch</CardTitle>
                  <CardDescription>Binary on/off control.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ButtonShowcaseRow title="States">
                    <PreviewCell label="Off">
                      <Switch checked={false} onCheckedChange={() => {}} aria-label="Off" />
                    </PreviewCell>
                    <PreviewCell label="On">
                      <Switch checked={on} onCheckedChange={setOn} aria-label="On" />
                    </PreviewCell>
                    <PreviewCell label="Hover off">
                      <Switch checked={false} onCheckedChange={() => {}} aria-label="Hover off" previewState="hover" />
                    </PreviewCell>
                    <PreviewCell label="Hover on">
                      <Switch checked previewState="hover" onCheckedChange={() => {}} aria-label="Hover on" />
                    </PreviewCell>
                    <PreviewCell label="Focus">
                      <Switch checked={false} onCheckedChange={() => {}} aria-label="Focus" previewState="focus" />
                    </PreviewCell>
                    <PreviewCell label="Disabled off">
                      <Switch checked={false} onCheckedChange={() => {}} aria-label="Disabled off" disabled />
                    </PreviewCell>
                    <PreviewCell label="Disabled on">
                      <Switch checked onCheckedChange={() => {}} aria-label="Disabled on" disabled />
                    </PreviewCell>
                  </ButtonShowcaseRow>
                  <p className="text-[11px] text-sales-text-muted">
                    Usage: settings toggles. Behavior: role=switch · dark thumb on lime · ~44px touch target.
                  </p>
                </CardContent>
              </Card>

              {/* 02 Checkbox */}
              <Card>
                <CardHeader>
                  <CardTitle>02 Checkbox</CardTitle>
                  <CardDescription>Multi-select control.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ButtonShowcaseRow title="States">
                    <PreviewCell label="Unchecked">
                      <Checkbox checked={false} onCheckedChange={() => {}} aria-label="Unchecked" />
                    </PreviewCell>
                    <PreviewCell label="Checked">
                      <Checkbox checked={checked} onCheckedChange={setChecked} aria-label="Checked" />
                    </PreviewCell>
                    <PreviewCell label="Hover">
                      <Checkbox checked={false} onCheckedChange={() => {}} aria-label="Hover" previewState="hover" />
                    </PreviewCell>
                    <PreviewCell label="Checked hover">
                      <Checkbox checked onCheckedChange={() => {}} aria-label="Checked hover" previewState="hover" />
                    </PreviewCell>
                    <PreviewCell label="Focus">
                      <Checkbox checked={false} onCheckedChange={() => {}} aria-label="Focus" previewState="focus" />
                    </PreviewCell>
                    <PreviewCell label="Indeterminate">
                      <Checkbox
                        checked
                        indeterminate={indeterminateDemo}
                        onCheckedChange={() => {}}
                        aria-label="Indeterminate"
                      />
                    </PreviewCell>
                    <PreviewCell label="Disabled">
                      <Checkbox checked={false} onCheckedChange={() => {}} aria-label="Disabled" disabled />
                    </PreviewCell>
                    <PreviewCell label="Disabled checked">
                      <Checkbox checked onCheckedChange={() => {}} aria-label="Disabled checked" disabled />
                    </PreviewCell>
                  </ButtonShowcaseRow>
                  <Checkbox
                    id="ds-check-label"
                    checked={checked}
                    onCheckedChange={setChecked}
                    label="Include archived leads"
                  />
                  <p className="text-[11px] text-sales-text-muted">
                    Usage: multi-select lists. Behavior: 16×16 · 4px radius · dark check on lime · label toggles.
                  </p>
                </CardContent>
              </Card>

              {/* 03 Radio */}
              <Card>
                <CardHeader>
                  <CardTitle>03 Radio</CardTitle>
                  <CardDescription>Single-select from a group.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ButtonShowcaseRow title="States">
                    <PreviewCell label="Unselected">
                      <Radio name="ds-r-prev" value="u" checked={false} onChange={() => {}} aria-label="Unselected" id="ds-ru" />
                    </PreviewCell>
                    <PreviewCell label="Selected">
                      <Radio name="ds-r-prev2" value="s" checked onChange={() => {}} id="ds-rs" />
                    </PreviewCell>
                    <PreviewCell label="Hover">
                      <Radio name="ds-r-prev3" value="h" checked={false} onChange={() => {}} previewState="hover" id="ds-rh" />
                    </PreviewCell>
                    <PreviewCell label="Selected hover">
                      <Radio name="ds-r-prev4" value="sh" checked onChange={() => {}} previewState="hover" id="ds-rsh" />
                    </PreviewCell>
                    <PreviewCell label="Focus">
                      <Radio name="ds-r-prev5" value="f" checked={false} onChange={() => {}} previewState="focus" id="ds-rf" />
                    </PreviewCell>
                    <PreviewCell label="Disabled">
                      <Radio name="ds-r-prev6" value="d" checked={false} onChange={() => {}} disabled id="ds-rd" />
                    </PreviewCell>
                    <PreviewCell label="Disabled selected">
                      <Radio name="ds-r-prev7" value="ds" checked onChange={() => {}} disabled id="ds-rds" />
                    </PreviewCell>
                  </ButtonShowcaseRow>
                  <div className="flex flex-col gap-1">
                    <Radio
                      name="ds-radio"
                      value="a"
                      checked={radio === "a"}
                      onChange={() => setRadio("a")}
                      label="Assign to me"
                      id="ds-ra"
                    />
                    <Radio
                      name="ds-radio"
                      value="b"
                      checked={radio === "b"}
                      onChange={() => setRadio("b")}
                      label="Assign to pool"
                      id="ds-rb"
                    />
                  </div>
                  <p className="text-[11px] text-sales-text-muted">
                    Usage: one-of-many. Behavior: ring + 8px lime dot · native name grouping · focus ≠ selected.
                  </p>
                </CardContent>
              </Card>

              {/* 04 Segmented */}
              <Card>
                <CardHeader>
                  <CardTitle>04 Segmented Control</CardTitle>
                  <CardDescription>Switch between related views.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="mb-2 text-[11px] text-sales-text-muted">Default</p>
                    <SegmentedControl
                      aria-label="Period"
                      options={[
                        { value: "day", label: "Day" },
                        { value: "week", label: "Week" },
                        { value: "month", label: "Month" },
                      ]}
                      value={seg}
                      onChange={setSeg}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] text-sales-text-muted">Hover preview (Day)</p>
                    <SegmentedControl
                      aria-label="Period hover"
                      options={[
                        { value: "day", label: "Day" },
                        { value: "week", label: "Week" },
                        { value: "month", label: "Month" },
                      ]}
                      value="week"
                      onChange={() => {}}
                      previewHoverValue="day"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] text-sales-text-muted">With count</p>
                    <SegmentedControl
                      aria-label="Pipeline filter"
                      options={[
                        { value: "all", label: "All", badge: 120 },
                        { value: "open", label: "Open", badge: 82 },
                        { value: "won", label: "Won", badge: 68 },
                      ]}
                      value={segCount}
                      onChange={setSegCount}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] text-sales-text-muted">Icon + text</p>
                    <SegmentedControl
                      aria-label="View mode"
                      options={[
                        {
                          value: "day",
                          label: "Day",
                          icon: <CalendarDays strokeWidth={1.8} />,
                        },
                        {
                          value: "list",
                          label: "List",
                          icon: <LayoutList strokeWidth={1.8} />,
                        },
                      ]}
                      value={segIcon}
                      onChange={setSegIcon}
                    />
                  </div>
                  <p className="text-[11px] text-sales-text-muted">
                    Usage: local view/filter switching — not page Tabs. Behavior: recessed track · lime active
                    segment · radiogroup semantics · no label wrap.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                Page Tabs (unchanged — underline navigation)
              </p>
              <Card>
                <CardContent className="space-y-3 pt-4">
                  <Tabs
                    items={[
                      { id: "overview", label: "Overview" },
                      { id: "activity", label: "Activity" },
                      { id: "quotes", label: "Quotes" },
                    ]}
                    value={tab}
                    onChange={setTab}
                  />
                  <p className="text-[12px] text-sales-text-secondary">
                    Active tab: <span className="font-semibold text-sales-text-primary">{tab}</span>
                    {" · "}
                    Not part of Switch & Selectors — Company page navigation stays underline Tabs.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ── Badges ─────────────────────────────────────────── */}
          <Section id="badges" title="Badges & status" description="Soft / outline / solid · stages · intent · dots.">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">Appearances</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "neutral",
                      "brand",
                      "success",
                      "warning",
                      "danger",
                      "info",
                      "purple",
                    ] as const
                  ).map((tone) => (
                    <Badge key={`soft-${tone}`} tone={tone}>
                      Soft {tone}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    ["neutral", "brand", "success", "warning", "danger", "info", "purple"] as const
                  ).map((tone) => (
                    <Badge key={`out-${tone}`} tone={tone} appearance="outline">
                      Outline {tone}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    ["neutral", "brand", "success", "warning", "danger", "info", "purple"] as const
                  ).map((tone) => (
                    <Badge key={`sol-${tone}`} tone={tone} appearance="solid">
                      Solid {tone}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">Pipeline stages</p>
                <div className="flex flex-wrap gap-2">
                  <PipelineStageBadge status="NEW" label="New" />
                  <PipelineStageBadge status="CONTACTED" label="Contacted" />
                  <PipelineStageBadge status="NEGOTIATING" label="Negotiating" />
                  <PipelineStageBadge status="PROPOSAL_SENT" label="Proposal sent" />
                  <PipelineStageBadge status="WON" label="Won" />
                  <PipelineStageBadge status="LOST" label="Lost" />
                  <PipelineStageBadge status="NOT_QUALIFIED" label="Not qualified" />
                </div>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">
                  Intent · Hot ≥70 · Warm 45–69 · Cold &lt;45 (blue)
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <LeadScoreBadge score={82} />
                  <LeadScoreBadge score={55} />
                  <LeadScoreBadge score={30} />
                  <MetaPill>WhatsApp</MetaPill>
                  <MetaPill>Website</MetaPill>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">Status dots</p>
                <div className="flex flex-wrap items-center gap-4 text-[12px] text-sales-text-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone="success" label="Online" /> Online
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone="busy" label="Busy" /> Busy
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone="away" label="Away" /> Away
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone="offline" label="Offline" /> Offline
                  </span>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Cards ──────────────────────────────────────────── */}
          <Section id="cards" title="Cards & KPIs" description="Standard · selected · attention · KPI pattern.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiStat
                item={{
                  id: "pipeline",
                  label: "Pipeline value",
                  value: "$118,450",
                  supporting: "vs last 30 days",
                  icon: "pipeline",
                  trend: { direction: "up", label: "18%" },
                }}
              />
              <KpiStat
                item={{
                  id: "won",
                  label: "Won this month",
                  value: "12",
                  supporting: "Closed deals",
                  icon: "won",
                  trend: { direction: "up", label: "3 vs last month" },
                }}
              />
              <KpiStat
                item={{
                  id: "followups",
                  label: "Follow-ups due",
                  value: "18",
                  supporting: "Needs attention",
                  icon: "followups",
                  trend: { direction: "alert", label: "Overdue" },
                }}
              />
              <Card variant="attention">
                <CardContent>
                  <p className="text-[12px] font-medium text-sales-danger">Attention</p>
                  <MetricValue value="18" className="mt-2" />
                  <p className="mt-2 text-[12px] text-sales-text-secondary">Overdue follow-ups</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Standard</CardTitle>
                  <CardDescription>Default surface card</CardDescription>
                </CardHeader>
                <CardContent>
                  <LeadIdentity name="Sipho Khumalo" secondary="Solar install · Harare" />
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="secondary">
                    View
                  </Button>
                  <Button size="sm" leftIcon={<Phone size={14} />}>
                    Call
                  </Button>
                </CardFooter>
              </Card>
              <Card variant="selected">
                <CardContent>
                  <p className="mb-3 text-[12px] font-medium text-sales-brand-fg">Selected</p>
                  <LeadIdentity name="Amina Diallo" secondary="Quote sent" />
                  <div className="mt-4">
                    <Trend direction="up" label="Score 74" />
                  </div>
                </CardContent>
              </Card>
              <Card variant="interactive">
                <CardContent>
                  <p className="mb-3 text-[12px] font-medium text-sales-text-secondary">Interactive</p>
                  <div className="flex items-center gap-3">
                    <Avatar name="Tendai Moyo" />
                    <div>
                      <p className="text-[13px] font-semibold">Tendai Moyo</p>
                      <p className="text-[12px] text-sales-text-secondary">Hover for border lift</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ── Table ──────────────────────────────────────────── */}
          <Section id="table" title="Table" description="Lead list pattern with avatars, stages, and values.">
            <DataTable>
              <DataTableEl>
                <DataTableHead>
                  <tr>
                    <DataTableTh>Customer</DataTableTh>
                    <DataTableTh>Project</DataTableTh>
                    <DataTableTh>Stage</DataTableTh>
                    <DataTableTh>Value</DataTableTh>
                    <DataTableTh>Last activity</DataTableTh>
                    <DataTableTh className="w-12" />
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {[
                    {
                      name: "Sipho Khumalo",
                      project: "Roof solar 5kW",
                      stage: "NEGOTIATING",
                      stageLabel: "Negotiating",
                      value: "$4,200",
                      activity: "2h ago",
                    },
                    {
                      name: "Amina Diallo",
                      project: "Inverter upgrade",
                      stage: "PROPOSAL_SENT",
                      stageLabel: "Proposal sent",
                      value: "$1,850",
                      activity: "Yesterday",
                    },
                    {
                      name: "Joe Ncube",
                      project: "Battery pack",
                      stage: "CONTACTED",
                      stageLabel: "Contacted",
                      value: "$980",
                      activity: "3d ago",
                    },
                    {
                      name: "Lindiwe Moyo",
                      project: "Full home backup",
                      stage: "WON",
                      stageLabel: "Won",
                      value: "$12,400",
                      activity: "1w ago",
                    },
                  ].map((row) => (
                    <DataTableRow key={row.name}>
                      <DataTableTd>
                        <LeadIdentity name={row.name} size="sm" />
                      </DataTableTd>
                      <DataTableTd className="text-sales-text-secondary">{row.project}</DataTableTd>
                      <DataTableTd>
                        <PipelineStageBadge status={row.stage} label={row.stageLabel} />
                      </DataTableTd>
                      <DataTableTd>
                        <span className="font-semibold tabular-nums">{row.value}</span>
                      </DataTableTd>
                      <DataTableTd className="text-sales-text-muted">{row.activity}</DataTableTd>
                      <DataTableTd>
                        <IconButton aria-label={`Actions for ${row.name}`} size="sm">
                          <MoreHorizontal strokeWidth={1.8} />
                        </IconButton>
                      </DataTableTd>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTableEl>
            </DataTable>
          </Section>

          {/* ── Timeline ───────────────────────────────────────── */}
          <Section id="timeline" title="Timeline" description="Milestones, activity feed, and event list.">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Pipeline milestone</CardTitle>
                </CardHeader>
                <CardContent>
                  <Milestone
                    steps={["New", "Contacted", "Negotiating", "Proposal sent", "Won"]}
                    currentIndex={2}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Event timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <Timeline
                    items={[
                      {
                        id: "1",
                        title: "Call logged",
                        description: "Reached — follow-up scheduled for Thursday",
                        timeLabel: "10:42 AM",
                        tone: "brand",
                      },
                      {
                        id: "2",
                        title: "WhatsApp message sent",
                        description: "Shared quote PDF",
                        timeLabel: "Yesterday",
                        tone: "success",
                      },
                      {
                        id: "3",
                        title: "Follow-up overdue",
                        description: "No reply within 48h",
                        timeLabel: "Mon",
                        tone: "danger",
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Activity rows</CardTitle>
              </CardHeader>
              <div className="divide-y divide-sales-border-subtle">
                <ActivityRow
                  icon={<BrandIcon brand="whatsapp" size={16} />}
                  title="WhatsApp reply from Sipho"
                  detail="Asked about deposit terms"
                  timeLabel="12m"
                />
                <ActivityRow
                  icon={<Phone size={16} className="text-sales-text-secondary" strokeWidth={1.8} />}
                  title="Outbound call · 4m 12s"
                  detail="Left voicemail"
                  timeLabel="1h"
                />
              </div>
            </Card>
          </Section>

          {/* ── Charts ─────────────────────────────────────────── */}
          <Section id="charts" title="Charts" description="Area, bar, and donut wrappers on Recharts.">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>Area · brand fill</CardDescription>
                </CardHeader>
                <CardContent className="h-44">
                  <SalesAreaChart
                    data={[
                      { label: "W1", value: 12000 },
                      { label: "W2", value: 18000 },
                      { label: "W3", value: 15000 },
                      { label: "W4", value: 24800 },
                      { label: "W5", value: 22100 },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Leads created</CardTitle>
                  <CardDescription>Bar · info series</CardDescription>
                </CardHeader>
                <CardContent className="h-44">
                  <SalesBarChart
                    data={[
                      { label: "Mon", value: 8 },
                      { label: "Tue", value: 14 },
                      { label: "Wed", value: 11 },
                      { label: "Thu", value: 19 },
                      { label: "Fri", value: 12 },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>By source</CardTitle>
                  <CardDescription>Donut</CardDescription>
                </CardHeader>
                <CardContent className="h-44">
                  <SalesDonutChart
                    data={[
                      { name: "WhatsApp", value: 42 },
                      { name: "Facebook", value: 18 },
                      { name: "Referral", value: 12 },
                      { name: "Website", value: 8 },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ── Feedback ───────────────────────────────────────── */}
          <Section id="feedback" title="Alerts & toasts" description="Left-accent alerts · toast triggers.">
            <div className="space-y-3">
              <Alert tone="success" icon={<CheckCircle2 size={18} strokeWidth={1.8} />} title="Quote sent">
                Customer received the PDF via WhatsApp.
              </Alert>
              <Alert tone="warning" icon={<AlertTriangle size={18} strokeWidth={1.8} />} title="18 overdue follow-ups">
                Some scheduled follow-ups need attention today.
              </Alert>
              <Alert tone="danger" icon={<XCircle size={18} strokeWidth={1.8} />} title="Couldn't send message">
                Check your WhatsApp connection and try again.
              </Alert>
              <Alert tone="info" icon={<Info size={18} strokeWidth={1.8} />} title="New Facebook leads synced">
                4 leads were added to your pipeline in the last hour.
              </Alert>
              <Alert tone="brand" title="Tip">
                Lime accent alert for product guidance — use sparingly.
              </Alert>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => toast({ tone: "success", title: "Follow-up scheduled" })}
              >
                Toast success
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast({
                    tone: "error",
                    title: "Couldn't send WhatsApp message",
                    description: "Check your connection and try again.",
                  })
                }
              >
                Toast error
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast({ tone: "warning", title: "Follow-up due in 15 minutes" })}
              >
                Toast warning
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast({ tone: "info", title: "Quote sent", description: "PDF delivered." })}
              >
                Toast info
              </Button>
            </div>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <Card>
                <EmptyState
                  title="No picks yet"
                  description="Save a promising lead during a follow-up and it will appear here."
                  size="compact"
                  action={
                    <Button size="sm" variant="secondary">
                      Browse pipeline
                    </Button>
                  }
                />
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Skeleton loading</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ── Misc ───────────────────────────────────────────── */}
          <Section id="misc" title="Icons & misc" description="Lucide for UI · BrandIcon for WhatsApp/Facebook.">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-[13px]">
                <BrandIcon brand="whatsapp" size={22} />
                WhatsApp
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <BrandIcon brand="facebook" size={22} />
                Facebook
              </div>
              <div className="flex items-center gap-2 text-[13px] text-sales-text-secondary">
                <Phone size={20} strokeWidth={1.8} />
                Lucide phone
              </div>
              <div className="flex items-center gap-2 text-[13px] text-sales-text-secondary">
                <Search size={20} strokeWidth={1.8} />
                Lucide search
              </div>
              <Avatar name="SegmiQ Sales" />
              <Avatar name="A B" size="sm" />
            </div>
            <p className="text-[12px] text-sales-text-muted">
              Route: <code className="rounded bg-[#F2F4F7] px-1.5 py-0.5">/dev/sales-design-system</code>
              {" · "}
              Primitives: <code className="rounded bg-[#F2F4F7] px-1.5 py-0.5">@/components/sales/ui</code>
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

export function SalesDesignSystemClient() {
  return (
    <ToastProvider>
      <ShowcaseInner />
    </ToastProvider>
  );
}
