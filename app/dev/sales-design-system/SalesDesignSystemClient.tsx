"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Columns3,
  Copy,
  Edit,
  Ellipsis,
  Filter,
  FileText,
  Inbox,
  Info,
  LayoutDashboard,
  LayoutList,
  ListTodo,
  MessageCircle,
  MoreHorizontal,
  PanelLeftClose,
  Phone,
  Plus,
  Search,
  Settings,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import {
  ActiveFiltersBar,
  ActivityRow,
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
  CompanyIdentity,
  DataTable,
  DataTableActionsCell,
  DataTableBody,
  DataTableCheckboxCell,
  DataTableEl,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableMobileItem,
  DataTableMobileList,
  DataTablePagination,
  DataTableRow,
  DataTableScroll,
  DataTableSelectionBar,
  DataTableSkeleton,
  DataTableSortableTh,
  DataTableTd,
  DataTableTh,
  DataTableToolbar,
  DataTableToolbarGroup,
  DataTableWorkspace,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EntityTypeBadge,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  FilterPill,
  FormActions,
  FormFields,
  FormSection,
  GroupAvatars,
  GroupedInput,
  IconButton,
  InputAddon,
  InputGroup,
  InputGroupAction,
  InputGroupButton,
  SplitButton,
  Input,
  KpiStat,
  LeadIdentity,
  LeadScoreBadge,
  LeadScoreGauge,
  MetaPill,
  MetricValue,
  MenuSelect,
  Milestone,
  PipelineStageBadge,
  PresenceIndicator,
  Progress,
  QuotationStatusBadge,
  Radio,
  SalesAreaChart,
  SalesBarChart,
  SalesDonutChart,
  SalesFunnelChart,
  SalesHeatmap,
  SalesLineChart,
  SalesSparkline,
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
  UserIdentity,
  useSalesToast,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  InfoState,
  InlineAlert,
  InlineLoading,
  LoadingState,
  Modal,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SuccessState,
  Stepper,
} from "@/components/sales/ui";
import {
  SALES_CHART,
  SALES_CHART_SEMANTIC,
  SALES_COLORS,
  SALES_FEEDBACK,
  SALES_FIELD_HEIGHT,
  SALES_FORM,
  SALES_LAYOUT,
  SALES_MENU,
  SALES_OVERLAY,
  SALES_RADIUS,
  SALES_SHADOW,
  SALES_TABLE,
  PIPELINE_STAGE_COLORS,
} from "@/lib/sales/design-tokens";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { SalesBreadcrumbs } from "@/components/sales/navigation/SalesBreadcrumbs";
import { SalesPageHeader } from "@/components/sales/shell/SalesAppShell";
import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { cn } from "@/lib/ui/cn";

const NAV = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing & elevation" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs & Search" },
  { id: "controls", label: "Switch & Selectors" },
  { id: "badges", label: "Tabs, Badges & Status" },
  { id: "cards", label: "Cards" },
  { id: "table", label: "15 — Tables & Data" },
  { id: "overlays", label: "14 — Overlays & Feedback" },
  { id: "forms", label: "08 — Forms & Inputs" },
  { id: "menus", label: "09 — Menus & Pills" },
  { id: "navigation", label: "10 — Navigation & Layout" },
  { id: "timeline", label: "16 — Timeline & Activity" },
  { id: "identity", label: "17 — Avatars & Identity" },
  { id: "charts", label: "11 — Charts & Data Viz" },
  { id: "states", label: "12 — Empty States & Feedback" },
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

function TablesShowcaseSection() {
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(["2"]));
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | "none">("asc");
  const [page, setPage] = useState(2);
  const [previewHoverId, setPreviewHoverId] = useState<string | null>("3");

  const demoRows = [
    {
      id: "1",
      name: "Tafadzwa Moyo",
      company: "SunGrid Installations",
      score: 82,
      stage: "NEGOTIATING",
      stageLabel: "Negotiating",
      owner: "Sarah N.",
    },
    {
      id: "2",
      name: "Amina Diallo",
      company: "GreenHome Energy",
      score: 58,
      stage: "PROPOSAL_SENT",
      stageLabel: "Proposal sent",
      owner: "James K.",
    },
    {
      id: "3",
      name: "Joe Ncube",
      company: "Backup Power Co.",
      score: 21,
      stage: "CONTACTED",
      stageLabel: "Contacted",
      owner: "Unassigned",
    },
    {
      id: "4",
      name: "Lindiwe Moyo",
      company: "EcoBuild Projects",
      score: 74,
      stage: "NEW",
      stageLabel: "New",
      owner: "Sarah N.",
    },
  ];

  const allChecked = demoRows.length > 0 && demoRows.every((row) => checkedIds.has(row.id));
  const someChecked = demoRows.some((row) => checkedIds.has(row.id));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-sales-text-secondary">
          Extends Phase 06 foundation — four systems for scan, filter, act, and bulk workflows. Documentation data only.
        </p>
        <SalesThemeToggle />
      </div>

      <Card variant="flat">
        <CardHeader>
          <CardTitle className="text-[14px]">Four systems</CardTitle>
          <CardDescription>Phase 06 visual foundation · Phase 15 operational capability</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-[12px] text-sales-text-secondary">
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">1 · Default table</p>
            <p className="mt-1">Shell · columns · identity · status · pagination</p>
          </div>
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">2 · Sort & filter</p>
            <p className="mt-1">SearchInput · sort headers · filter popover · pills</p>
          </div>
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">3 · Row actions</p>
            <p className="mt-1">Ellipsis menu · domain actions only · danger separated</p>
          </div>
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">4 · Selection & bulk</p>
            <p className="mt-1">Checkboxes · selection bar · real bulk mutations only</p>
          </div>
        </CardContent>
      </Card>

      {/* 01 Default */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          01 Default table
        </p>
        <p className="mb-3 text-[12px] text-sales-text-secondary">
          One bordered workspace · 12px radius · subtle header · 52px rows · no zebra stripes.
        </p>
        <DataTable>
          <DataTableEl>
            <DataTableHead>
              <tr>
                <DataTableTh>Lead</DataTableTh>
                <DataTableTh>Company</DataTableTh>
                <DataTableTh>Score</DataTableTh>
                <DataTableTh>Stage</DataTableTh>
                <DataTableTh>Owner</DataTableTh>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {demoRows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableTd>
                    <LeadIdentity name={row.name} size="sm" />
                  </DataTableTd>
                  <DataTableTd className="text-sales-text-secondary">{row.company}</DataTableTd>
                  <DataTableTd>
                    <LeadScoreBadge score={row.score} />
                  </DataTableTd>
                  <DataTableTd>
                    <PipelineStageBadge status={row.stage} label={row.stageLabel} />
                  </DataTableTd>
                  <DataTableTd className="text-[12px] text-sales-text-secondary">{row.owner}</DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableEl>
        </DataTable>
      </div>

      {/* 02 Toolbar */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          02 Table with toolbar
        </p>
        <p className="mb-3 text-[12px] text-sales-text-secondary">
          Search · filters · primary action · overflow — all inside the same table card.
        </p>
        <DataTableWorkspace>
          <DataTableToolbar>
            <DataTableToolbarGroup>
              <SearchInput
                value=""
                onChange={() => undefined}
                placeholder="Search leads…"
                className="w-full sm:w-[280px]"
                disabled
              />
              <Button variant="secondary" size="sm" leftIcon={<Filter size={14} />}>
                Filters
              </Button>
            </DataTableToolbarGroup>
            <DataTableToolbarGroup align="end">
              <Button size="sm" leftIcon={<Plus size={14} />}>
                New lead
              </Button>
              <IconButton aria-label="More table actions" size="sm">
                <MoreHorizontal strokeWidth={1.8} />
              </IconButton>
            </DataTableToolbarGroup>
          </DataTableToolbar>
          <DataTableScroll>
            <DataTableEl>
              <DataTableHead>
                <tr>
                  <DataTableTh>Lead</DataTableTh>
                  <DataTableTh>Company</DataTableTh>
                  <DataTableTh>Stage</DataTableTh>
                  <DataTableTh className="w-12" />
                </tr>
              </DataTableHead>
              <DataTableBody>
                {demoRows.slice(0, 3).map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableTd>
                      <LeadIdentity name={row.name} secondary={row.company} size="sm" />
                    </DataTableTd>
                    <DataTableTd className="text-sales-text-secondary">{row.company}</DataTableTd>
                    <DataTableTd>
                      <PipelineStageBadge status={row.stage} label={row.stageLabel} />
                    </DataTableTd>
                    <DataTableActionsCell>
                      <IconButton aria-label={`Actions for ${row.name}`} size="sm">
                        <MoreHorizontal strokeWidth={1.8} />
                      </IconButton>
                    </DataTableActionsCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTableScroll>
        </DataTableWorkspace>
      </div>

      {/* 03 Sort + hover */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          03 Sorted + hover
        </p>
        <p className="mb-3 text-[12px] text-sales-text-secondary">
          Sort affordance on meaningful columns only · hover wash stays barely visible.
        </p>
        <DataTable>
          <DataTableEl>
            <DataTableHead>
              <tr>
                <DataTableSortableTh
                  label="Lead"
                  sortDirection={sortDirection}
                  onSort={() =>
                    setSortDirection((current) =>
                      current === "asc" ? "desc" : current === "desc" ? "none" : "asc"
                    )
                  }
                />
                <DataTableTh>Company</DataTableTh>
                <DataTableTh>Score</DataTableTh>
                <DataTableTh>Stage</DataTableTh>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {demoRows.map((row) => (
                <DataTableRow
                  key={row.id}
                  className={previewHoverId === row.id ? "bg-[var(--sales-table-hover)]" : undefined}
                  onMouseEnter={() => setPreviewHoverId(row.id)}
                  onMouseLeave={() => setPreviewHoverId(null)}
                >
                  <DataTableTd>
                    <LeadIdentity name={row.name} size="sm" />
                  </DataTableTd>
                  <DataTableTd className="text-sales-text-secondary">{row.company}</DataTableTd>
                  <DataTableTd>
                    <LeadScoreBadge score={row.score} />
                  </DataTableTd>
                  <DataTableTd>
                    <PipelineStageBadge status={row.stage} label={row.stageLabel} />
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableEl>
        </DataTable>
      </div>

      {/* 04 Selected + bulk bar */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          04 Selection & bulk actions
        </p>
        <p className="mb-3 text-[12px] text-sales-text-secondary">
          Soft lime row wash · DataTableSelectionBar · bulk actions only where backend supports them.
        </p>
        <DataTableWorkspace>
          {checkedIds.size > 0 ? (
            <DataTableSelectionBar
              count={checkedIds.size}
              onClear={() => setCheckedIds(new Set())}
            >
              <Button variant="secondary" size="sm">
                Assign owner
              </Button>
            </DataTableSelectionBar>
          ) : null}
          <DataTableScroll>
            <DataTableEl>
            <DataTableHead>
              <tr>
                <DataTableTh compact className="w-11">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={!allChecked && someChecked}
                    aria-label="Select all rows"
                    onCheckedChange={(checked) =>
                      setCheckedIds(checked ? new Set(demoRows.map((row) => row.id)) : new Set())
                    }
                  />
                </DataTableTh>
                <DataTableTh>Lead</DataTableTh>
                <DataTableTh>Score</DataTableTh>
                <DataTableTh>Stage</DataTableTh>
                <DataTableTh className="w-12" />
              </tr>
            </DataTableHead>
            <DataTableBody>
              {demoRows.map((row) => (
                <DataTableRow
                  key={row.id}
                  selected={selectedLead === row.id}
                  clickable
                  onClick={() => setSelectedLead(row.id)}
                >
                  <DataTableCheckboxCell compact>
                    <Checkbox
                      checked={checkedIds.has(row.id)}
                      aria-label={`Select ${row.name}`}
                      onCheckedChange={(checked) =>
                        setCheckedIds((previous) => {
                          const next = new Set(previous);
                          if (checked) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        })
                      }
                    />
                  </DataTableCheckboxCell>
                  <DataTableTd>
                    <LeadIdentity name={row.name} size="sm" />
                  </DataTableTd>
                  <DataTableTd>
                    <LeadScoreBadge score={row.score} />
                  </DataTableTd>
                  <DataTableTd>
                    <PipelineStageBadge status={row.stage} label={row.stageLabel} />
                  </DataTableTd>
                  <DataTableActionsCell>
                    <IconButton aria-label={`Actions for ${row.name}`} size="sm">
                      <MoreHorizontal strokeWidth={1.8} />
                    </IconButton>
                  </DataTableActionsCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTableEl>
          </DataTableScroll>
        </DataTableWorkspace>
      </div>

      {/* 05 Pagination */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          05 Pagination
        </p>
        <p className="mb-3 text-[12px] text-sales-text-secondary">
          Footer lives inside the table card · active page uses SegmiQ lime · mobile simplifies to Page X of Y.
        </p>
        <DataTableWorkspace>
          <DataTableScroll>
            <DataTableEl>
              <DataTableHead>
                <tr>
                  <DataTableTh>Lead</DataTableTh>
                  <DataTableTh>Company</DataTableTh>
                  <DataTableTh>Stage</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {demoRows.slice(0, 2).map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableTd>{row.name}</DataTableTd>
                    <DataTableTd className="text-sales-text-secondary">{row.company}</DataTableTd>
                    <DataTableTd>
                      <PipelineStageBadge status={row.stage} label={row.stageLabel} />
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTableScroll>
          <DataTableFooter>
            <DataTablePagination
              page={page}
              pageCount={18}
              onPageChange={setPage}
              summary="Showing 11–20 of 180 results"
              pageSizeControl={
                <Button variant="secondary" size="sm">
                  10 / page
                </Button>
              }
            />
          </DataTableFooter>
        </DataTableWorkspace>
      </div>

      {/* States + anatomy */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card variant="flat">
          <CardContent className="space-y-3 pt-4 text-[12px] text-sales-text-secondary">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Table anatomy
            </p>
            <ul className="space-y-1.5 leading-relaxed">
              <li>Toolbar · table head · row · cell · footer · actions menu · pagination</li>
              <li>Row height: {SALES_TABLE.rowHeight}px default · {SALES_TABLE.rowHeightComfortable}px comfortable</li>
              <li>Header: {SALES_TABLE.headerHeight}px · cell padding {SALES_TABLE.cellXCompact}–{SALES_TABLE.cellX}px</li>
              <li>Container radius: {SALES_TABLE.radius}px · checkbox 16px · sort icon 12–14px</li>
            </ul>
          </CardContent>
        </Card>
        <Card variant="flat">
          <CardContent className="space-y-4 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              States
            </p>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-[11px] text-sales-text-muted">Loading</p>
                <DataTable>
                  <DataTableEl>
                    <DataTableHead>
                      <tr>
                        <DataTableTh>Lead</DataTableTh>
                        <DataTableTh>Stage</DataTableTh>
                        <DataTableTh>Owner</DataTableTh>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      <DataTableSkeleton columns={3} rows={4} />
                    </DataTableBody>
                  </DataTableEl>
                </DataTable>
              </div>
              <div>
                <p className="mb-2 text-[11px] text-sales-text-muted">Empty</p>
                <DataTable>
                  <DataTableEl>
                    <DataTableHead>
                      <tr>
                        <DataTableTh>Lead</DataTableTh>
                        <DataTableTh>Stage</DataTableTh>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      <DataTableEmpty
                        colSpan={2}
                        title="No leads found"
                        description="Adjust your filters or add a lead."
                      />
                    </DataTableBody>
                  </DataTableEl>
                </DataTable>
              </div>
              <div>
                <p className="mb-2 text-[11px] text-sales-text-muted">Mobile cards</p>
                <DataTableMobileList className="!block rounded-sales-lg border border-sales-border bg-sales-surface p-0 lg:!hidden">
                  {demoRows.slice(0, 2).map((row) => (
                    <DataTableMobileItem key={row.id} selected={selectedLead === row.id} onClick={() => setSelectedLead(row.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <LeadIdentity name={row.name} secondary={row.company} size="sm" />
                        <LeadScoreBadge score={row.score} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <PipelineStageBadge status={row.stage} label={row.stageLabel} />
                        <MetaPill>WhatsApp</MetaPill>
                      </div>
                    </DataTableMobileItem>
                  ))}
                </DataTableMobileList>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="flat">
        <CardContent className="space-y-2 pt-4 text-[12px] leading-relaxed text-sales-text-secondary">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Best practices
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Keep column count scannable · sort meaningful lists · reuse semantic badges</li>
            <li>Never color whole rows by pipeline status · selected wash is the exception</li>
            <li>Use detail panels for long content · mobile converts to stacked cards, not squeezed tables</li>
            <li>Do not auto-select the first record · preserve server pagination and existing actions only</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function OverlaysShowcaseSection() {
  const { toast } = useSalesToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const stepperSteps = [
    { id: "details", label: "Details", status: "completed" as const },
    { id: "review", label: "Review", status: "current" as const },
    { id: "complete", label: "Complete", status: "upcoming" as const },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-sales-text-secondary">
          Four production systems — blocking overlays · contextual overlays · feedback messaging · process feedback.
          Showcase examples are documentation only.
        </p>
        <SalesThemeToggle />
      </div>

      <Card variant="flat">
        <CardHeader>
          <CardTitle className="text-[14px]">Architecture</CardTitle>
          <CardDescription>Do not duplicate Phase 12 states or Phase 01 buttons</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-[12px] text-sales-text-secondary">
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">1 · Blocking</p>
            <p className="mt-1">Modal · ConfirmDialog — must stop and decide</p>
          </div>
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">2 · Contextual</p>
            <p className="mt-1">PremiumSheet · Popover · Tooltip — extra context</p>
          </div>
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">3 · Messaging</p>
            <p className="mt-1">Toast · InlineAlert · FieldError — what happened</p>
          </div>
          <div className="rounded-[10px] border border-sales-border-subtle p-3">
            <p className="font-semibold text-sales-text-primary">4 · Process</p>
            <p className="mt-1">Stepper · InlineLoading · Phase 12 states</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Modal</CardTitle>
            <CardDescription>Focused task · desktop centered · phone bottom sheet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-modal">
              <div className="flex items-start justify-between gap-2 border-b border-sales-border-subtle pb-3">
                <div>
                  <p className="text-[16px] font-semibold">Configure settings</p>
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                    Update defaults for your workspace.
                  </p>
                </div>
                <span className="text-sales-text-muted">×</span>
              </div>
              <div className="py-4 text-[12px] text-sales-text-secondary">Scrollable body content</div>
              <div className="flex justify-end gap-2 border-t border-sales-border-subtle pt-3">
                <Button size="sm" variant="secondary">
                  Cancel
                </Button>
                <Button size="sm">Save</Button>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setDeleteOpen(true)}>
              Open destructive confirm
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
              Open live modal
            </Button>
            <p className="text-[11px] text-sales-text-muted">Widths: 420 · 520 · 680 · overlay z~80</p>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Drawer / sheet</CardTitle>
            <CardDescription>Contextual record detail · no invented global drawer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface-subtle">
              <div className="flex h-[220px]">
                <div className="hidden flex-1 bg-sales-bg-subtle p-3 text-[11px] text-sales-text-muted sm:block">
                  Workspace remains visible
                </div>
                <div className="flex w-full max-w-[180px] flex-col border-l border-sales-border bg-sales-surface shadow-sales-modal">
                  <div className="border-b border-sales-border-subtle px-3 py-2.5">
                    <p className="text-[13px] font-semibold">Record detail</p>
                    <p className="text-[11px] text-sales-text-secondary">Secondary context</p>
                  </div>
                  <div className="flex gap-2 border-b border-sales-border-subtle px-2 py-2">
                    <span className="border-b-2 border-sales-brand px-2 py-1 text-[11px] font-medium">
                      Overview
                    </span>
                    <span className="px-2 py-1 text-[11px] text-sales-text-muted">Activity</span>
                  </div>
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-sales-text-muted">
              Desktop: right panel · mobile: full-height / bottom sheet · backdrop only when modal
            </p>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Toast</CardTitle>
            <CardDescription>Brief · top-right · ~{SALES_OVERLAY.toastDurationMs / 1000}s default</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(
              [
                ["success", "Saved", "Changes stored successfully."],
                ["info", "Sync complete", "Latest data is available."],
                ["warning", "Follow-up due", "Scheduled action needs attention."],
                ["error", "Action failed", "Try again or check your connection."],
              ] as const
            ).map(([tone, title, detail]) => (
              <div
                key={tone}
                className={cn(
                  "flex gap-2 rounded-[11px] border border-sales-border border-l-[3px] p-2.5",
                  tone === "success" && "border-l-sales-success bg-sales-success-soft/35",
                  tone === "info" && "border-l-sales-info bg-sales-info-soft/35",
                  tone === "warning" && "border-l-sales-warning bg-sales-warning-soft/35",
                  tone === "error" && "border-l-sales-danger bg-sales-danger-soft/35"
                )}
              >
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current opacity-70" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold">{title}</p>
                  <p className="text-[11px] text-sales-text-secondary">{detail}</p>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="secondary" onClick={() => toast({ tone: "success", title: "Saved" })}>
                Trigger
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toast({ tone: "error", title: "Action failed", description: "Try again." })}
              >
                Error
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Inline alert</CardTitle>
            <CardDescription>Persistent · soft fill · {SALES_FEEDBACK.alertAccentWidth}px accent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <InlineAlert tone="success" compact title="Data saved" />
            <InlineAlert tone="warning" compact title="Follow-up overdue" />
            <InlineAlert
              tone="info"
              compact
              title="Integration not connected"
              action={
                <Button size="sm" variant="secondary">
                  Connect
                </Button>
              }
            />
            <InlineAlert tone="danger" compact title="Payment failed" />
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Popover</CardTitle>
            <CardDescription>Portalled contextual content · not a menu</CardDescription>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger className="rounded-[8px] border border-sales-border bg-sales-surface px-3 py-2 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-subtle">
                View lead summary
              </PopoverTrigger>
              <PopoverContent className="w-[260px]">
                <p className="text-[13px] font-semibold text-sales-text-primary">Lead summary</p>
                <p className="mt-1 text-[12px] leading-relaxed text-sales-text-secondary">
                  Rich contextual detail tied to the trigger. Escape or click outside closes.
                </p>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Progress & loading</CardTitle>
            <CardDescription>Stepper · inline loading · skeleton</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Stepper steps={stepperSteps} />
            <Progress value={65} showValue label="Pipeline health" />
            <InlineLoading label="Saving changes…" />
            <div className="space-y-2 rounded-[10px] border border-sales-border-subtle p-3">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-8 w-full" />
            </div>
            <p className="text-[11px] text-sales-text-muted">
              Stepper is documentation-only until wired to real multi-step workflows
            </p>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Tooltip</CardTitle>
            <CardDescription>Short help · dark neutral · no controls</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Tooltip label="Lead score combines engagement, fit, and recency.">
              <Button size="sm" variant="secondary">
                Hover me
              </Button>
            </Tooltip>
          </CardContent>
        </Card>
      </div>

      <Card variant="flat">
        <CardContent className="space-y-2 pt-4 text-[12px] leading-relaxed text-sales-text-secondary">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Accessibility & timing
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Modal / PremiumSheet: focus trap + restore · Escape · backdrop dismiss when allowed</li>
            <li>ConfirmDialog: alertdialog for destructive · no backdrop dismiss · inline error stays open</li>
            <li>Phase 12 states live under #states — reuse EmptyState / ErrorState, do not duplicate here</li>
            <li>Popover: portalled contextual panel · Escape + click-outside · not for action menus</li>
            <li>Toast: polite status for success/info · assertive alert for errors · max {SALES_OVERLAY.toastMaxVisible} stacked</li>
            <li>Inline alert: persists until state resolves or user dismisses · not auto-dismissed like toast</li>
            <li>Progress: numeric value adjacent to track · prefers-reduced-motion respected on skeleton/modal motion</li>
            <li>Mobile toast sits above SalesBottomNav via .sales-mobile-toast-anchor</li>
          </ul>
        </CardContent>
      </Card>

      {deleteOpen ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete lead"
          description="This action cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => setDeleteOpen(false)}
        >
          <p className="text-[13px] text-sales-text-secondary">
            Documentation example only. Production confirms preserve existing workflow rules and real mutations.
          </p>
        </ConfirmDialog>
      ) : null}

      {modalOpen ? (
        <Modal
          size="md"
          title="Configure settings"
          description="Update defaults for your workspace."
          onClose={() => setModalOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Save</Button>
            </div>
          }
        >
          <p className="text-[13px] text-sales-text-secondary">
            Live Modal uses the same PremiumSheet primitive as production sheets and confirms.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function FormsShowcaseSection() {
  const [search, setSearch] = useState("");
  const [firstName, setFirstName] = useState("Sarah");
  const [lastName, setLastName] = useState("Ndlovu");
  const [slug, setSlug] = useState("acme-energy");
  const [amount, setAmount] = useState("6800");
  const [unitValue, setUnitValue] = useState("25");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-sales-text-secondary">
          Composes Phase 02 field primitives into layout, states, groups, and validation — documentation only.
        </p>
        <SalesThemeToggle />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Input types</CardTitle>
            <CardDescription>Reuse Input · Select · TextArea · Search</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Customer name" required>
              <Input placeholder="Example name" autoComplete="name" />
            </Field>
            <Field label="Email">
              <Input type="email" placeholder="name@company.com" autoComplete="email" />
            </Field>
            <Field label="Phone">
              <Input type="tel" placeholder="+263 77 123 4567" autoComplete="tel" />
            </Field>
            <Field label="Lead source">
              <Select defaultValue="whatsapp">
                <option value="whatsapp">WhatsApp</option>
                <option value="website">Website</option>
              </Select>
            </Field>
            <Field label="Notes" optional>
              <TextArea rows={3} placeholder="Call summary…" />
            </Field>
            <Field label="Search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search records…" />
            </Field>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Field states</CardTitle>
            <CardDescription>Filled returns neutral · not success</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Default">
              <Input placeholder="Company name" />
            </Field>
            <Field label="Hover preview">
              <Input placeholder="Company name" previewState="hover" />
            </Field>
            <Field label="Focused preview">
              <Input placeholder="Company name" previewState="focus" />
            </Field>
            <Field label="Filled">
              <Input defaultValue="Acme Energy" />
            </Field>
            <Field label="Disabled">
              <Input disabled value="Unavailable" />
            </Field>
            <Field label="Read only">
              <Input readOnly defaultValue="Copied but not editable" />
            </Field>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Validation</CardTitle>
            <CardDescription>Semantic only when logic provides it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Email" error="Enter a valid email address.">
              <Input type="email" invalid defaultValue="not-an-email" />
            </Field>
            <Field label="Budget" warning="This value is unusually high for this segment.">
              <Input tone="warning" defaultValue="250000" />
            </Field>
            <Field label="Account number" success="Verified successfully.">
              <Input tone="success" defaultValue="ACC-20481" leftIcon={<CheckCircle2 strokeWidth={1.8} />} />
            </Field>
            <Field label="Reference" hint="Use your internal reference if available.">
              <Input placeholder="REF-001" />
            </Field>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Add-ons</CardTitle>
            <CardDescription>One connected silhouette · focus-within</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Amount">
              <InputGroup>
                <InputAddon side="left">$</InputAddon>
                <GroupedInput
                  addonSide="left"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field label="Capacity">
              <InputGroup>
                <GroupedInput addonSide="left" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} />
                <InputAddon side="right">kW</InputAddon>
              </InputGroup>
            </Field>
            <Field label="Workspace slug">
              <InputGroup>
                <InputAddon side="left">company.com/</InputAddon>
                <GroupedInput addonSide="left" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </InputGroup>
            </Field>
            <Field label="Email action (example)">
              <InputGroup>
                <GroupedInput addonSide="left" type="email" placeholder="name@company.com" />
                <InputGroupAction>
                  <InputGroupButton>Verify</InputGroupButton>
                </InputGroupAction>
              </InputGroup>
            </Field>
          </CardContent>
        </Card>

        <Card variant="flat" className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-[14px]">Form layout</CardTitle>
            <CardDescription>Single column preferred · 2-col for short pairs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-[560px]">
              <FormSection
                title="Contact details"
                description="Documentation example — not a production workflow."
              >
                <FormFields columns={2}>
                  <Field label="First name" required>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </Field>
                  <Field label="Last name" required>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Notes">
                      <TextArea rows={3} placeholder="Additional context…" />
                    </Field>
                  </div>
                </FormFields>
                <FormActions className="pt-4">
                  <Button variant="secondary">Cancel</Button>
                  <Button>Save changes</Button>
                </FormActions>
              </FormSection>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="flat">
        <CardContent className="space-y-2 pt-4 text-[12px] leading-relaxed text-sales-text-secondary">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Spacing & best practices
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Label → field: {SALES_FORM.labelGap}px · field → hint/error: {SALES_FORM.messageGap}px · field gap:{" "}
              {SALES_FORM.fieldGap}–{SALES_FORM.fieldGapLoose}px · section gap: {SALES_FORM.sectionGap}–
              {SALES_FORM.sectionGapLoose}px
            </li>
            <li>Desktop field height {SALES_FIELD_HEIGHT.md}px · mobile minimum {SALES_FIELD_HEIGHT.touch}px</li>
            <li>Keep labels visible · placeholders are format guidance only · use correct input types</li>
            <li>Non-empty does not mean success · validate with real application rules · associate errors via aria-describedby</li>
            <li>Input groups share one outer border and focus-within treatment · danger applies to the whole group</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function MenusShowcaseSection() {
  const [owner, setOwner] = useState("sarah");
  const [docFilters, setDocFilters] = useState([
    { key: "stage", label: "Stage", value: "Negotiating" },
    { key: "score", label: "Score", value: "Hot", valueClassName: "text-sales-danger" },
    { key: "source", label: "Source", value: "WhatsApp" },
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-sales-text-secondary">
          Surface secondary actions · choose values · brief guidance · active filters. Documentation examples only.
        </p>
        <SalesThemeToggle />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Dropdown menu</CardTitle>
            <CardDescription>Actions · menu / menuitem · portal positioned</CardDescription>
          </CardHeader>
          <CardContent>
            <DropdownMenu align="start">
              <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-hover">
                Actions
                <MoreHorizontal size={16} strokeWidth={1.8} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem icon={<LayoutList size={16} strokeWidth={1.8} />}>
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Edit size={16} strokeWidth={1.8} />}>Edit lead</DropdownMenuItem>
                <DropdownMenuItem icon={<UserPlus size={16} strokeWidth={1.8} />}>
                  Assign to teammate
                </DropdownMenuItem>
                <DropdownMenuItem icon={<MessageCircle size={16} strokeWidth={1.8} />}>
                  Send WhatsApp
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Copy size={16} strokeWidth={1.8} />}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem destructive icon={<Trash2 size={16} strokeWidth={1.8} />}>
                  Delete lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Select / MenuSelect</CardTitle>
            <CardDescription>Listbox · restrained selected wash</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Assign owner">
              <MenuSelect
                variant="field"
                aria-label="Assign owner"
                value={owner}
                onChange={setOwner}
                options={[
                  { value: "sarah", label: "Sarah Ndlovu", description: "Sales Manager" },
                  { value: "james", label: "James K.", description: "Account Executive" },
                  { value: "unassigned", label: "Unassigned" },
                ]}
              />
            </Field>
            <MenuSelect
              size="sm"
              aria-label="Sort"
              value="recent"
              onChange={() => {}}
              options={[
                { value: "recent", label: "Most recent" },
                { value: "score", label: "Highest score" },
              ]}
            />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Tooltip</CardTitle>
            <CardDescription>~{SALES_MENU.tooltipShowDelayMs}ms show · compact dark chip</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 pt-2">
            <Tooltip label="Lead Score combines engagement, fit, and recency.">
              <IconButton aria-label="What is Lead Score?">
                <Info strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Opens the full record detail panel.">
              <Button size="sm" variant="secondary">
                Hover me
              </Button>
            </Tooltip>
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Filter pills</CardTitle>
            <CardDescription>Active constraints · removable · neutral shell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActiveFiltersBar
              showClearAll={docFilters.length > 1}
              onClearAll={() => setDocFilters([])}
            >
              {docFilters.map((filter) => (
                <FilterPill
                  key={filter.key}
                  label={filter.label}
                  value={filter.value}
                  valueClassName={filter.valueClassName}
                  icon={filter.key === "source" ? <BrandIcon brand="whatsapp" size={14} /> : undefined}
                  onRemove={() => setDocFilters((items) => items.filter((f) => f.key !== filter.key))}
                  removeLabel={`Remove ${filter.label}: ${filter.value} filter`}
                />
              ))}
            </ActiveFiltersBar>
            <div className="flex items-center gap-2 text-[12px] text-sales-text-muted">
              <MetaPill>WhatsApp</MetaPill>
              <span>passive metadata · not a filter pill</span>
            </div>
            <Button size="sm" variant="secondary">
              + Add filter
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card variant="flat">
        <CardContent className="space-y-2 pt-4 text-[12px] leading-relaxed text-sales-text-secondary">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
            Accessibility & placement
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>DropdownMenu uses menu/menuitem · MenuSelect uses listbox/option · Tooltip uses role=tooltip + aria-describedby</li>
            <li>Default placement bottom-start · collision padding ~{SALES_MENU.viewportPadding}px · max height ~{SALES_MENU.maxHeight}px</li>
            <li>Menu hover uses neutral wash · selected select option uses restrained lime-soft · destructive actions stay danger</li>
            <li>Filter pills are interactive constraints with remove controls · MetaPill remains passive metadata</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StatesShowcaseSection() {
  const [retryDemo, setRetryDemo] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-sales-text-secondary">
          Four production systems — empty, loading, error recovery, success & information. Documentation examples only.
        </p>
        <SalesThemeToggle />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { n: "1", title: "Empty & filtered empty", q: "Why is there nothing here?" },
          { n: "2", title: "Loading", q: "Is the system still working?" },
          { n: "3", title: "Error & recovery", q: "What failed, and how can I recover?" },
          { n: "4", title: "Success & information", q: "What completed, or what do I need to know?" },
        ].map((s) => (
          <Card key={s.n} variant="flat">
            <CardContent className="space-y-1 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-brand-fg">
                System {s.n}
              </p>
              <p className="text-[13px] font-semibold text-sales-text-primary">{s.title}</p>
              <p className="text-[11px] text-sales-text-muted">{s.q}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">1 · True empty</CardTitle>
            <CardDescription>No records exist in this context yet</CardDescription>
          </CardHeader>
          <CardContent className="border-t border-sales-border-subtle pt-2">
            <EmptyState
              icon={<Inbox size={20} strokeWidth={1.8} />}
              title="No leads yet"
              description="New enquiries will appear here once they are captured."
              action={
                <Button variant="primary" size="sm" leftIcon={<Plus size={14} strokeWidth={1.8} />}>
                  Add lead
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">1 · Filtered empty</CardTitle>
            <CardDescription>Records may exist — the current query returned no matches</CardDescription>
          </CardHeader>
          <CardContent className="border-t border-sales-border-subtle pt-2">
            <FilteredEmptyState
              onClearFilters={() => {}}
              description="Try changing your filters or search terms."
            />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">2 · Loading</CardTitle>
            <CardDescription>Skeleton first · spinner only for small/unknown waits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 border-t border-sales-border-subtle pt-4">
            <DataTable>
              <DataTableEl>
                <DataTableHead>
                  <tr>
                    <DataTableTh>Lead</DataTableTh>
                    <DataTableTh>Stage</DataTableTh>
                    <DataTableTh>Owner</DataTableTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  <DataTableSkeleton columns={3} rows={4} />
                </DataTableBody>
              </DataTableEl>
            </DataTable>
            <LoadingState label="Loading leads…" size="compact" />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">3 · Error & recovery</CardTitle>
            <CardDescription>Retry uses primary action — not destructive red</CardDescription>
          </CardHeader>
          <CardContent className="border-t border-sales-border-subtle pt-2">
            <ErrorState
              title="Unable to load data"
              description="We couldn't retrieve this section right now."
              onRetry={() => {
                setRetryDemo(true);
                window.setTimeout(() => setRetryDemo(false), 1200);
              }}
              retryLoading={retryDemo}
            />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">4 · Success</CardTitle>
            <CardDescription>
              Full completion views only — ordinary CRUD success still uses Toast (Phase 07)
            </CardDescription>
          </CardHeader>
          <CardContent className="border-t border-sales-border-subtle pt-2">
            <SuccessState
              title="Import complete"
              description="42 customers were added successfully."
              action={
                <Button variant="primary" size="sm">
                  View records
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">4 · Information / setup</CardTitle>
            <CardDescription>Unavailable or not configured — not a failure</CardDescription>
          </CardHeader>
          <CardContent className="border-t border-sales-border-subtle pt-2">
            <InfoState
              variant="setup"
              title="WhatsApp isn't connected"
              description="Connect your WhatsApp Business account to receive and reply to conversations."
              action={
                <Button variant="primary" size="sm">
                  Connect WhatsApp
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card variant="flat">
        <CardHeader>
          <CardTitle className="text-[14px]">When to use each system</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Empty", "No records exist in this workspace context."],
            ["Filtered empty", "Records may exist but the active query has no matches."],
            ["Loading", "Data is being fetched — preserve layout with skeleton when possible."],
            ["Error", "An expected operation failed — explain what and offer real recovery."],
            ["Success", "The current view represents a completed workflow outcome."],
            ["Info", "Feature is unavailable, awaiting setup, or needs prerequisite context."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
              <p className="text-[12px] font-semibold text-sales-text-primary">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-sales-text-secondary">{body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card variant="flat">
        <CardHeader>
          <CardTitle className="text-[14px]">Copy & accessibility</CardTitle>
          <CardDescription>Be specific · explain why · offer the next useful action</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-[12px] text-sales-text-secondary">
          <p>
            Prefer titles like <strong className="font-semibold text-sales-text-primary">Unable to load leads</strong>{" "}
            over vague labels. Avoid “Oops!” or raw error codes in user-facing copy.
          </p>
          <p>
            State resolution order for fetched lists: loading → error → filtered empty → empty → content. Do not show
            empty while loading or after a failed fetch.
          </p>
          <p>
            Icons are decorative (<code className="rounded bg-sales-neutral-100 px-1">aria-hidden</code>). Use{" "}
            <code className="rounded bg-sales-neutral-100 px-1">role=&quot;alert&quot;</code> for urgent errors,{" "}
            <code className="rounded bg-sales-neutral-100 px-1">role=&quot;status&quot;</code> for loading and success completion.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ChartsShowcaseSection() {
  const docRevenueSeries = [
    { label: "2026-08-04", value: 8200, previous: 7100 },
    { label: "2026-08-11", value: 12400, previous: 9800 },
    { label: "2026-08-18", value: 15600, previous: 11200 },
    { label: "2026-08-25", value: 18900, previous: 14100 },
  ];
  const docSparkline = [
    { label: "W1", value: 6200 },
    { label: "W2", value: 7800 },
    { label: "W3", value: 7100 },
    { label: "W4", value: 9200 },
    { label: "W5", value: 87450 },
  ];
  const docFunnelStages = [
    { id: "new", label: "New enquiries", count: 1840, color: PIPELINE_STAGE_COLORS.NEW, icon: Inbox },
    { id: "contacted", label: "Contacted", count: 1320, color: PIPELINE_STAGE_COLORS.CONTACTED, icon: MessageCircle },
    { id: "qualified", label: "Qualified", count: 1025, color: "var(--sales-cyan)", icon: UserCheck },
    { id: "proposal", label: "Proposal sent", count: 640, color: PIPELINE_STAGE_COLORS.PROPOSAL_SENT, icon: FileText },
    { id: "won", label: "Won", count: 218, color: PIPELINE_STAGE_COLORS.WON, icon: CheckCircle2 },
  ];
  const docHeatmapCells = Array.from({ length: 31 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, "0")}`,
    value: [0, 2, 5, 8, 12, 18, 24, 16, 9, 4][i % 10],
  }));

  const semanticSwatches = [
    { label: "Brand", token: SALES_CHART_SEMANTIC.brand, note: "Primary series — not generic positive" },
    { label: "Success", token: SALES_CHART_SEMANTIC.success, note: "Won, accepted, on-target" },
    { label: "Information", token: SALES_CHART_SEMANTIC.info, note: "New, informational" },
    { label: "Warning", token: SALES_CHART_SEMANTIC.warning, note: "Thresholds, negotiating" },
    { label: "Danger", token: SALES_CHART_SEMANTIC.danger, note: "Lost, failed, negative delta" },
    { label: "Neutral", token: SALES_CHART_SEMANTIC.neutral, note: "Axis, inactive" },
    { label: "Comparison", token: SALES_CHART_SEMANTIC.comparison, note: "Previous period series" },
  ] as const;

  return (
    <div className="space-y-8">
      <p className="text-[12px] text-sales-text-secondary">
        Four visualization systems on Recharts + shared tokens. Documentation examples below use static values only — production charts must use real API data or show empty states.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { n: "1", title: "Metric & micro trend", q: "What is the number, and which direction?" },
          { n: "2", title: "Time series", q: "How is this changing over time?" },
          { n: "3", title: "Comparison & composition", q: "How do categories compare?" },
          { n: "4", title: "Process & activity", q: "Where in the process, or when is activity?" },
        ].map((s) => (
          <Card key={s.n} variant="flat">
            <CardContent className="space-y-1 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-brand-fg">System {s.n}</p>
              <p className="text-[13px] font-semibold text-sales-text-primary">{s.title}</p>
              <p className="text-[11px] text-sales-text-muted">{s.q}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">1 · KPI & micro trend</CardTitle>
            <CardDescription>Metric-first · sparkline only when real series exists in production</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted">Total revenue</p>
            <MetricValue value="$87,450" />
            <Trend direction="up" label="23.6% vs last month" />
            <SalesSparkline data={docSparkline} height={SALES_CHART.sparkline} />
            <p className="text-[11px] text-sales-text-muted">Updated 2h ago · documentation only</p>
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">2 · Line / area · comparison</CardTitle>
            <CardDescription>Brand primary · violet comparison · subtle grid</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <SalesLineChart
              data={docRevenueSeries}
              comparisonKey="previous"
              xKey="label"
              valueFormat="currency"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">3a · Bar · categories</CardTitle>
            <CardDescription>Single brand color for ordinary comparison</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <SalesBarChart
              layout="horizontal"
              data={[
                { label: "Facebook Ads", value: 1247 },
                { label: "WhatsApp", value: 842 },
                { label: "Referrals", value: 531 },
                { label: "Website", value: 318 },
              ]}
            />
          </CardContent>
        </Card>
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">3b · Donut · composition</CardTitle>
            <CardDescription>Legend + center total · 2–5 categories ideal</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <SalesDonutChart
              data={[
                { name: "Hot", value: 45, color: SALES_COLORS.danger },
                { name: "Warm", value: 30, color: SALES_COLORS.warning },
                { name: "Cold", value: 20, color: SALES_COLORS.info },
                { name: "Lost", value: 5, color: SALES_COLORS.textMuted },
              ]}
              centerLabel="Leads"
            />
          </CardContent>
        </Card>
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">2b · Area · volume</CardTitle>
            <CardDescription>Faint brand fill · 2px stroke</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <SalesAreaChart
              data={docRevenueSeries.map(({ label, value }) => ({ label, value }))}
              valueFormat="currency"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">4a · Funnel · process stages</CardTitle>
            <CardDescription>Phase 04 stage colors · width from real counts</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesFunnelChart stages={docFunnelStages} />
          </CardContent>
        </Card>
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">4b · Heatmap · activity density</CardTitle>
            <CardDescription>Sequential brand scale · neutral zero cells</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesHeatmap cells={docHeatmapCells} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Chart color system</CardTitle>
            <CardDescription>Use color to communicate meaning — not decoration</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {semanticSwatches.map((s) => (
                <li key={s.label} className="flex items-start gap-2 rounded-[8px] border border-sales-border-subtle px-3 py-2">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-[4px]" style={{ backgroundColor: s.token }} aria-hidden />
                  <div>
                    <p className="text-[12px] font-medium text-sales-text-primary">{s.label}</p>
                    <p className="text-[11px] text-sales-text-muted">{s.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Data formatting</CardTitle>
            <CardDescription>Centralized via <code className="text-[11px]">lib/sales/chart-format.ts</code></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-[13px] tabular-nums text-sales-text-primary sm:grid-cols-2">
            <p>1,234</p>
            <p>$12,450</p>
            <p>23.6%</p>
            <p>18 Aug 2026</p>
            <p>1.2K / 3.4M</p>
            <p className="text-sales-success">↑ 23.6%</p>
            <p className="text-sales-danger">↓ 12.4%</p>
          </CardContent>
        </Card>
      </div>

      <Card variant="flat">
        <CardHeader>
          <CardTitle className="text-[14px]">Chart anatomy & best practices</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Anatomy</p>
            <ul className="space-y-1 text-[12px] text-sales-text-secondary">
              <li>Chart title — outside plot canvas (Card header)</li>
              <li>Legend — only when it adds clarity</li>
              <li>Y axis — compact formatted ticks</li>
              <li>Data series — max ~3–4 visible</li>
              <li>Area fill — very subtle opacity</li>
              <li>X axis — adaptive date labels</li>
              <li>Grid lines — horizontal only, subtle</li>
              <li>Tooltip — elevated data card, tabular numbers</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Best practices</p>
            <ul className="space-y-1 text-[12px] text-sales-text-secondary">
              <li>Show only what drives decisions</li>
              <li>Limit visible series · label clearly</li>
              <li>Show comparisons only when real data exists</li>
              <li>Never fabricate data, trends, or forecasts</li>
              <li>Empty state when zero — not a fake graph</li>
              <li>Preserve accessibility · respect reduced motion</li>
              <li>Use tables when precise detail beats a chart</li>
            </ul>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Responsive</p>
            <p className="text-[12px] text-sales-text-secondary">
              Desktop: full detail · Tablet: adjust legend/tick density · Mobile: fewer X ticks, legend below donut, horizontal scroll for dense heatmaps. Standard heights: sparkline {SALES_CHART.sparkline}px · compact {SALES_CHART.compact}px · standard {SALES_CHART.standard}px · large {SALES_CHART.large}px.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NavigationShowcaseSection() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [docTab, setDocTab] = useState("overview");
  const [topBarSearch, setTopBarSearch] = useState("");
  const sidebarWidth = sidebarCollapsed ? SALES_LAYOUT.sidebarCollapsed : SALES_LAYOUT.sidebarExpanded;

  const sidebarItems = [
    { label: "Dashboard", icon: LayoutDashboard, active: true, badge: undefined as number | undefined },
    { label: "Pipeline", icon: Columns3, active: false },
    { label: "WhatsApp", icon: null as null, active: false, badge: 3 },
    { label: "Leads", icon: UsersRound, active: false },
    { label: "Tasks", icon: ListTodo, active: false, badge: 2 },
  ];

  const bottomItems = ["Dashboard", "Pipeline", "WhatsApp", "Tasks", "More"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-sales-text-secondary">
          Application chrome only — sidebar, top bar, breadcrumbs, tabs, mobile nav, and layout tokens. Documentation examples; production routes come from{" "}
          <code className="rounded bg-sales-surface-subtle px-1 py-0.5 text-[11px]">sales-nav-config.ts</code>.
        </p>
        <SalesThemeToggle />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Sidebar · expanded / collapsed</CardTitle>
            <CardDescription>
              {SALES_LAYOUT.sidebarExpanded}px expanded · {SALES_LAYOUT.sidebarCollapsed}px collapsed · soft lime active wash · 3px rail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div
                className="relative shrink-0 overflow-hidden rounded-[10px] border border-[var(--sales-sidebar-border)] bg-[var(--sales-sidebar-bg)] transition-[width] duration-200 ease-out"
                style={{ width: sidebarWidth }}
              >
                <div className="flex h-14 items-center justify-between px-3">
                  <span className="text-[11px] font-semibold tracking-tight text-[var(--sales-sidebar-text-active)]">
                    {sidebarCollapsed ? "Q" : "SegmiQ"}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-[var(--sales-sidebar-icon)] hover:bg-[var(--sales-sidebar-hover)]"
                    aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    onClick={() => setSidebarCollapsed((v) => !v)}
                  >
                    <PanelLeftClose size={14} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="px-2 pb-3">
                  {!sidebarCollapsed ? (
                    <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--sales-sidebar-muted)]">
                      Sales
                    </p>
                  ) : null}
                  <div className={cn("flex flex-col gap-1", sidebarCollapsed && "items-center")}>
                    {sidebarItems.map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          "relative flex items-center rounded-[8px] text-[13px]",
                          sidebarCollapsed ? "h-10 w-10 justify-center" : "h-10 gap-2.5 px-3",
                          item.active ? "sales-nav-item-active font-semibold" : "text-[var(--sales-sidebar-text)]"
                        )}
                      >
                        {item.active && !sidebarCollapsed ? <span className="sales-nav-rail" aria-hidden /> : null}
                        {item.icon ? (
                          <item.icon
                            size={17}
                            strokeWidth={1.75}
                            className={item.active ? "text-[var(--sales-sidebar-icon-active)]" : "text-current"}
                            aria-hidden
                          />
                        ) : (
                          <BrandIcon brand="whatsapp" size={16} />
                        )}
                        {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                        {!sidebarCollapsed && item.badge ? (
                          <Badge size="sm" className="ml-auto">
                            {item.badge}
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-[12px] text-sales-text-secondary">
                <p>Inactive: transparent · muted text · neutral hover.</p>
                <p>Active: lime gradient wash · lime icon · 600 weight · left rail — not a solid lime pill.</p>
                <p>Collapsed: icons only + Tooltip labels (production).</p>
                <p>Width token: <code className="font-mono text-[11px]">--sales-sidebar-current-width</code></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Global top bar + page context</CardTitle>
            <CardDescription>Global controls in header row · page identity via SalesPageHeader</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface">
              <div className="flex h-14 items-center gap-2 border-b border-sales-border-subtle px-3">
                <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                  <SearchInput
                    value={topBarSearch}
                    onChange={setTopBarSearch}
                    placeholder="Search leads, deals, customers…"
                    className="max-w-[280px]"
                  />
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <IconButton aria-label="Notifications" icon={<Bell size={16} strokeWidth={1.8} />} />
                  <SalesThemeToggle />
                  <Button size="sm">
                    <Zap size={14} strokeWidth={1.8} aria-hidden />
                    Quick actions
                  </Button>
                  <Avatar name="Sarah Ndlovu" size="sm" />
                </div>
              </div>
              <div className="space-y-3 p-4">
                <SalesPageHeader
                  breadcrumb="Sales / Leads / Lead detail"
                  title="Leads"
                  description="Manage and prioritize your active sales conversations."
                  titleActions={
                    <Button size="sm" variant="secondary">
                      Export
                    </Button>
                  }
                />
              </div>
            </div>
            <p className="text-[12px] text-sales-text-secondary">
              Height ~{SALES_LAYOUT.topBarHeight}px · search uses Phase 02 SearchInput · Quick Actions uses Phase 01 Button + Phase 09 DropdownMenu.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Breadcrumbs</CardTitle>
            <CardDescription>Hierarchy only · 11–12px · chevron separators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SalesBreadcrumbs
              items={[
                { label: "Sales", href: "/sales/dashboard" },
                { label: "Leads", href: "/sales/pipeline" },
                { label: "Lead detail" },
              ]}
            />
            <SalesBreadcrumbs value="Company / Settings / Integrations" />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Tabs · Phase 04</CardTitle>
            <CardDescription>Section navigation · underline · not segmented pills</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              items={[
                { id: "overview", label: "Overview" },
                { id: "activity", label: "Activity" },
                { id: "notes", label: "Notes" },
                { id: "files", label: "Files" },
              ]}
              value={docTab}
              onChange={setDocTab}
            />
          </CardContent>
        </Card>

        <Card variant="flat">
          <CardHeader>
            <CardTitle className="text-[14px]">Mobile bottom nav</CardTitle>
            <CardDescription>
              {SALES_LAYOUT.mobileNavHeight}px + safe area · max {SALES_LAYOUT.bottomNavMaxItems} primary destinations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[10px] border border-sales-border bg-sales-surface">
              <div className="grid h-16 grid-cols-5 items-stretch px-1">
                {bottomItems.map((label, index) => {
                  const active = index === 1;
                  const isMore = label === "More";
                  return (
                    <div
                      key={label}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                        active ? "text-sales-text-primary" : "text-sales-text-secondary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-11 items-center justify-center rounded-[10px]",
                          active && "bg-[var(--sales-sidebar-active)]"
                        )}
                      >
                        {isMore ? (
                          <Ellipsis size={18} strokeWidth={1.75} className={active ? "text-[var(--sales-sidebar-icon-active)]" : undefined} />
                        ) : label === "WhatsApp" ? (
                          <BrandIcon brand="whatsapp" size={18} />
                        ) : (
                          <LayoutDashboard size={18} strokeWidth={active ? 2 : 1.75} className={active ? "text-[var(--sales-sidebar-icon-active)]" : undefined} />
                        )}
                      </span>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 text-[12px] text-sales-text-secondary">
              Mobile top bar: {SALES_LAYOUT.mobileHeaderHeight}px · secondary routes in SalesMoreSheet (Phase 07).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card variant="flat">
        <CardContent className="grid gap-6 pt-5 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Breakpoints · actual codebase
            </p>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-sales-text-secondary">
              <li>
                <strong className="text-sales-text-primary">Shell desktop:</strong> Tailwind{" "}
                <code className="font-mono text-[11px]">layout:</code> @ {SALES_LAYOUT.shellBreakpointPx}px — sidebar visible, mobile chrome hidden
              </li>
              <li>
                <strong className="text-sales-text-primary">Mobile chrome:</strong> &lt; {SALES_LAYOUT.shellBreakpointPx}px — SalesMobileTopBar + SalesBottomNav
              </li>
              <li>
                <strong className="text-sales-text-primary">Page padding:</strong> {SALES_LAYOUT.pagePaddingXMobile}px mobile ·{" "}
                {SALES_LAYOUT.pagePaddingXTablet}px tablet · {SALES_LAYOUT.pagePaddingXDesktop}px desktop (shell-owned{" "}
                <code className="font-mono text-[11px]">.sales-page-content</code>)
              </li>
              <li>
                <strong className="text-sales-text-primary">CRM width:</strong> fluid — no universal 1280px max-width on operational pages
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              12-column grid · layout tool
            </p>
            <div className="grid grid-cols-12 gap-2 rounded-[10px] border border-dashed border-sales-border p-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-[4px] bg-sales-brand/10 text-center text-[9px] leading-8 text-sales-text-muted"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-sales-text-secondary">
              Documentation grid only — not rendered in production. Dashboard gaps typically 12–16px; section spacing{" "}
              {SALES_LAYOUT.sectionGap}px.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ShowcaseInner() {
  const { toast } = useSalesToast();
  const [seg, setSeg] = useState<"day" | "week" | "month">("week");
  const [segCount, setSegCount] = useState<"all" | "open" | "won">("open");
  const [segIcon, setSegIcon] = useState<"day" | "list">("day");
  const [tab, setTab] = useState("pipeline");
  const [tabIcon, setTabIcon] = useState("leads");
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
                Page Tabs → see 04 — Tabs, Badges & Status
              </p>
              <p className="text-[12px] text-sales-text-secondary">
                Underline Tabs are Phase 04 (not SegmentedControl). Company page navigation stays lime-underline.
              </p>
            </div>
          </Section>

          {/* ── Tabs, Badges & Status ───────────────────────────── */}
          <Section
            id="badges"
            title="04 — Tabs, Badges & Status"
            description="Communicate clearly, scan instantly, act confidently. Lime for brand navigation · semantic colours for operational state."
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-sales-text-secondary">
                Validate both themes with the page toggle.
              </p>
              <SalesThemeToggle />
            </div>

            <div className="space-y-8">
              {/* 01 Tabs */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  01 Tabs
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Where am I? Underline navigation — not a SegmentedControl track. Active = weight 600 + 3px lime underline.
                </p>
                <Card>
                  <CardContent className="space-y-5 pt-4">
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">Default / active (Pipeline)</p>
                      <Tabs
                        items={[
                          { id: "leads", label: "Leads" },
                          { id: "pipeline", label: "Pipeline" },
                          { id: "customers", label: "Customers" },
                          { id: "team", label: "Team" },
                          { id: "reports", label: "Reports" },
                          { id: "settings", label: "Settings" },
                        ]}
                        value={tab}
                        onChange={setTab}
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">With icon</p>
                      <Tabs
                        items={[
                          { id: "leads", label: "Leads", icon: <Users strokeWidth={1.8} /> },
                          { id: "pipeline", label: "Pipeline", icon: <BarChart3 strokeWidth={1.8} /> },
                          { id: "team", label: "Team", icon: <Users strokeWidth={1.8} /> },
                          { id: "settings", label: "Settings", icon: <Settings strokeWidth={1.8} /> },
                        ]}
                        value={tabIcon}
                        onChange={setTabIcon}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 02 Generic badges */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  02 Generic badges
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Small attributes. Soft is default. Brand lime ≠ success green.
                </p>
                <Card>
                  <CardContent className="space-y-4 pt-4">
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">Soft</p>
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
                            "teal",
                          ] as const
                        ).map((tone) => (
                          <Badge key={`soft-${tone}`} tone={tone}>
                            {tone}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">Outline</p>
                      <div className="flex flex-wrap gap-2">
                        {(
                          ["neutral", "brand", "success", "warning", "danger", "info", "purple", "teal"] as const
                        ).map((tone) => (
                          <Badge key={`out-${tone}`} tone={tone} appearance="outline">
                            {tone}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">Solid (rare)</p>
                      <div className="flex flex-wrap gap-2">
                        {(
                          ["neutral", "brand", "success", "warning", "danger", "info", "purple", "teal"] as const
                        ).map((tone) => (
                          <Badge key={`sol-${tone}`} tone={tone} appearance="solid">
                            {tone}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge size="sm">sm</Badge>
                      <Badge size="md">md</Badge>
                      <Badge size="lg">lg</Badge>
                      <Badge tone="danger" leftIcon={<Bell strokeWidth={2} />}>
                        12
                      </Badge>
                      <Badge tone="neutral" className="min-w-[22px] justify-center px-1.5">
                        99+
                      </Badge>
                      <MetaPill>WhatsApp</MetaPill>
                      <MetaPill>Website</MetaPill>
                      <MetaPill>Referral</MetaPill>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 03 Sales status */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  03 Sales status
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Pipeline process + lead intent. Cold is blue — never grey. Brand lime only for Scoping.
                </p>
                <Card>
                  <CardContent className="space-y-4 pt-4">
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">Pipeline stages</p>
                      <div className="flex flex-wrap gap-2">
                        <PipelineStageBadge status="NEW" />
                        <PipelineStageBadge status="CONTACTED" />
                        <PipelineStageBadge status="QUALIFIED" />
                        <PipelineStageBadge status="SCOPING" />
                        <PipelineStageBadge status="NEGOTIATING" />
                        <PipelineStageBadge status="PROPOSAL_SENT" />
                        <PipelineStageBadge status="WON" />
                        <PipelineStageBadge status="LOST" />
                        <PipelineStageBadge status="NOT_QUALIFIED" />
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">
                        Lead score · Hot ≥70 · Warm 45–69 · Cold &lt;45
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <LeadScoreBadge score={82} />
                        <LeadScoreBadge score={58} />
                        <LeadScoreBadge score={21} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 04 Quotation + dots */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  04 Quotation status · StatusDot
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Document lifecycle. Accepted = success green (not brand lime). Domain enum `rejected` displays as Declined.
                </p>
                <Card>
                  <CardContent className="space-y-4 pt-4">
                    <div className="flex flex-wrap gap-2">
                      <QuotationStatusBadge status="draft" />
                      <QuotationStatusBadge status="sent" />
                      <QuotationStatusBadge status="viewed" />
                      <QuotationStatusBadge status="accepted" />
                      <QuotationStatusBadge status="rejected" />
                      <QuotationStatusBadge status="expired" />
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] text-sales-text-muted">
                        Also in product (not showcase-primary): pending approval · approved · superseded
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <QuotationStatusBadge status="pending_approval" />
                        <QuotationStatusBadge status="approved" />
                        <QuotationStatusBadge status="superseded" />
                      </div>
                    </div>
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
                  </CardContent>
                </Card>
              </div>
            </div>
          </Section>

          {/* ── Cards ──────────────────────────────────────────── */}
          <Section
            id="cards"
            title="05 — Cards"
            description="Clear structure, subtle depth, and consistent behavior. Base · KPI · Attention · Interactive/Selected."
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-sales-text-secondary">
                Showcase content is documentation only — not production CRM data. Validate Light / Dark with the toggle.
              </p>
              <SalesThemeToggle />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {/* 01 Base */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  01 Base / Standard
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Quiet workspace container. No lime · no hover · 12px radius · restrained shadow.
                </p>
                <Card>
                  <CardHeader>
                    <CardTitle>Account overview</CardTitle>
                    <CardDescription>Grouped customer summary surface</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <LeadIdentity name="Sipho Khumalo" secondary="Enterprise · Customer" />
                    <div className="grid grid-cols-3 gap-3 border-t border-[var(--sales-card-divider)] pt-4">
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Deals</p>
                        <p className="mt-1 text-[14px] font-semibold tabular-nums">12</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Open</p>
                        <p className="mt-1 text-[14px] font-semibold tabular-nums">4</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Won</p>
                        <p className="mt-1 text-[14px] font-semibold tabular-nums">7</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 02 KPI */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  02 KPI
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Metric-first. Trend uses success/danger — not brand lime. Chart optional in production only when real series exists.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <KpiStat
                    item={{
                      id: "pipeline",
                      label: "Pipeline value",
                      value: "$118,450",
                      supporting: "vs last 30 days",
                      icon: "pipeline",
                      trend: { direction: "up", label: "12.5%" },
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
                </div>
              </div>

              {/* 03 Attention */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  03 Attention
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Soft semantic wash + 3px left accent — not a full neon border.
                </p>
                <Card variant="attention" attentionTone="warning">
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sales-warning-soft text-sales-warning-fg">
                        <AlertTriangle size={16} strokeWidth={1.8} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-sales-text-primary">Action required</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-sales-text-secondary">
                          3 deals are stuck in Negotiation for more than 14 days.
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary">
                      Review deals
                    </Button>
                  </CardContent>
                </Card>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Card variant="attention" attentionTone="danger">
                    <CardContent className="py-3">
                      <p className="text-[12px] font-semibold text-sales-danger-fg">Danger tone</p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">High-risk / overdue pattern</p>
                    </CardContent>
                  </Card>
                  <Card variant="attention" attentionTone="brand">
                    <CardContent className="py-3">
                      <p className="text-[12px] font-semibold text-sales-brand-fg">Brand tone</p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">SegmiQ-specific nudge only</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* 04 Interactive / Selected */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  04 Interactive / Selected
                </p>
                <p className="mb-3 text-[12px] text-sales-text-secondary">
                  Interactive = neutral + lift on hover. Selected = lime-soft wash + brand border. No neon halo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card variant="interactive" tabIndex={0} role="button" aria-label="Interactive card example">
                    <CardContent>
                      <p className="text-[12px] font-medium text-sales-text-secondary">Interactive</p>
                      <p className="mt-2 text-[14px] font-semibold text-sales-text-primary">Hover for lift</p>
                      <p className="mt-1 text-[12px] text-sales-text-muted">−1px · stronger border · pressed +1px</p>
                    </CardContent>
                  </Card>
                  <Card variant="selected" className="relative">
                    <span
                      className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-[6px] bg-sales-brand text-[var(--sales-ink)]"
                      aria-hidden
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <CardContent>
                      <p className="text-[12px] font-medium text-sales-brand-fg">Selected</p>
                      <p className="mt-2 text-[14px] font-semibold text-sales-text-primary">Plan option</p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">Soft lime wash · brand border</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Anatomy + spacing notes */}
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader action={<IconButton aria-label="More" size="sm" icon={<MoreHorizontal strokeWidth={1.8} />} />}>
                  <CardTitle>Card anatomy</CardTitle>
                  <CardDescription>Header · content · footer slots</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <LeadIdentity name="Tendai Moyo" secondary="Body / content region" />
                  <MetricValue value="$42,800" />
                  <Trend direction="up" label="8.2% vs prior period" />
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="secondary">
                    Secondary
                  </Button>
                  <Button size="sm">Primary</Button>
                </CardFooter>
              </Card>
              <Card variant="flat">
                <CardContent className="space-y-3 text-[12px] text-sales-text-secondary">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                    Spacing & radius
                  </p>
                  <ul className="space-y-1.5 leading-relaxed">
                    <li>Padding: 16 mobile · 20 desktop</li>
                    <li>Radius: 10 compact · 12 default · 14 large workspace</li>
                    <li>Border: 1px subtle · shadow via --sales-shadow-card</li>
                    <li>Flat: nested/quiet · no shadow</li>
                    <li>Static base cards never lift on hover</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ── Tables ─────────────────────────────────────────── */}
          <Section
            id="table"
            title="15 — Advanced Tables & Data Display"
            description="Extends Phase 06 · four systems: default table · sort & filter · row actions · selection & bulk."
          >
            <TablesShowcaseSection />
          </Section>

          {/* ── Overlays & Feedback ────────────────────────────── */}
          <Section
            id="overlays"
            title="14 — Overlays & Feedback"
            description="Four systems: blocking overlays · contextual overlays · feedback messaging · process feedback. Reuses Phase 12 states."
          >
            <OverlaysShowcaseSection />
          </Section>

          {/* ── Forms & Inputs ─────────────────────────────────── */}
          <Section
            id="forms"
            title="08 — Forms & Inputs"
            description="Field composition · states & validation · input groups · form layout. Composes Phase 02 primitives."
          >
            <FormsShowcaseSection />
          </Section>

          {/* ── Menus & Pills ──────────────────────────────────── */}
          <Section
            id="menus"
            title="09 — Menus, Dropdowns & Pills"
            description="Dropdown actions · MenuSelect values · tooltip guidance · active filter pills."
          >
            <MenusShowcaseSection />
          </Section>

          {/* ── Navigation & Layout ────────────────────────────── */}
          <Section
            id="navigation"
            title="10 — Navigation & Layout"
            description="App shell · sidebar · global top bar · breadcrumbs · tabs · mobile nav · responsive layout tokens."
          >
            <NavigationShowcaseSection />
          </Section>

          {/* ── Timeline & Activity (Phase 16) ─────────────────── */}
          <Section
            id="timeline"
            title="16 — Timeline & Activity Feed"
            description="Four systems — unified timeline, activity intelligence, composer, pinned context. Real Lucide + brand icons only."
          >
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
                  <CardTitle>Activity item (production pattern)</CardTitle>
                  <CardDescription>Icon well · title · summary · actor · relative time</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(37,211,102,0.12)]">
                      <BrandIcon brand="whatsapp" size={16} />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-sales-text-primary">WhatsApp sent</p>
                      <p className="mt-0.5 text-[12px] text-sales-text-secondary">Shared quotation PDF</p>
                      <p className="mt-1 text-[11px] text-sales-text-muted">Sales rep · 2h ago</p>
                    </div>
                  </div>
                  <Timeline
                    items={[
                      {
                        id: "1",
                        title: "Call logged",
                        description: "No answer · will retry tomorrow",
                        timeLabel: "10:42 AM",
                        tone: "success",
                      },
                      {
                        id: "2",
                        title: "Stage changed",
                        description: "Contacted → Negotiating",
                        timeLabel: "Yesterday",
                        tone: "brand",
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Activity rows (legacy compact list)</CardTitle>
              </CardHeader>
              <div className="divide-y divide-sales-border-subtle">
                <ActivityRow
                  icon={<BrandIcon brand="whatsapp" size={16} />}
                  title="WhatsApp reply"
                  detail="Customer asked about deposit terms"
                  timeLabel="12m"
                />
                <ActivityRow
                  icon={<Phone size={16} className="text-sales-text-secondary" strokeWidth={1.8} />}
                  title="Call logged"
                  detail="No answer"
                  timeLabel="1h"
                />
              </div>
            </Card>
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Implemented in production</CardTitle>
                <CardDescription>
                  Lead detail Timeline tab · ActivityTimeline · note/call composer · filters · pin · quotation
                  federation · dedupe on WhatsApp events
                </CardDescription>
              </CardHeader>
            </Card>
          </Section>

          {/* ── Avatars, Identity & Status (Phase 17) ─────────── */}
          <Section
            id="identity"
            title="17 — Avatars, Identity & Status"
            description="Four systems — Avatar · Identity · Sales status (Phase 04) · Presence. Documentation examples only; production uses real profile data."
          >
            <Card>
              <CardHeader>
                <CardTitle>Avatar system</CardTitle>
                <CardDescription>Circle for people · rounded square for companies · initials fallback · optional presence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Person sizes</p>
                  <div className="flex flex-wrap items-end gap-4">
                    {(["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const).map((size) => (
                      <div key={size} className="flex flex-col items-center gap-1.5">
                        <Avatar name="Doc Example" size={size} />
                        <span className="text-[10px] text-sales-text-muted">{size}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">Company + fallbacks</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <CompanyIdentity name="Acme Solar Ltd" secondary="Solar installation company" size="md" />
                    <Avatar name="Acme Solar Ltd" shape="square" size="lg" />
                    <Avatar name="Chiedza" size="md" />
                    <Avatar name="" size="md" />
                    <Avatar name="Doc Example" size="md" presence="online" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Identity rows</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <UserIdentity
                    name="Doc Example User"
                    secondary="Sales Representative"
                    tertiary="Example branch (docs only)"
                    size="lg"
                  />
                  <LeadIdentity name="Doc Example Lead" secondary="5kW solar enquiry (example)" />
                  <GroupAvatars
                    label="Example team: Doc A, Doc B, and 2 others"
                    members={[
                      { id: "1", name: "Doc A" },
                      { id: "2", name: "Doc B" },
                      { id: "3", name: "Doc C" },
                      { id: "4", name: "Doc D" },
                      { id: "5", name: "Doc E" },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Sales & entity status</CardTitle>
                  <CardDescription>Hot ≥70 · Warm 45–69 · Cold &lt;45 (blue). No Very Cold.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <LeadScoreBadge score={82} />
                    <LeadScoreBadge score={54} />
                    <LeadScoreBadge score={21} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PipelineStageBadge status="NEGOTIATING" />
                    <QuotationStatusBadge status="SENT" />
                    <EntityTypeBadge type="DEAL" />
                    <EntityTypeBadge type="QUOTATION" />
                  </div>
                  <LeadScoreGauge score={82} />
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Presence & availability</CardTitle>
                <CardDescription>Real heartbeat via POST /api/users/me/presence · never fabricated in production</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-6">
                <PresenceIndicator state="online" />
                <PresenceIndicator state="away" />
                <PresenceIndicator state="busy" />
                <PresenceIndicator state="offline" />
              </CardContent>
            </Card>
          </Section>

          {/* ── Charts & Data Visualization ────────────────────── */}
          <Section
            id="charts"
            title="11 — Charts & Data Visualization"
            description="Four systems — metric, time series, comparison/composition, process/activity — on Recharts with shared tokens."
          >
            <ChartsShowcaseSection />
          </Section>

          {/* ── Empty States & Feedback ────────────────────────── */}
          <Section
            id="states"
            title="12 — Empty States & Feedback"
            description="Empty · filtered empty · loading · error recovery · success · information. Clear, calm, recoverable workspace states."
          >
            <StatesShowcaseSection />
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
